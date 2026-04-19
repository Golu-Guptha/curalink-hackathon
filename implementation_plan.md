# CuraLink — AI Medical Research Assistant
## Master Implementation Plan

---

## 1️⃣ ANALYSIS — What Is Currently Wrong / Missing

After exhaustively reading every line of both source documents, here is the honest gap analysis of what a typical participant would submit vs. what **actually wins**:

### ❌ Critical Gaps Most Participants Will Have

| Gap | Why It Hurts |
|---|---|
| Fetching top 1–2 results only | Task explicitly says "❌ Avoid fetching only top 1–2 results" — instant disqualification signal |
| Using GPT/Gemini API directly | Task explicitly bans direct Gemini/OpenAI API — disqualified |
| No query expansion | Searching "deep brain stimulation" instead of "deep brain stimulation + Parkinson's disease" — shallow pipeline |
| No re-ranking pipeline | Just returning raw API results with no filtering/ranking — fails "depth first, precision next" requirement |
| No context across conversation turns | Follow-up "Can I take Vitamin D?" must use lung cancer context — failing this is a critical miss |
| No structured output format | Task requires: Condition Overview + Research Insights + Clinical Trials + Source Attribution |
| No source attribution | Every response MUST cite: Title, Authors, Year, Platform, URL, Supporting snippet |
| Generic UI, no personalization | Judges watch the demo video — a boring UI = losing impression |
| No real AI engineering | Just LangChain wrappers ≠ AI engineering. System design thinking is what they want to see |
| Location context ignored | Transcript line 41: "Two things are crucial, disease and location" — most miss location-aware filtering for clinical trials |

### ❌ Architectural Gaps

- No separation of concerns — everything crammed into one Express server
- No dedicated data-fetching layer with proper rate limiting / pagination
- No embedding or semantic ranking layer — raw keyword results passed to LLM
- No conversation state storage in MongoDB — context is ephemeral
- No structured AI response parser — LLM output fed raw to frontend

---

## 2️⃣ GOAL — What We Are Building (Derived Directly From Source Docs)

From the transcript and task doc, the **exact goals** are:

> **"Build a full-stack AI-powered Medical Research Assistant prototype using MERN stack, powered by a custom open-source LLM — acting as a health research companion that: understands user context → retrieves high-quality medical research → reasons over it → delivers structured, personalized, source-backed answers."**

### Concrete Goals Extracted (Line by Line)

| # | Goal | Source |
|---|---|---|
| G1 | Accept disease + location as primary inputs | Transcript line 41 |
| G2 | Fetch from PubMed, OpenAlex, ClinicalTrials.gov | Task lines 71–73 |
| G3 | Retrieve 50–300 results, then filter/rank to top 6–8 | Task lines 105–110 |
| G4 | Use a custom/open-source LLM (not GPT/Gemini API) | Task line 197 |
| G5 | Query expansion — auto-expand search terms | Task lines 43–54 |
| G6 | Multi-turn conversation with context preservation | Task lines 218–243 |
| G7 | Structured output: Condition Overview + Research Insights + Clinical Trials + Sources | Task lines 270–286 |
| G8 | Location-aware clinical trial filtering | Transcript line 41, Task line 150 |
| G9 | Source attribution on every response | Task lines 279–286 |
| G10 | MERN stack application with chat interface | Task lines 311–329 |
| G11 | Live deployed application + Loom demo | Task lines 496–516 |
| G12 | Show engineering depth, not just API calls | Transcript lines 93–103 |

---

## 3️⃣ FINALIZED TECH STACK (Updated & Justified)

### Why Hybrid (Node.js + Python), Not Pure MERN

The task says MERN for the **application** but the **LLM engineering** has complete freedom. A pure Node.js AI layer cannot compete with Python's ecosystem for:
- Sentence-transformers (semantic embeddings)
- BM25 (keyword ranking)
- LangChain (RAG pipeline orchestration)
- FAISS / ChromaDB (vector search)
- Groq SDK (open-source LLM inference)

A hybrid wins. Two services, both deployable on Render. Same cost, 10x better AI quality.

### Final Stack

