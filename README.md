# 01 — RAG Knowledge Bot

Chatbot de **recherche documentaire** avec citations sourcées.

## Pipeline

```
Documents (PDF, MD, HTML)
        │
        ▼
   ┌─────────┐
   │ Chunking │  ← découpe sémantique / overlapping
   └────┬────┘
        ▼
   ┌───────────┐
   │ Embeddings│  ← modèle d'embedding (ex. text-embedding-3)
   └─────┬─────┘
         ▼
   ┌──────────┐
   │  Qdrant  │  ← index vectoriel
   └────┬─────┘
        │  query → top-k chunks
        ▼
   ┌──────────────────┐
   │ Prompt système   │  ← contexte + question + consignes de citation
   └────────┬─────────┘
            ▼
         Réponse + citations [source, page]
```

## Structure

```
01-rag-knowledge-bot/
├── backend/     # API FastAPI + pipeline d'ingestion
├── frontend/    # Widget web léger (React/TypeScript) intégrable en <script>
└── README.md
```

## Concepts clés

| Étape        | Rôle                                              |
|--------------|---------------------------------------------------|
| Chunking     | Découper les docs en segments récupérables        |
| Embeddings   | Représentation vectorielle pour la similarité     |
| Retrieval    | Top-k chunks les plus proches de la question      |
| Prompt       | Injecter le contexte + imposer les citations      |
| Citations    | Lier chaque affirmation à une source vérifiable   |

## Prérequis

- Docker & Docker Compose (Qdrant)
- Python 3.11+
- Node.js 20+
- [Ollama](https://ollama.com) installé et démarré (`ollama serve`)

## Installation

### 1. Qdrant

Depuis ce projet (`01-rag-knowledge-bot/`) :

```bash
docker compose up -d qdrant
```

API Qdrant : `http://127.0.0.1:6333`

### 2. Modèles Ollama

```bash
ollama pull qwen3-embedding:0.6b
ollama pull qwen-local:latest
# ou un autre modèle chat compatible, ex. :
# ollama pull mistral:7b-instruct-q4_0
```

Vérifier : `ollama list` puis `curl http://127.0.0.1:11434/api/tags`

### 3. Backend (FastAPI)

```bash
cd 01-rag-knowledge-bot/backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

Copier l’exemple d’env puis adapter si besoin :

```bash
cp .env.example .env
```

Variables (voir aussi `.env.example`) :

```env
EMBEDDINGS_BASE_URL=http://127.0.0.1:11434/v1
EMBEDDINGS_API_KEY=ollama
EMBEDDINGS_MODEL=qwen3-embedding:0.6b

QDRANT_URL=http://127.0.0.1:6333

LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_API_KEY=ollama
LLM_MODEL=qwen-local:latest
```

Lancer l’API **depuis `backend/`** :

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health check : `http://127.0.0.1:8000/health`  
Docs Swagger : `http://127.0.0.1:8000/docs`

### 4. Frontend (Vite + React)

```bash
cd 01-rag-knowledge-bot/frontend
npm install
npm run dev
```

Widget : `http://127.0.0.1:5173`  
Le proxy Vite redirige `/api` → `http://127.0.0.1:8000`.

## Utilisation rapide

1. Ouvrir le widget (pastille **Wilson**).
2. Joindre un fichier (PDF, MD, TXT, DOCX…) + poser une question → Send.
3. Le backend indexe le doc (chunk → embed → Qdrant), puis répond avec citations.

Sans fichier joint, la recherche porte sur **tous** les documents déjà indexés.
