from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Groq LLM — supports multiple keys (comma-separated) for rotation
    groq_api_keys: str = ""          # e.g. "key1,key2,key3"
    groq_api_key: str = ""           # Legacy single key fallback
    model_name: str = "llama-3.1-70b-versatile"

    # PubMed
    pubmed_tool: str = "curalink"
    pubmed_email: str = "dev@curalink.ai"
    pubmed_base_url: str = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    pubmed_max_results: int = 100

    # OpenAlex
    openalex_base_url: str = "https://api.openalex.org"
    openalex_per_page: int = 50
    openalex_max_pages: int = 4  # 50 * 4 = 200 results max

    # ClinicalTrials
    clinical_trials_base_url: str = "https://clinicaltrials.gov/api/v2"
    clinical_trials_page_size: int = 50

    # Ranking weights
    semantic_weight: float = 0.50
    bm25_weight: float = 0.35
    recency_weight: float = 0.15

    # Final top-k
    top_publications: int = 7
    top_trials: int = 5

    # App
    app_name: str = "CuraLink AI Engine"
    debug: bool = False

    def get_groq_keys(self) -> list[str]:
        "Return all configured Groq API keys as a list."
        keys = []
        if self.groq_api_keys:
            keys = [k.strip() for k in self.groq_api_keys.split(",") if k.strip()]
        if not keys and self.groq_api_key:
            keys = [self.groq_api_key]
        return keys

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        protected_namespaces = ("settings_",)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