```
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE 1: React Frontend (Vite)                               │
│  ─ TypeScript + React 18                                        │
│  ─ Tailwind CSS (only place we use it — justified by speed)     │
│  ─ Socket.io-client (streaming responses)                       │
│  ─ React Query (API state management)                           │
│  ─ Deploy: Vercel                                               │
├─────────────────────────────────────────────────────────────────┤
│  SERVICE 2: Node.js App Backend (Express)                       │
│  ─ Express.js + TypeScript                                      │
│  ─ MongoDB Atlas (Mongoose ODM)                                 │
│  ─ JWT Auth (access + refresh tokens)                           │
│  ─ Socket.io (streaming relay)                                  │
│  ─ Axios (proxy calls to Python AI Engine)                      │
│  ─ Deploy: Render (Web Service)                                 │
├─────────────────────────────────────────────────────────────────┤
│  SERVICE 3: Python AI Engine (FastAPI)                          │
│  ─ FastAPI + Uvicorn                                            │
│  ─ LangChain (RAG orchestration)                                │
│  ─ sentence-transformers (all-MiniLM-L6-v2 for embeddings)     │
│  ─ rank_bm25 (BM25 keyword ranking)                             │
│  ─ Groq SDK → Llama-3.1-70b (open-source LLM)                 │
│  ─ httpx (async API calls to PubMed/OpenAlex/ClinicalTrials)   │
│  ─ BeautifulSoup4 (PubMed XML parsing)                          │
│  ─ Deploy: Render (Web Service)                                 │
└─────────────────────────────────────────────────────────────────┘
                         │
                  MongoDB Atlas
                  (Free M0 cluster)
```

### LLM Choice Justification: Groq + Llama-3.1-70b

- **Not** OpenAI, **Not** Gemini — uses open-source `meta-llama/llama-3.1-70b-versatile`
- Groq is an **inference provider** for open-source models — fully allowed
- Free tier: 14,400 requests/day, 6,000 tokens/minute
- Response latency: ~0.5s (fastest available for OSS models)
- Alternative: Hugging Face Inference API with `Mistral-7B-Instruct`

---

## 4️⃣ COMPLETE ARCHITECTURE

### System Architecture Diagram

```
USER (Browser)
     │
     ▼
┌────────────────────────────────────┐
│        React Frontend (Vercel)     │
│  ┌─────────────────────────────┐   │
│  │  Chat Interface             │   │
│  │  - Message input + history  │   │
│  │  - Streaming response view  │   │
│  │  - Publications card grid   │   │
│  │  - Clinical trials section  │   │
│  │  - Source attribution list  │   │
│  └─────────────────────────────┘   │
└──────────────┬─────────────────────┘
               │  REST + WebSocket
               ▼
┌────────────────────────────────────┐
│   Node.js App Backend (Render)     │
│  ┌──────────────────────────────┐  │
│  │  Auth Service                │  │
│  │  - POST /api/auth/register   │  │
│  │  - POST /api/auth/login      │  │
│  │  - GET  /api/auth/me         │  │
│  ├──────────────────────────────┤  │
│  │  Conversation Service        │  │
│  │  - POST /api/chat            │  │
│  │  - GET  /api/chat/history    │  │
│  │  - GET  /api/chat/sessions   │  │
│  ├──────────────────────────────┤  │
│  │  Context Manager             │  │
│  │  - Builds conversation ctx   │  │
│  │  - Injects prior turns       │  │
│  │  - Stores to MongoDB         │  │
│  └──────────────────────────────┘  │
│              │                      │
│     MongoDB Atlas Storage           │
│     - Users collection              │
│     - Sessions collection           │
│     - Messages collection           │
└──────────────┬─────────────────────┘
               │  Internal HTTP (Axios)
               ▼
┌────────────────────────────────────┐
│    Python AI Engine (Render)       │
│                                    │
│  POST /pipeline/query              │
│  ┌─────────────────────────────┐   │
│  │  1. Query Expansion         │   │
│  │     - Extract disease       │   │
│  │     - Extract intent        │   │
│  │     - Extract location      │   │
│  │     - Expand search terms   │   │
│  ├─────────────────────────────┤   │
│  │  2. Parallel Data Fetching  │   │
│  │     ┌──────────────────┐    │   │
│  │     │ PubMed Fetcher   │    │   │
│  │     │ (up to 100 IDs)  │    │   │
│  │     └──────────────────┘    │   │
│  │     ┌──────────────────┐    │   │
│  │     │ OpenAlex Fetcher │    │   │
│  │     │ (up to 200 works)│    │   │
│  │     └──────────────────┘    │   │
│  │     ┌──────────────────┐    │   │
│  │     │ ClinicalTrials   │    │   │
│  │     │ Fetcher (50)     │    │   │
│  │     └──────────────────┘    │   │
│  ├─────────────────────────────┤   │
│  │  3. Embedding & Ranking     │   │
│  │     - sentence-transformers │   │
│  │     - BM25 keyword score    │   │
│  │     - Hybrid score merge    │   │
│  │     - Recency boost         │   │
│  │     - Top 6–8 selected      │   │
│  ├─────────────────────────────┤   │
│  │  4. Prompt Engineering      │   │
│  │     - Build RAG prompt      │   │
│  │     - Inject context        │   │
│  │     - Inject retrieved docs │   │
│  ├─────────────────────────────┤   │
│  │  5. LLM Reasoning           │   │
│  │     - Groq Llama-3.1-70b   │   │
│  │     - Structured output     │   │
│  ├─────────────────────────────┤   │
│  │  6. Response Structuring    │   │
│  │     - Condition Overview    │   │
│  │     - Research Insights     │   │
│  │     - Clinical Trials       │   │
│  │     - Source Attribution    │   │
│  └─────────────────────────────┘   │
└────────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
 PubMed   OpenAlex  ClinicalTrials
  API       API       .gov API
```

