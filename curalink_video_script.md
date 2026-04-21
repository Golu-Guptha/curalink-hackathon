# 🎬 CuraLink — Video Presentation Script
### "AI Medical Research Assistant" | Hackathon Demo

---

> **Estimated Duration:** 4–6 minutes  
> **Tone:** Confident, professional, storytelling-first  
> **Format:** Script (spoken words) + [SCREEN: what to show]

---

## 🖥️ OPENING — Tech Stack Slide (0:00–0:40)

**[SCREEN: Show a clean slide or your screen with these logos arranged neatly]**
```
Frontend:   React + Vite
Backend:    Node.js + Express + MongoDB Atlas + JWT Auth
AI Engine:  Python FastAPI (microservice)
LLM:        Groq Cloud — Llama 3.1 70B (via API rotation)
Data:       PubMed · OpenAlex · ClinicalTrials.gov
Ranking:    BM25 + TF-IDF Cosine + Recency + Citation scoring
Hosting:    Render (AI engine + backend) · Vercel (frontend)
```

**[SPEAK]**

> "Before we dive in — here's the full tech stack powering CuraLink.
> A React frontend, a Node.js backend with JWT authentication and MongoDB,
> and a completely separate Python FastAPI AI engine — three independent
> microservices communicating through REST APIs.
> The AI engine pulls live data from three real biomedical databases,
> ranks it using a custom hybrid algorithm, and then reasons over it
> using Meta's Llama 3.1 70B model via the Groq inference API.
> Everything is deployed and live. Let's see it in action."

---

## 🎯 SECTION 1 — The Problem (0:40–1:10)

**[SCREEN: Stay on landing page / home screen of CuraLink — the hero with the search bar]**

**[SPEAK]**

> "Every day, doctors, researchers, and patients face the same challenge —
> there are millions of medical research papers, clinical trials, and studies
> published every year. Finding the right, most relevant, most recent evidence
> for a specific condition is an overwhelming task.
>
> CuraLink solves this. It's not just a search engine — it's an AI research
> assistant that reads, ranks, synthesises, and explains biomedical evidence
> in real time, from three live data sources simultaneously."

---

## 🔍 SECTION 2 — First Query (1:10–2:10)

**[SCREEN: Type a query in the chat — e.g., "What immunotherapy advances exist for cancer?"]**
**[SCREEN: Show the Live Pipeline animation loading — the dots/steps firing one by one]**

**[SPEAK]**

> "Let's ask about cancer immunotherapy. Watch what happens in the background.
> The AI engine first expands our query — generating intelligent search variations
> using an LLM call, understanding medical terminology and intent.
> Then simultaneously it fires requests to PubMed, OpenAlex, and ClinicalTrials.gov —
> all in parallel. It pulls back over 100 candidates."

**[SCREEN: Pipeline finishes — Research Analysis panel slides open]**

> "Then our custom hybrid ranking algorithm scores every paper
> using four signals — keyword relevance, semantic relevance, recency,
> and citation count — to surface the most trustworthy, most current evidence.
> Finally, the Llama 3.1 70B model synthesises all of this into a structured,
> source-attributed analysis."

---

## 📊 SECTION 3 — Research Results Walkthrough (2:10–3:30)

**[SCREEN: Overview Tab — show the condition overview, key insight, recommendation chips]**

**[SPEAK]**

> "The Overview tab gives an instant synthesis — condition background,
> the most important takeaway, and a clinical recommendation.
> All grounded in the papers it actually retrieved."

**[SCREEN: Click "Deep Analysis" tab — show the Evidence Meter, supporting vs contradicting evidence]**

> "Deep Analysis shows the AI doing something unusual — it doesn't just present
> one side. It maps supporting evidence against contradicting evidence,
> computes an agreement score, and then arrives at a verdict.
> This is critical thinking, not just content retrieval."

**[SCREEN: Click "Disease Guide" tab — show the stage timeline, then expand one stage to see Diet/Exercise/Lifestyle cards]**

