from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import pipeline
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="CuraLink AI Engine",
    description=(
        "Medical Research AI pipeline: fetches PubMed, OpenAlex, ClinicalTrials "
        "→ ranks with BM25+semantic → reasons with Llama-3.1-70b via Groq."
    ),
    version="1.0.0",
    docs_url="/docs",        # Swagger UI at /docs
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tightened in production to Node.js backend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(pipeline.router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health_check():
    return {
        "status": "ok",
        "service": "CuraLink AI Engine",
        "phase": "1 — Data Fetchers Active",
    }


@app.get("/", tags=["health"])
async def root():
    return {
        "message": "CuraLink AI Engine is running.",
        "docs": "/docs",
        "health": "/health",
    }
