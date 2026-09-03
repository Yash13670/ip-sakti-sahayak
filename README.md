# IP-SAKTI Sahayak

## AI-Powered Preliminary Intellectual Property & Traditional Knowledge Screening Assistant

IP-SAKTI Sahayak is an India-focused AI-assisted screening platform designed to help researchers, innovators, AYUSH practitioners, startups, and IP professionals perform preliminary Intellectual Property (IP) and Traditional Knowledge (TK) screening for Ayurveda and AYUSH formulations.

The platform combines legal document retrieval, semantic search, grounded AI responses, claim–evidence verification, citation validation, screening rules, risk classification, and multilingual access to provide an evidence-backed preliminary screening workflow.

> ⚠️ Disclaimer: IP-SAKTI Sahayak provides preliminary informational screening only. It does not constitute legal advice, a patentability opinion, freedom-to-operate opinion, or professional legal consultation.

---

## 🚀 Key Features

### 🔎 Intelligent Formulation Screening
- Structured formulation screening wizard
- Ingredient and formulation information extraction
- India / International jurisdiction routing
- Preliminary IP and Traditional Knowledge risk identification
- Evidence-backed screening results

### 📚 Hybrid Legal Evidence Retrieval
- BM25 lexical retrieval
- OpenRouter semantic embeddings
- 45% BM25 + 55% semantic score fusion
- Provision-aware evidence ranking
- Source and page metadata preservation

### 🤖 Grounded AI Legal Assistant
- Gemini-powered answer generation
- Responses grounded in retrieved legal evidence
- Source-aware explanations
- Claim extraction from generated responses

### ✅ Claim–Evidence Verification

IP-SAKTI does not consider a claim verified merely because a source exists.

Generated Claim
      ↓
Exact Supporting Evidence
      ↓
Source / Provision / Page
      ↓
Verification
      ↓
SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED

Verification includes:
- Support status
- Confidence
- Reason
- Evidence reference

### 🧾 Citation Validation
Validates whether generated citations correctly correspond to:
- Source document
- Legal provision
- Page information
- Retrieved evidence

### ⚖️ Screening Rules & Risk Classification
The system evaluates retrieved evidence against predefined screening rules and identifies cases requiring further review.

Example classifications:
- Low Risk
- Review Required
- High Attention / Expert Escalation

### 🌐 Multilingual Support
IP-SAKTI is designed to provide multilingual accessibility using Bhashini infrastructure.

Capabilities include:
- Neural Machine Translation (NMT)
- Automatic Speech Recognition (ASR)
- Text-to-Speech (TTS)
- Text Language Detection (TLD)

Bhashini acts as the language and voice layer, while legal retrieval, reasoning, and verification remain within the IP-SAKTI pipeline.

### 📊 Evidence & Retrieval Trace
Users can inspect:
- Retrieved evidence
- Source documents
- Relevance scores
- Retrieval stages
- Verification results
- Citation validation
- Screening decisions

### 👨‍⚖️ Expert Escalation
Cases requiring professional review can be flagged for expert/legal consultation.

---

## 🏗️ System Architecture

                         USER
                           │
                           ▼
              ┌────────────────────────┐
              │  IP-SAKTI Sahayak UI   │
              │  React + TypeScript    │
              └────────────┬───────────┘
                           │
                           ▼
                 Language / Voice Layer
                           │
                  ┌────────┴────────┐
                  │                 │
              Bhashini           English
            ASR / NMT / TTS
                  │                 │
                  └────────┬────────┘
                           ▼
                  Jurisdiction Router
                           │
                           ▼
              ┌────────────────────────┐
              │    Hybrid Retrieval    │
              ├────────────────────────┤
              │ BM25          45%      │
              │ Semantic      55%      │
              └────────────┬───────────┘
                           │
                           ▼
                   Evidence Selection
                           │
                           ▼
                 Gemini Grounded Answer
                           │
                           ▼
                    Claim Extraction
                           │
                           ▼
              Claim ↔ Evidence Verification
                           │
                           ▼
                   Citation Validation
                           │
                           ▼
                   Screening Rule Engine
                           │
                           ▼
                    Risk Classification
                           │
                    ┌──────┴──────┐
                    │             │
                  Report      Expert Review
                    │
                    ▼
                  Response