> "The Disease Guide is where CuraLink goes further than any research tool
> I've seen. For each disease stage, it generates evidence-based guidance —
> what to eat and *why* at the molecular level, which exercises help
> and *why physiologically*, lifestyle adjustments ranked by clinical impact.
> Not generic advice — science-backed reasoning for every recommendation."

**[SCREEN: Click "Insights" tab — show the confidence cards]**

> "Research Insights extracts individual findings across all papers,
> shows the study type, confidence level, and supporting evidence.
> Each insight is traceable — not hallucinated."

**[SCREEN: Click "Publications" tab — show the ranked cards with relevance %, citation count, match reasons]**

> "And every publication is ranked with a transparency score — you can see
> *why* each paper was selected, its relevance percentage, citation count,
> publication year, and direct links to the source."

---

## ⚡ SECTION 4 — Quick AI Chat (3:30–4:10)

**[SCREEN: Click the "⚡ Ask AI" button in the header — modal pops open with spring animation]**

**[SPEAK]**

> "We also built a contextual quick chat — you can ask follow-up questions
> directly about any section of the research results."

**[SCREEN: Select "Disease Guide" chip, type: "Why should I avoid high-intensity exercise in early stages?"]**
**[SCREEN: Show the typing indicator → then the AI response appears]**

> "The AI answers with full context from the disease guide you're viewing —
> grounded, specific, not generic. It's like having a research assistant
> sitting next to you as you read."

---

## 💬 SECTION 5 — Conversational Follow-ups (4:10–4:40)

**[SCREEN: Go back to the chat panel — type a follow-up like "What are the latest clinical trials recruiting for this?"]**
**[SCREEN: Show the context reuse bar — "Using research context: Cancer" dropdown]**

**[SPEAK]**

> "The conversation is stateful. CuraLink remembers the research context
> from your previous query — so follow-up questions are grounded in your
> specific research session, not starting from scratch.
> MongoDB persists your full chat history and research sessions,
> so you can come back and pick up where you left off."

---

## 🔐 SECTION 6 — Auth + Sessions (4:40–5:00)

**[SCREEN: Briefly show the sidebar with past sessions — "Parkinson Disease Research", "What immunotherapy advances..."]**

**[SPEAK]**

> "Full user authentication with JWT tokens. Every research session is saved,
> searchable, and resumable. Patients can track their research over time.
> Clinicians can build a library of condition-specific evidence."

---

## 🏁 CLOSING — Impact Statement (5:00–5:30)

**[SCREEN: Back to the home landing screen — hero shot of the interface]**

**[SPEAK]**

> "CuraLink isn't a chatbot. It's a full-stack, production-grade
> biomedical research engine — three live databases, a custom ranking
> pipeline, and a 70-billion parameter language model working together
> to make medical research accessible, transparent, and actionable.
>
> For researchers who need evidence fast.
> For clinicians who need trustworthy synthesis.
> For patients who deserve to understand their own health.
>
> This is CuraLink."

**[SCREEN: Freeze on the app — or fade out]**

---

## 🎙️ DELIVERY TIPS

| Tip | Detail |
|-----|--------|
| **Pace** | Speak slowly and clearly — medical terms need time to land |
| **Pauses** | Pause 1-2s after each section header before moving on |
| **Demo prep** | Pre-run a Cancer query before recording so results load instantly |
| **Mouse** | Move the cursor deliberately and slowly — don't rush clicks |
| **Highlight** | Use your mouse to hover over interesting UI elements while speaking about them |
| **Background** | Use a dark room / dark background — the dark UI looks stunning |
| **Resolution** | Record at 1080p minimum — the glass-morphism design needs sharpness |

---

## ✅ CHECKLIST BEFORE RECORDING

- [ ] Open the deployed app (not localhost) — shows live deployment
- [ ] Log in with a test account that already has 2-3 sessions in sidebar
- [ ] Pre-type "What immunotherapy advances exist for cancer?" — ready to send
- [ ] Have Disease Guide results cached to avoid wait times on camera
- [ ] Scroll positions rehearsed for each tab
- [ ] Tech stack slide ready (first screen)