---

## 5️⃣ FOLDER & FILE STRUCTURE

### Root Monorepo Layout

```
curalink/
├── frontend/                    # React Vite app
├── backend/                     # Node.js Express app
├── ai-engine/                   # Python FastAPI app
├── .gitignore
└── README.md
```

### Service 1: Frontend (`frontend/`)

```
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   │   └── logo.svg
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatWindow.tsx          # Main chat container
│   │   │   ├── MessageBubble.tsx       # Individual message
│   │   │   ├── StreamingMessage.tsx    # Streaming text effect
│   │   │   ├── InputBar.tsx            # Message input + send
│   │   │   └── TypingIndicator.tsx     # Loading state
│   │   ├── results/
│   │   │   ├── PublicationCard.tsx     # Single publication
│   │   │   ├── PublicationsGrid.tsx    # Grid of publications
│   │   │   ├── ClinicalTrialCard.tsx   # Single trial
│   │   │   ├── ClinicalTrialsList.tsx  # List of trials
│   │   │   └── SourceAttribution.tsx   # Source list
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx             # Session history
│   │   │   ├── Navbar.tsx              # Top navigation
│   │   │   └── Layout.tsx              # Main layout wrapper
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       └── RegisterForm.tsx
│   ├── pages/
│   │   ├── Landing.tsx                 # Hero landing page
│   │   ├── Chat.tsx                    # Main chat page
│   │   ├── Login.tsx
│   │   └── Register.tsx
│   ├── hooks/
│   │   ├── useChat.ts                  # Chat logic hook
│   │   ├── useAuth.ts                  # Auth state hook
│   │   └── useStream.ts                # SSE/WS streaming hook
│   ├── store/
│   │   ├── authStore.ts                # Zustand auth store
│   │   └── chatStore.ts                # Zustand chat store
│   ├── services/
│   │   ├── api.ts                      # Axios instance
│   │   ├── authService.ts
│   │   └── chatService.ts
│   ├── types/
│   │   └── index.ts                    # TypeScript interfaces
│   ├── utils/
│   │   └── formatters.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### Service 2: Node.js Backend (`backend/`)

```
backend/
├── src/
│   ├── config/
│   │   ├── db.ts                       # MongoDB connection
│   │   └── env.ts                      # Environment config
│   ├── models/
│   │   ├── User.ts                     # User schema
│   │   ├── Session.ts                  # Chat session schema
│   │   └── Message.ts                  # Message schema
│   ├── controllers/
│   │   ├── authController.ts           # register/login/me
│   │   └── chatController.ts           # send message, history
│   ├── services/
│   │   ├── authService.ts              # JWT generation/verify
│   │   ├── contextService.ts           # Build conversation ctx
│   │   └── aiProxyService.ts           # HTTP calls to Python
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   └── chatRoutes.ts
│   ├── middleware/
│   │   ├── auth.ts                     # JWT middleware
│   │   ├── errorHandler.ts             # Global error handler
│   │   └── rateLimiter.ts              # Rate limiting
│   ├── types/
│   │   └── index.ts
│   └── app.ts                          # Express app entry
├── .env.example
├── package.json
└── tsconfig.json
```

### Service 3: Python AI Engine (`ai-engine/`)

```
ai-engine/
├── app/
│   ├── main.py                         # FastAPI entry point
│   ├── config.py                       # Settings / env vars
│   ├── routers/
│   │   └── pipeline.py                 # /pipeline/query endpoint
│   ├── services/
│   │   ├── query_expander.py           # LLM-based query expansion
│   │   ├── pubmed_fetcher.py           # PubMed API integration
│   │   ├── openalex_fetcher.py         # OpenAlex API integration
│   │   ├── clinical_trials_fetcher.py  # ClinicalTrials.gov API
│   │   ├── ranker.py                   # BM25 + semantic hybrid ranker
│   │   ├── embedder.py                 # sentence-transformers
│   │   └── llm_service.py              # Groq LLM reasoning
│   ├── schemas/
│   │   ├── request.py                  # Pydantic request models
│   │   └── response.py                 # Pydantic response models
│   └── utils/
│       ├── xml_parser.py               # PubMed XML parsing
│       └── text_cleaner.py             # Text normalization
├── .env.example
├── requirements.txt
└── Dockerfile
```

---

## 6️⃣ MONGODB SCHEMAS

### User Schema
```typescript
{
  _id: ObjectId,
  name: String,
  email: String (unique, indexed),
  passwordHash: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Session Schema
```typescript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String,              // Auto-generated from first query
  disease: String,            // Extracted primary disease
  location: String,           // User location context
  createdAt: Date,
  updatedAt: Date
}
```

### Message Schema
```typescript
{
  _id: ObjectId,
  sessionId: ObjectId (ref: Session),
  userId: ObjectId (ref: User),
  role: 'user' | 'assistant',
  content: String,            // Raw message text
  structuredResponse: {       // For assistant messages
    conditionOverview: String,
    researchInsights: String,
    publications: Publication[],
    clinicalTrials: ClinicalTrial[],
    sources: Source[]
  },
  metadata: {
    queryExpanded: String,
    disease: String,
    intent: String,
    location: String,
    retrievedCount: Number,
    rankedCount: Number
  },
  createdAt: Date
}
```

---

## 7️⃣ PHASE-BY-PHASE IMPLEMENTATION PLAN

---

### ✅ PHASE 1 — Python AI Engine: Data Fetchers
**Goal**: Build and test all three data fetching services independently.

#### 1.1 — Project Bootstrap
```bash
mkdir curalink && cd curalink
mkdir ai-engine && cd ai-engine
python -m venv venv
pip install fastapi uvicorn httpx beautifulsoup4 lxml python-dotenv pydantic
```

#### 1.2 — PubMed Fetcher (`pubmed_fetcher.py`)

**What it does:**
1. Step 1: `esearch` → Get up to 100 PubMed IDs for the disease+query
2. Step 2: `efetch` → Fetch full XML for all IDs
3. Parse XML → extract Title, Abstract, Authors, Year, PMID, URL
4. Return list of `Publication` objects

**Key Implementation Detail — Two-Step Process:**
```
esearch: GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
  ?db=pubmed
  &term={disease}+AND+{query}&AND+clinical+trial
  &retmax=100
  &sort=pub+date
  &retmode=json

→ Extract idlist: ["41732954", "41949826", ...]

efetch: GET https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
  ?db=pubmed
  &id=41732954,41949826,...
  &retmode=xml

→ Parse XML with BeautifulSoup4
→ Extract per article: PubmedArticle > MedlineCitation
```

#### 1.3 — OpenAlex Fetcher (`openalex_fetcher.py`)

**What it does:**
1. Constructs search query combining disease + expanded intent
2. Fetches up to 200 works across multiple pages (per-page=50, pages 1–4)
3. Parses JSON response → Title, Abstract, Authors, Year, DOI/URL, Citation count
4. Citation count used as one ranking signal

**Key Implementation Detail:**
```
GET https://api.openalex.org/works
  ?search={disease}+{expanded_query}
  &per-page=50
  &page=1
  &sort=relevance_score:desc
  &filter=from_publication_date:2018-01-01

→ results[] → { title, abstract_inverted_index, authorships[], 
                publication_year, doi, cited_by_count }
```

> Note: OpenAlex `abstract_inverted_index` must be reconstructed into plain text. This is a non-trivial parsing step that most participants miss.

#### 1.4 — ClinicalTrials Fetcher (`clinical_trials_fetcher.py`)

**What it does:**
1. Query by disease + optional location filter
2. Fetch both RECRUITING and COMPLETED status trials
3. Extract: Title, Status, Eligibility, Location, Contacts, Phase, Start Date
4. Filter by location if provided (match country/city in location list)

**Key Implementation Detail:**
```
GET https://clinicaltrials.gov/api/v2/studies
  ?query.cond={disease}
  &query.term={expanded_query}
  &filter.overallStatus=RECRUITING,COMPLETED
  &pageSize=50
  &format=json

→ studies[] → { protocolSection: { 
    identificationModule, statusModule, eligibilityModule,
    contactsLocationsModule } }
```

#### 1.5 — Phase 1 Testing
```bash
uvicorn app.main:app --reload
# Test endpoints:
curl "http://localhost:8000/pipeline/fetch/pubmed?disease=lung+cancer&query=immunotherapy"
curl "http://localhost:8000/pipeline/fetch/openalex?disease=parkinson&query=deep+brain+stimulation"
curl "http://localhost:8000/pipeline/fetch/trials?disease=diabetes&location=Toronto"
```

**Pass Criteria:**
- [ ] PubMed returns 80–100 raw publications
- [ ] OpenAlex returns 100–200 raw works  
- [ ] ClinicalTrials returns 30–50 trials
- [ ] All correctly parsed into structured objects

---

### ✅ PHASE 2 — Python AI Engine: Query Expansion + Ranking

#### 2.1 — Query Expander (`query_expander.py`)

**What it does:** Takes raw user input → extracts structured entities → expands search terms

```python
# Input: "I have Parkinson's disease and want to know about deep brain stimulation, 
#          I'm in Toronto"
# Output:
{
  "disease": "Parkinson's disease",
  "intent": "deep brain stimulation treatment",
  "location": "Toronto, Canada",
  "expanded_queries": [
    "deep brain stimulation Parkinson's disease",
    "DBS Parkinson treatment outcomes",
    "Parkinson's disease neurostimulation therapy",
    "Parkinson DBS clinical results 2023 2024"
  ],
  "clinical_trial_terms": "deep brain stimulation Parkinson's"
}
```

**How:** Uses Groq LLM with a structured extraction prompt + Pydantic output parsing. This is where LLM first appears in the pipeline — for smart query understanding, not just response generation.

#### 2.2 — Embedder (`embedder.py`)

**What it does:**
- Loads `sentence-transformers/all-MiniLM-L6-v2` (22M params, fast, CPU-friendly)
- Embeds the user's expanded query into a 384-dim vector
- Embeds each retrieved document's title+abstract into 384-dim vector
- Computes cosine similarity between query vector and each document

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_and_score(query: str, documents: list[str]) -> list[float]:
    query_embedding = model.encode(query, convert_to_tensor=True)
    doc_embeddings = model.encode(documents, convert_to_tensor=True)
    scores = util.cos_sim(query_embedding, doc_embeddings)[0]
    return scores.tolist()
```

#### 2.3 — Hybrid Ranker (`ranker.py`)

**What it does:** Merges BM25 (keyword) + Semantic (embedding) scores + Recency boost

**Ranking Formula:**
```
final_score = (α × semantic_score) + (β × bm25_score) + (γ × recency_score)

Where:
  α = 0.5  (semantic weight)
  β = 0.35 (keyword weight)  
  γ = 0.15 (recency weight)

recency_score = exp(-0.1 × years_since_publication)
```

**Result:** Top 6–8 publications + top 4–6 clinical trials ranked by this score.

#### 2.4 — Phase 2 Testing
```bash
# Test full retrieval + ranking pipeline
curl -X POST http://localhost:8000/pipeline/rank \
  -H "Content-Type: application/json" \
  -d '{"disease": "lung cancer", "query": "immunotherapy", "location": ""}'
```

**Pass Criteria:**
- [ ] Returns exactly 6–8 publications ranked by relevance
- [ ] Returns 4–6 clinical trials
- [ ] Recency and relevance correctly balanced
- [ ] No papers older than 2015 in top results (unless highly cited)

---

### ✅ PHASE 3 — Python AI Engine: LLM Reasoning + Structured Response

#### 3.1 — LLM Service (`llm_service.py`)

**What it does:** Takes ranked documents + conversation history + user query → builds a precise RAG prompt → calls Groq Llama-3.1-70b → parses structured output

**Prompt Architecture:**

```
SYSTEM PROMPT:
You are CuraLink, an AI Medical Research Assistant. You provide 
research-backed medical information based ONLY on the provided 
publications and clinical trials. You never hallucinate. Every 
claim must reference a specific source.

CONTEXT (Previous Conversation):
[Turn 1] User: "Latest treatment for lung cancer"
[Turn 1] CuraLink: "Based on studies... [summary]"
[Turn 2] User: "Can I take Vitamin D?" ← Current query

RETRIEVED PUBLICATIONS (Top 6):
[1] Title: "Vitamin D supplementation in lung cancer patients..."
    Authors: Smith et al. (2023)
    Abstract: "...showed 23% improvement in..."
    Source: PubMed | PMID: 41732954

[2] Title: "...

RETRIEVED CLINICAL TRIALS (Top 4):
[1] Title: "Vitamin D3 Supplementation in Advanced NSCLC"
    Status: RECRUITING
    Location: Toronto General Hospital, Toronto, Canada
    Eligibility: Adults 18+, diagnosed with stage III/IV NSCLC

USER QUERY: Can I take Vitamin D?
DISEASE CONTEXT: Lung cancer (from conversation history)
LOCATION: Toronto, Canada

INSTRUCTIONS:
Generate a structured response with EXACTLY these sections:
1. CONDITION_OVERVIEW: Brief context about the condition
2. RESEARCH_INSIGHTS: Key findings from the publications above
3. CLINICAL_TRIALS: Relevant trials, especially near {location}
4. RECOMMENDATION: Evidence-based, non-prescriptive guidance
5. SOURCES: Full citation for every claim made

Format as JSON.
```

#### 3.2 — Response Schema

```python
class CuralinkResponse(BaseModel):
    conditionOverview: str
    researchInsights: list[ResearchInsight]
    clinicalTrials: list[ClinicalTrialResult]
    recommendation: str
    sources: list[Source]
    metadata: ResponseMetadata

class ResearchInsight(BaseModel):
    finding: str
    supportingEvidence: str
    sourceId: str

class Source(BaseModel):
    title: str
    authors: list[str]
    year: int
    platform: str  # "PubMed" | "OpenAlex"
    url: str
    snippet: str   # Key supporting sentence
```

#### 3.3 — Full Pipeline Endpoint

```
POST /pipeline/query
Body: {
  "query": string,
  "sessionId": string,
  "conversationHistory": Message[],
  "userProfile": { "disease": string, "location": string }
}
Response: CuralinkResponse
```

#### 3.4 — Phase 3 Testing

```bash
curl -X POST http://localhost:8000/pipeline/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "latest treatment for lung cancer",
    "sessionId": "test-123",
    "conversationHistory": [],
    "userProfile": {"disease": "lung cancer", "location": "Toronto, Canada"}
  }'