---

## 🧠 AI & Retrieval Pipeline

IP-SAKTI follows an evidence-first workflow:

1. Input Parsing
       ↓
2. Jurisdiction Routing
       ↓
3. BM25 Retrieval
       ↓
4. Semantic Retrieval
       ↓
5. Score Fusion
       ↓
6. Evidence Selection
       ↓
7. Grounded AI Generation
       ↓
8. Claim Extraction
       ↓
9. Claim–Evidence Verification
       ↓
10. Citation Validation
       ↓
11. Screening Rules
       ↓
12. Risk Classification
       ↓
13. Report / Next Step

### Retrieval Strategy

Final Retrieval Score =
0.45 × BM25 Score
+
0.55 × Semantic Similarity

Semantic embeddings use:

OpenRouter
└── openai/text-embedding-3-small
    └── 1536-dimensional embeddings

This hybrid approach balances:
- Exact legal terminology
- Section/provision matching
- Semantic similarity
- Domain-specific relevance

---

## 📖 Legal Knowledge Base

The prototype knowledge base contains real legal and regulatory documents, including:

- The Patents Act, 1970
- The Patents Rules, 2003
- The Biological Diversity Act, 2002
- Drugs and Cosmetics Act, 1940 and Rules, 1945
- Schedule T
- AYUSH guidelines
- Ayurvedic Pharmacopoeia of India (API)
- WIPO Treaty on Intellectual Property, Genetic Resources and Associated Traditional Knowledge, 2024
- Additional international and regulatory reference material

### Current Corpus

Documents  : 9
Chunks     : 1124
Embeddings : 1124
Dimension  : 1536
Failures   : 0

The system preserves document and page/provision metadata so retrieved evidence can be traced back to its source.

---

## 🔐 Security

Sensitive credentials are kept outside the repository.

Environment variables:

GEMINI_API_KEY=
OPENROUTER_API_KEY=

BHASHINI_USER_ID=
BHASHINI_ULCA_API_KEY=
BHASHINI_AUTH_KEY=

The following files/directories are excluded from Git:

.env
node_modules/
dist/
.gemini-embed-cache.json
.freebuff/

API credentials are intended to remain server-side and are never exposed to the frontend.

---

## 🛠️ Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Plotly
- WebSocket

### Backend
- Node.js
- serve.cjs
- REST API endpoints
- WebSocket support

### AI / ML
- Google Gemini
- OpenRouter
- openai/text-embedding-3-small
- BM25
- Semantic / vector retrieval

### Multilingual
- Bhashini
- NMT
- ASR
- TTS
- Language Detection

### Knowledge Base
- Legal and regulatory PDFs
- Chunked document corpus
- Metadata-aware retrieval
- Embedding cache

---

## 📁 Project Structure

ip-sakti-sahayak/
│
├── src/
│   ├── components/
│   ├── services/
│   │   ├── pipeline.ts
│   │   └── bhashini.ts
│   ├── store/
│   └── ...
│
├── serve.cjs
├── package.json
├── vite.config.*
├── .gitignore
├── README.md
│
└── Legal Corpus/
    ├── Patents Act
    ├── Patents Rules
    ├── Biological Diversity Act
    ├── Drugs & Cosmetics
    ├── Schedule T
    ├── AYUSH Guidelines
    ├── API
    ├── WIPO Treaty
    └── International References

---

## ⚙️ Local Setup

### 1. Clone the Repository

git clone https://github.com/Yash13670/ip-sakti-sahayak.git
cd ip-sakti-sahayak

### 2. Install Dependencies

npm install

### 3. Configure Environment Variables

Create a .env file in the project root:

GEMINI_API_KEY=your_gemini_key
OPENROUTER_API_KEY=your_openrouter_key

BHASHINI_USER_ID=your_bhashini_user_id
BHASHINI_ULCA_API_KEY=your_bhashini_ulca_key
BHASHINI_AUTH_KEY=your_bhashini_auth_key

> Never commit .env or expose API keys in frontend code.

