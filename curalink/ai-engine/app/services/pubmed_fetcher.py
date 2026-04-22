import httpx
import asyncio
from typing import Optional
from app.config import get_settings
from app.schemas.response import Publication
from app.utils.xml_parser import parse_pubmed_xml
from app.utils.text_cleaner import clean_text, truncate_text

settings = get_settings()


async def fetch_pubmed_publications(
    disease: str,
    query: str,
    max_results: Optional[int] = None,
    location: Optional[str] = None,
) -> list[Publication]:
    """
    Two-step PubMed fetch:
      Step 1 → esearch: get up to N article IDs for disease+query
      Step 2 → efetch:  fetch full XML for all IDs, parse into Publication objects

    Returns a list of Publication objects (unranked).
    """
    limit = max_results or settings.pubmed_max_results
    search_term = _build_search_term(disease, query, location)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ── Step 1: Get IDs ────────────────────────────────────────────────────
        id_list = await _esearch(client, search_term, limit)
        if not id_list:
            print(f"[PubMed] No IDs returned for: {search_term}")
            return []

        print(f"[PubMed] Found {len(id_list)} article IDs")

        # ── Step 2: Fetch full records in batches of 50 ────────────────────────
        all_raw = await _efetch_in_batches(client, id_list, batch_size=50)

    # ── Parse XML → Publication objects ───────────────────────────────────────
    publications = []
    for raw in all_raw:
        pub = Publication(
            id=raw["id"],
            title=raw["title"],
            abstract=truncate_text(clean_text(raw["abstract"]), max_chars=1200),
            authors=raw["authors"],
            year=raw["year"],
            source="PubMed",
            url=raw["url"],
            cited_by_count=0,
        )
        # Skip publications with no abstract (useless for ranking)
        if pub.abstract:
            publications.append(pub)

    print(f"[PubMed] Parsed {len(publications)} usable publications")
    return publications


# ─── Private Helpers ──────────────────────────────────────────────────────────

def _build_search_term(disease: str, query: str, location: Optional[str] = None) -> str:
    """
    Build an intelligent PubMed search term.
    Combines disease + query + location with proper PubMed boolean syntax.
    """
    disease = disease.strip()
    query = query.strip()

    if query and query.lower() != disease.lower():
        term = f"{query} AND {disease}"
    else:
        term = disease

    # Add location context — PubMed affiliation search
    if location:
        loc_clean = location.strip().split(",")[0].strip()  # Use country/first token
        if loc_clean:
            term += f" AND {loc_clean}[Affiliation]"
            print(f"[PubMed] Location-aware search: {term}")

    return term


async def _esearch(client: httpx.AsyncClient, term: str, retmax: int) -> list[str]:
    """Call PubMed esearch to get article IDs."""
    params = {
        "db": "pubmed",
        "term": term,
        "retmax": retmax,
        "sort": "pub+date",
        "retmode": "json",
        "tool": settings.pubmed_tool,
        "email": settings.pubmed_email,
    }

    try:
        response = await client.get(
            f"{settings.pubmed_base_url}/esearch.fcgi",
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("esearchresult", {}).get("idlist", [])
    except httpx.HTTPError as e:
        print(f"[PubMed] esearch HTTP error: {e}")
        return []
    except Exception as e:
        print(f"[PubMed] esearch unexpected error: {e}")
        return []


async def _efetch_in_batches(
    client: httpx.AsyncClient,
    id_list: list[str],
    batch_size: int = 50,
) -> list[dict]:
    """
    Fetch full article data in batches (PubMed limits batch size).
    Runs batches concurrently for speed.
    """
    batches = [id_list[i : i + batch_size] for i in range(0, len(id_list), batch_size)]
    tasks = [_efetch_batch(client, batch) for batch in batches]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_articles = []
    for r in results:
        if isinstance(r, Exception):
            print(f"[PubMed] Batch fetch error: {r}")
            continue
        all_articles.extend(r)

    return all_articles


async def _efetch_batch(client: httpx.AsyncClient, id_batch: list[str]) -> list[dict]:
    """Fetch one batch of IDs from PubMed efetch."""
    params = {
        "db": "pubmed",
        "id": ",".join(id_batch),
        "retmode": "xml",
        "tool": settings.pubmed_tool,
        "email": settings.pubmed_email,
    }

    try:
        response = await client.get(
            f"{settings.pubmed_base_url}/efetch.fcgi",
            params=params,
        )
        response.raise_for_status()
        return parse_pubmed_xml(response.text)
    except httpx.HTTPError as e:
        print(f"[PubMed] efetch HTTP error: {e}")
        return []
    except Exception as e:
        print(f"[PubMed] efetch unexpected error: {e}")
        return []