```

**Pass Criteria:**
- [ ] Response has all 5 structured sections
- [ ] Every research insight has a source citation
- [ ] Clinical trials filtered near Toronto
- [ ] No hallucinated facts (every claim traceable to retrieved docs)
- [ ] Follow-up turn correctly uses lung cancer context

---

### ✅ PHASE 4 — Node.js App Backend

#### 4.1 — Project Bootstrap
```bash
cd backend
npm init -y
npm install express mongoose jsonwebtoken bcryptjs axios cors dotenv express-rate-limit
npm install -D typescript @types/express @types/node ts-node nodemon
```

#### 4.2 — Auth Service

**Endpoints:**
```
POST /api/auth/register  → { name, email, password } → { user, accessToken }
POST /api/auth/login     → { email, password } → { user, accessToken }
GET  /api/auth/me        → (JWT) → { user }
```

**Implementation:**
- Passwords hashed with bcrypt (12 salt rounds)
- JWT access token: 15min expiry
- JWT refresh token: 7 days, stored in httpOnly cookie
- Auth middleware validates Bearer token on protected routes

#### 4.3 — Chat Controller

**Endpoints:**
```
POST /api/chat                    → Send message, get AI response
GET  /api/chat/sessions           → List user's chat sessions
GET  /api/chat/sessions/:id       → Get session with all messages
DELETE /api/chat/sessions/:id     → Delete session
```

**POST /api/chat Flow:**
```
1. Validate JWT → get userId
2. Find or create Session document for sessionId
3. Save user's Message to MongoDB
4. Load last N=10 messages from session (conversation context)
5. Call Python AI Engine: POST {AI_ENGINE_URL}/pipeline/query
   with { query, sessionId, conversationHistory, userProfile }
