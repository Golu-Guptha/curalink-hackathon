import httpx
from typing import Optional
from app.config import get_settings
from app.schemas.response import ClinicalTrial, TrialLocation, TrialContact
from app.utils.text_cleaner import clean_text, truncate_text

settings = get_settings()


async def fetch_clinical_trials(
    disease: str,
    query: str,
    location: Optional[str] = None,
    max_results: Optional[int] = None,
) -> list[ClinicalTrial]:
    """
    Fetch clinical trials from ClinicalTrials.gov v2 API.

    Fetches both RECRUITING and COMPLETED trials then:
    - Parses all fields required by the task spec
    - Optionally filters by location (country/city match)

    Returns a list of ClinicalTrial objects (unranked).
    """
    limit = max_results or settings.clinical_trials_page_size
    search_cond = _build_condition_query(disease, query)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Fetch RECRUITING and COMPLETED in parallel
        recruiting, completed = await _fetch_both_statuses(
            client, search_cond, limit // 2, location
        )

    all_trials = recruiting + completed

    # Location-aware filtering
    if location:
        filtered = _filter_by_location(all_trials, location)
        # Always keep at least some results even if location doesn't match
        if len(filtered) >= 3:
            all_trials = filtered
        else:
            # Soft filter: prioritize location matches but include others
            all_trials = filtered + [
                t for t in all_trials if t not in filtered
            ]

    # Deduplicate by NCT ID
    seen = set()
    unique_trials = []
    for trial in all_trials:
        if trial.nct_id not in seen:
            seen.add(trial.nct_id)
            unique_trials.append(trial)

    print(f"[ClinicalTrials] Fetched {len(unique_trials)} unique trials")
    return unique_trials


# ─── Private Helpers ──────────────────────────────────────────────────────────

def _build_condition_query(disease: str, query: str) -> str:
    """Build the condition query string for ClinicalTrials.gov."""
    disease = disease.strip()
    query = query.strip()
    if query and query.lower() != disease.lower():
        return f"{disease} {query}"
    return disease


async def _fetch_both_statuses(
    client: httpx.AsyncClient,
    condition: str,
    per_status: int,
    location: Optional[str] = None,
) -> tuple[list[ClinicalTrial], list[ClinicalTrial]]:
    """Fetch RECRUITING and COMPLETED trials concurrently."""
    import asyncio

    recruiting_task = _fetch_trials_by_status(
        client, condition, "RECRUITING", per_status, location
    )
    completed_task = _fetch_trials_by_status(
        client, condition, "COMPLETED", per_status, location
    )
    results = await asyncio.gather(
        recruiting_task, completed_task, return_exceptions=True
    )

    recruiting = results[0] if not isinstance(results[0], Exception) else []
    completed = results[1] if not isinstance(results[1], Exception) else []
    return recruiting, completed


async def _fetch_trials_by_status(
    client: httpx.AsyncClient,
    condition: str,
    status: str,
    page_size: int,
    location: Optional[str] = None,
) -> list[ClinicalTrial]:
    """Fetch trials for a specific status."""
    params = {
        "query.cond": condition,
        "filter.overallStatus": status,
        "pageSize": page_size,
        "format": "json",
    }
    # Inject location into API query for native location filtering
    if location:
        params["query.locn"] = location
        print(f"[ClinicalTrials] Location filter applied: {location}")

    try:
        response = await client.get(
            f"{settings.clinical_trials_base_url}/studies",
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        studies = data.get("studies", [])
        return [_parse_trial(s) for s in studies if _parse_trial(s) is not None]

    except httpx.HTTPError as e:
        print(f"[ClinicalTrials] HTTP error ({status}): {e}")
        return []
    except Exception as e:
        print(f"[ClinicalTrials] Unexpected error ({status}): {e}")
        return []


def _parse_trial(study: dict) -> Optional[ClinicalTrial]:
    """Parse a single ClinicalTrials.gov v2 study into a ClinicalTrial object."""
    try:
        protocol = study.get("protocolSection", {})

        # ── Identification ─────────────────────────────────────────────────────
        id_module = protocol.get("identificationModule", {})
        nct_id = id_module.get("nctId", "")
        brief_title = clean_text(id_module.get("briefTitle", ""))
        if not nct_id or not brief_title:
            return None

        # ── Status ─────────────────────────────────────────────────────────────
        status_module = protocol.get("statusModule", {})
        overall_status = status_module.get("overallStatus", "UNKNOWN")
        start_date_struct = status_module.get("startDateStruct", {})
        start_date = start_date_struct.get("date", None)

        # ── Design (Phase) ─────────────────────────────────────────────────────
        design_module = protocol.get("designModule", {})
        phases = design_module.get("phases", [])
        phase = ", ".join(phases) if phases else None

        # ── Eligibility ─────────────────────────────────────────────────────────
        eligibility_module = protocol.get("eligibilityModule", {})
        eligibility_criteria = truncate_text(
            clean_text(eligibility_module.get("eligibilityCriteria", "")),
            max_chars=500,
        )

        # ── Locations ──────────────────────────────────────────────────────────
        locations_module = protocol.get("contactsLocationsModule", {})
        location_list = locations_module.get("locations", [])
        locations = []
        for loc in location_list[:10]:  # Cap locations
            locations.append(
                TrialLocation(
                    facility=loc.get("facility"),
                    city=loc.get("city"),
                    country=loc.get("country"),
                )
            )

        # ── Contacts ────────────────────────────────────────────────────────────
        central_contacts = locations_module.get("centralContacts", [])
        contacts = []
        for contact in central_contacts[:3]:
            contacts.append(
                TrialContact(
                    name=contact.get("name"),
                    email=contact.get("email"),
                    phone=contact.get("phone"),
                )
            )

        url = f"https://clinicaltrials.gov/study/{nct_id}"

        return ClinicalTrial(
            nct_id=nct_id,
            title=brief_title,
            status=overall_status,
            phase=phase,
            eligibility_summary=eligibility_criteria or "See trial page for eligibility.",
            locations=locations,
            contacts=contacts,
            start_date=start_date,
            url=url,
        )

    except Exception as e:
        print(f"[ClinicalTrials] Parse error: {e}")
        return None


def _filter_by_location(
    trials: list[ClinicalTrial], location: str
) -> list[ClinicalTrial]:
    """
    Filter trials that have at least one location matching the user's location.
    Tries to match city or country (case-insensitive).
    """
    location_lower = location.lower()
    # Extract tokens: "Toronto, Canada" → ["toronto", "canada"]
    location_tokens = [t.strip() for t in location_lower.replace(",", " ").split()]

    matched = []
    for trial in trials:
        for loc in trial.locations:
            city = (loc.city or "").lower()
            country = (loc.country or "").lower()
            combined = f"{city} {country}"
            if any(token in combined for token in location_tokens):
                matched.append(trial)
                break  # One match per trial is enough

    return matched
