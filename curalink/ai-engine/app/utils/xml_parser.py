from bs4 import BeautifulSoup
from typing import Optional
import re


def parse_pubmed_xml(xml_content: str) -> list[dict]:
    """
    Parse PubMed efetch XML response into structured article dicts.
    Handles the complex nested PubMed XML format.

    Returns a list of dicts with keys:
        id, title, abstract, authors, year, url
    """
    articles = []

    try:
        soup = BeautifulSoup(xml_content, "lxml-xml")
        pubmed_articles = soup.find_all("PubmedArticle")

        for article in pubmed_articles:
            try:
                parsed = _parse_single_article(article)
                if parsed:
                    articles.append(parsed)
            except Exception:
                # Skip malformed articles silently
                continue

    except Exception as e:
        print(f"[XML Parser] Fatal parse error: {e}")

    return articles


def _parse_single_article(article_soup) -> Optional[dict]:
    """Parse a single PubmedArticle XML node."""

    # ── PMID ──────────────────────────────────────────────────────────────────
    pmid_tag = article_soup.find("PMID")
    pmid = pmid_tag.get_text(strip=True) if pmid_tag else None
    if not pmid:
        return None

    # ── Title ─────────────────────────────────────────────────────────────────
    title_tag = article_soup.find("ArticleTitle")
    title = title_tag.get_text(separator=" ", strip=True) if title_tag else "No Title"
    title = re.sub(r"\s+", " ", title).strip()

    # ── Abstract ──────────────────────────────────────────────────────────────
    # PubMed abstracts can be structured (multiple AbstractText nodes)
    abstract_tags = article_soup.find_all("AbstractText")
    if abstract_tags:
        parts = []
        for tag in abstract_tags:
            label = tag.get("Label", "")
            text = tag.get_text(separator=" ", strip=True)
            if label:
                parts.append(f"{label}: {text}")
            else:
                parts.append(text)
        abstract = " ".join(parts)
    else:
        abstract = ""

    abstract = re.sub(r"\s+", " ", abstract).strip()

    # ── Authors ───────────────────────────────────────────────────────────────
    authors = []
    author_list = article_soup.find("AuthorList")
    if author_list:
        for author in author_list.find_all("Author"):
            last = author.find("LastName")
            fore = author.find("ForeName")
            if last:
                name = last.get_text(strip=True)
                if fore:
                    name = f"{name} {fore.get_text(strip=True)}"
                authors.append(name)
            else:
                # CollectiveName (org)
                collective = author.find("CollectiveName")
                if collective:
                    authors.append(collective.get_text(strip=True))

    # ── Publication Year ──────────────────────────────────────────────────────
    year = None
    pub_date = article_soup.find("PubDate")
    if pub_date:
        year_tag = pub_date.find("Year")
        if year_tag:
            try:
                year = int(year_tag.get_text(strip=True))
            except ValueError:
                pass

    # ── Construct URL ─────────────────────────────────────────────────────────
    url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"

    return {
        "id": f"pubmed_{pmid}",
        "title": title,
        "abstract": abstract,
        "authors": authors[:6],  # Cap at 6 authors
        "year": year,
        "source": "PubMed",
        "url": url,
        "cited_by_count": 0,
    }


def reconstruct_abstract_from_inverted_index(inverted_index: Optional[dict]) -> str:
    """
    OpenAlex stores abstracts as an inverted index:
    { "word": [position1, position2, ...], ... }

    This function reconstructs the original abstract text.
    """
    if not inverted_index:
        return ""

    try:
        # Build position → word mapping
        position_word = {}
        for word, positions in inverted_index.items():
            for pos in positions:
                position_word[pos] = word

        if not position_word:
            return ""

        # Sort by position and join
        max_pos = max(position_word.keys())
        words = [position_word.get(i, "") for i in range(max_pos + 1)]
        return " ".join(w for w in words if w).strip()

    except Exception:
        return ""
