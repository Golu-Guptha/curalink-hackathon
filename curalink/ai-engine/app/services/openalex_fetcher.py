import httpx
import asyncio
from typing import Optional
from app.config import get_settings
from app.schemas.response import Publication
from app.utils.xml_parser import reconstruct_abstract_from_inverted_index
from app.utils.text_cleaner import clean_text, truncate_text

settings = get_settings()


async def fetch_openalex_publications(
    disease: str,
    query: str,
    max_results: Optional[int] = None,
    location: Optional[str] = None,
) -> list[Publication]:
    """
    Fetch publications from OpenAlex across multiple pages.
    OpenAlex returns up to 200 per-page (we use 50 x 4 pages = 200 results).

    Key challenge: OpenAlex stores abstracts as an inverted index.
    We reconstruct them using xml_parser.reconstruct_abstract_from_inverted_index()

    Returns a list of Publication objects (unranked).
    """
    search_query = _build_search_query(disease, query, location)
    max_pages = settings.openalex_max_pages
    per_page = settings.openalex_per_page

    # Cap total results
    if max_results:
        max_pages = min(max_pages, (max_results // per_page) + 1)

    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [
            _fetch_page(client, search_query, per_page, page)
            for page in range(1, max_pages + 1)
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    all_publications: list[Publication] = []
    seen_ids = set()

    for result in results:
        if isinstance(result, Exception):
            print(f"[OpenAlex] Page fetch error: {result}")
            continue

        for item in result:
            if item.id in seen_ids:
                continue
            seen_ids.add(item.id)
            all_publications.append(item)

    print(f"[OpenAlex] Fetched {len(all_publications)} unique publications")
    return all_publications


# ─── Private Helpers ──────────────────────────────────────────────────────────

def _build_search_query(disease: str, query: str, location: Optional[str] = None) -> str:
    """
    Construct the OpenAlex search string.
    Combining disease + intent + location gives location-aware results.
    """
    disease = disease.strip()
    query = query.strip()

    if query and query.lower() != disease.lower():
        term = f"{disease} {query}"
    else:
        term = disease

    # Add location context for geographic relevance
    if location:
        loc_clean = location.strip().split(",")[0].strip()
        if loc_clean:
            term += f" {loc_clean}"
            print(f"[OpenAlex] Location-aware search: {term}")

    return term


async def _fetch_page(
    client: httpx.AsyncClient,
    search_query: str,
    per_page: int,
    page: int,
) -> list[Publication]:
    """Fetch a single page of OpenAlex results."""
    params = {
        "search": search_query,
        "per-page": per_page,
        "page": page,
        "sort": "relevance_score:desc",
        # Only works with abstracts available, filter recent publications
        "filter": "from_publication_date:2015-01-01,has_abstract:true",
        "select": (
            "id,title,abstract_inverted_index,authorships,"
            "publication_year,doi,cited_by_count,primary_location"
        ),
    }

    try:
        response = await client.get(
            f"{settings.openalex_base_url}/works",
            params=params,
            headers={"User-Agent": "CuraLink/1.0 (dev@curalink.ai)"},
        )
        response.raise_for_status()
        data = response.json()
        works = data.get("results", [])
        return [_parse_work(w) for w in works if _parse_work(w) is not None]

    except httpx.HTTPError as e:
        print(f"[OpenAlex] HTTP error on page {page}: {e}")
        return []
    except Exception as e:
        print(f"[OpenAlex] Unexpected error on page {page}: {e}")
        return []


def _parse_work(work: dict) -> Optional[Publication]:
    """Parse a single OpenAlex work dict into a Publication object."""
    try:
        openalex_id = work.get("id", "")
        short_id = openalex_id.replace("https://openalex.org/", "openalex_")

        title = clean_text(work.get("title") or "")
        if not title:
            return None

        # ── Reconstruct abstract from inverted index ───────────────────────────
        inverted_index = work.get("abstract_inverted_index")
        abstract = reconstruct_abstract_from_inverted_index(inverted_index)
        abstract = truncate_text(clean_text(abstract), max_chars=1200)

        if not abstract:
            return None  # Useless without abstract for ranking

        # ── Authors ───────────────────────────────────────────────────────────
        authorships = work.get("authorships", [])
        authors = []
        for authorship in authorships[:6]:
            author = authorship.get("author", {})
            name = author.get("display_name", "")
            if name:
                authors.append(name)

        # ── Year ──────────────────────────────────────────────────────────────
        year = work.get("publication_year")

        # ── URL ───────────────────────────────────────────────────────────────
        doi = work.get("doi")
        if doi:
            url = doi if doi.startswith("http") else f"https://doi.org/{doi}"
        else:
            url = openalex_id  # Fall back to OpenAlex URL

        # ── Citation Count ────────────────────────────────────────────────────
        cited_by_count = work.get("cited_by_count", 0) or 0

        return Publication(
            id=short_id,
            title=title,
            abstract=abstract,
            authors=authors,
            year=year,
            source="OpenAlex",
            url=url,
            cited_by_count=cited_by_count,
        )

    except Exception as e:
        print(f"[OpenAlex] Work parse error: {e}")
        return None
