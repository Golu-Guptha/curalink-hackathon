from pydantic import BaseModel
from typing import Optional


class PatientProfile(BaseModel):
    """Patient context provided via Deep Research modal."""
    name:            Optional[str]   = None
    age:             Optional[int]   = None
    sex:             Optional[str]   = None
    weight_kg:       Optional[float] = None
    location:        Optional[str]   = None
    medical_history: Optional[str]   = None
    current_disease: Optional[str]   = None
    conditions:      Optional[str]   = None
    medications:     Optional[str]   = None
    current_meds:    Optional[str]   = None
    allergies:       Optional[str]   = None
    lab_values:      Optional[str]   = None
    research_focus:  Optional[str]   = None   # 'treatment','trials','side_effects','prevention','mechanism','general'
    detail_level:    str             = "balanced"  # 'patient'|'balanced'|'clinical'


class QueryRequest(BaseModel):
    """
    Incoming request to the full pipeline.
    Sent from the Node.js backend on every chat message.
    """
    query: str
    session_id: str
    disease: Optional[str] = None          # Pre-extracted disease if known
    location: Optional[str] = None         # User's location for trial filtering
    conversation_history: list[dict] = []  # [{role, content}, ...]
    research_mode: str = "thinking"        # "fast" | "thinking" | "deep"
    patient_profile: Optional[PatientProfile] = None  # Deep Research profile


class FetchRequest(BaseModel):
    """
    For individual fetcher test endpoints.
    """
    disease: str
    query: str
    location: Optional[str] = None
    max_results: Optional[int] = None