6. Receive CuralinkResponse from Python
7. Save assistant's Message to MongoDB (with structuredResponse)
8. Return CuralinkResponse to frontend
```

#### 4.4 — Context Service (`contextService.ts`)

```typescript
// Builds conversation history for Python AI Engine
async function buildConversationContext(sessionId: string, limit = 10) {
  const messages = await Message.find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  
  return messages.reverse().map(m => ({
    role: m.role,
    content: m.content,
    metadata: m.metadata
  }));
}
```

This is the **critical context preservation mechanism** — ensures follow-up questions like "Can I take Vitamin D?" retain the lung cancer context.

#### 4.5 — Phase 4 Testing

```bash
# Test auth
curl -X POST http://localhost:5000/api/auth/register \
  -d '{"name": "John", "email": "john@test.com", "password": "test1234"}'

# Test chat
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer {token}" \
  -d '{"query": "Latest treatment for lung cancer", "location": "Toronto"}'
```

**Pass Criteria:**
- [ ] JWT auth works correctly
- [ ] Messages persisted in MongoDB
- [ ] Conversation context passed to Python correctly
- [ ] Full round-trip response received and stored
- [ ] Session history retrievable

---

### ✅ PHASE 5 — React Frontend

#### 5.1 — Project Bootstrap
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install axios zustand react-query react-router-dom
npm install -D tailwindcss postcss autoprefixer
```