### 4. Start Development

npm run dev

---

## 🚀 Production Build

Build the frontend:

npm run build

Start the production server:

node serve.cjs

The Node.js server serves the built frontend and backend API routes.

For cloud deployment:

Build Command:
npm run build

Start Command:
node serve.cjs

The application should use the hosting platform's PORT environment variable in production.

---

## 🔌 API Architecture

### Gemini

/api/gemini/*

Used for:
- Grounded answer generation
- Claim extraction
- Claim–evidence verification

### OpenRouter

/api/openrouter/status
/api/openrouter/embed
/api/openrouter/embed-batch

Used for:
- Semantic embeddings
- Vector retrieval

### Bhashini

/api/bhashini/status
/api/bhashini/translate
/api/bhashini/stt
/api/bhashini/tts
/api/bhashini/detect-language

Used for:
- Translation
- Speech-to-text
- Text-to-speech
- Language detection

---

## 🧪 Verification Philosophy

IP-SAKTI Sahayak follows a strict evidence-first principle.

The system does not assume:

Source Exists
     ≠
Claim Verified

Instead:

Generated Claim
      ↓
Retrieved Passage
      ↓
Exact Evidence Matching
      ↓
Verification
      ↓
Confidence + Reason

Possible verification outcomes:

SUPPORTED
PARTIALLY_SUPPORTED
UNSUPPORTED

This helps reduce unsupported AI-generated legal assertions and makes the screening process more transparent.

---

## 🎯 Target Users

IP-SAKTI Sahayak is designed for:

- AYUSH researchers
- Ayurveda practitioners
- Traditional Knowledge researchers
- Startups and innovators
- Students and academic researchers
- IP consultants
- Legal professionals
- Organizations performing preliminary IP screening

---

## 🌍 Vision

India possesses a vast body of Traditional Knowledge and innovation.

IP-SAKTI Sahayak aims to make preliminary IP and Traditional Knowledge screening:

Accessible → Evidence-Based → Explainable → Multilingual → India-Focused

The long-term vision is to build a trustworthy AI-assisted layer that helps users identify potential IP and Traditional Knowledge concerns before moving toward formal professional or legal processes.

---

## 🏆 Smart India Hackathon

### IP-SAKTI Sahayak

The platform is designed around the challenge of improving accessibility to preliminary Intellectual Property and Traditional Knowledge screening for Indian innovations, particularly in the AYUSH ecosystem.

### Key Focus Areas

- 🇮🇳 India-focused legal knowledge
- 📚 Evidence-backed retrieval
- 🤖 Responsible AI
- 🌐 Multilingual accessibility
- 🧾 Transparent citations
- 🔍 Claim-level verification
- 👨‍⚖️ Expert escalation

---

## 🔭 Future Roadmap

### Phase 1 — SIH MVP
- Legal source ingestion
- Hybrid BM25 + semantic retrieval
- Citation verification
- India / International routing
- Preliminary screening reports
- Multilingual interface foundation

### Phase 2 — Enhanced Intelligence
- Expanded legal corpus
- Improved multilingual workflows
- Voice-first screening
- More advanced prior-art discovery
- Better expert escalation workflows

### Phase 3 — Scalable Platform
- Larger knowledge ecosystem
- Advanced evidence graphs
- Institutional dashboards
- Continuous corpus updates
- Enterprise / research integrations

---

## ⚠️ Important Disclaimer

IP-SAKTI Sahayak is an AI-assisted preliminary screening system.

It does NOT:

- Grant or guarantee patent rights
- Determine final patentability
- Provide legal advice
- Replace a patent attorney or qualified IP professional
- Guarantee freedom-to-operate
- Guarantee acceptance or rejection by any IP authority

All results should be independently reviewed by a qualified professional before legal, commercial, or regulatory decisions are made.

---

## 📄 License

This repository is intended for educational, research, and hackathon purposes.

Please review the licensing and usage requirements of the underlying legal documents, datasets, APIs, models, and third-party services before commercial use.

---

# 🇮🇳 Built for India

## IP-SAKTI Sahayak

### Evidence Before Assertion.

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