#### 5.2 — Design System
**Theme:** Dark, medical-grade aesthetic — deep navy/slate background, cyan/teal accents, glassmorphism cards

**Color Palette:**
```css
--bg-primary: #0a0f1e
--bg-secondary: #0f172a
--bg-card: rgba(15, 23, 42, 0.8)
--accent-primary: #06b6d4    /* cyan-500 */
--accent-secondary: #8b5cf6  /* violet-500 */
--text-primary: #f1f5f9
--text-secondary: #94a3b8
--border: rgba(148, 163, 184, 0.1)
--success: #10b981
--warning: #f59e0b
```

#### 5.3 — Key Components

**ChatWindow.tsx:**
- Scrollable message history
- Auto-scroll to latest
- Timestamps on messages
- Streaming text animation

**MessageBubble.tsx:**
- User messages: right-aligned, accent color
- Assistant messages: left-aligned, glass card
- Structured response renderer for AI replies

**StructuredResponse.tsx (Critical Component):**
- Renders the 5-section AI response:
  1. **Condition Overview** — highlighted banner
  2. **Research Insights** — expandable bullet points with inline source refs
  3. **Publications Grid** — card grid with Title, Authors, Year, Platform badge, Link
  4. **Clinical Trials** — list with Status badge (green=RECRUITING, gray=COMPLETED), Location, Eligibility
  5. **Sources Panel** — numbered citation list, each with full attribution

**Sidebar.tsx:**
- Session history list
- Create new chat
- Delete session
- Search sessions

#### 5.4 — Phase 5 Testing

```bash
npm run dev
# Manual test checklist:
```

**Pass Criteria:**
- [ ] Login/register flow works
- [ ] Chat sends message and renders structured response
- [ ] Publications grid renders with correct data
- [ ] Clinical trials render with status badge
- [ ] Sources panel shows full citations with links
- [ ] Follow-up message retains disease context
- [ ] New session vs continuing session works
- [ ] Session sidebar shows history
- [ ] Mobile responsive

---

### ✅ PHASE 6 — Deployment

#### 6.1 — MongoDB Atlas
- Create free M0 cluster
- Add connection string to backend `.env`
- Whitelist `0.0.0.0/0` for Render IPs

#### 6.2 — Python AI Engine → Render
```
# render.yaml (ai-engine)
services:
  - type: web
    name: curalink-ai-engine
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GROQ_API_KEY
        sync: false
```

> ⚠️ Free Render tier spins down after 15min inactivity. Add a keep-alive ping from Node.js backend.

#### 6.3 — Node.js Backend → Render
```
buildCommand: npm install && npm run build
startCommand: node dist/app.js
envVars:
  - MONGODB_URI
  - JWT_SECRET
  - AI_ENGINE_URL (Render URL of Python service)
  - CLIENT_URL (Vercel URL of frontend)
```

#### 6.4 — React Frontend → Vercel
```bash
cd frontend
vercel --prod
# Set env: VITE_API_URL = Render Node.js URL
```

---

## 8️⃣ ENVIRONMENT VARIABLES

### `ai-engine/.env`
```
GROQ_API_KEY=gsk_...
PUBMED_TOOL=curalink
PUBMED_EMAIL=your@email.com
MODEL_NAME=llama-3.1-70b-versatile
```

### `backend/.env`
```
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
AI_ENGINE_URL=https://curalink-ai-engine.onrender.com
CLIENT_URL=https://curalink.vercel.app
```

### `frontend/.env`
```
VITE_API_URL=https://curalink-backend.onrender.com
```

---

## 9️⃣ EVALUATION ALIGNMENT

| Judge's Criterion | How We Nail It |
|---|---|
| 🧠 AI pipeline quality | 6-step RAG pipeline: expand → fetch → embed → rank → prompt → structure |
| 🔍 Retrieval + ranking accuracy | 300 docs retrieved, BM25+semantic hybrid ranking, top 6–8 shown |
| ⚙️ Engineering depth | 3 separate microservices, TypeScript, proper schemas, context management |
| 🎯 Usability | Premium dark UI, streaming responses, session history, source attribution |
| 🎥 Demo clarity | Structured outputs make demo self-explanatory — every section visible |

---

## 🔟 BUILD ORDER SUMMARY

```
Phase 1: Python Data Fetchers          [Test: raw data quality]
   ↓
Phase 2: Embedding + Hybrid Ranking    [Test: ranked top 6-8 results]
   ↓
Phase 3: LLM Reasoning + Structured Output   [Test: full AI response]
   ↓
Phase 4: Node.js Backend (Auth + Context + Proxy)  [Test: API round-trip]
   ↓
Phase 5: React Frontend (Chat UI + Result Rendering)  [Test: full E2E]
   ↓
Phase 6: Deploy (AI Engine → Render, Backend → Render, Frontend → Vercel)
```

**Start with Phase 1 the moment you approve this plan.**
