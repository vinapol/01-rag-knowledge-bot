import os
from openai import OpenAI
from dotenv import load_dotenv
from qdrant_client.http.models import Filter, FieldCondition, MatchAny
from ingestion import embed_texts, get_qdrant, COLLECTION

load_dotenv()

def get_llm_client() -> OpenAI:
    return OpenAI(
        base_url=os.getenv("LLM_BASE_URL"),
        api_key=os.getenv("LLM_API_KEY", "not-needed"),
    )

def search_chunks(
    query: str,
    top_k: int = 5,
    document_ids: list[str] | None = None,
) -> list[dict]:
    vector = embed_texts([query])[0]
    client = get_qdrant()
    query_filter = None
    if document_ids:
        query_filter = Filter(
            must=[FieldCondition(key="doc_id", match=MatchAny(any=document_ids))]
        )

    # Scoped uploads: pull more chunks and skip score cutoff so vague
    # questions ("what's in this file?") still cover the attached docs.
    limit = max(top_k, 10) if document_ids else top_k
    results = client.query_points(
        collection_name=COLLECTION,
        query=vector,
        limit=limit,
        score_threshold=None if document_ids else 0.5,
        query_filter=query_filter,
        with_payload=True,
    )
    return [
        {
            "text": (hit.payload or {}).get("text", ""),
            "filename": (hit.payload or {}).get("filename"),
            "chunk_index": (hit.payload or {}).get("chunk_index"),
            "doc_id": (hit.payload or {}).get("doc_id"),
            "score": hit.score,
        }
        for hit in results.points
    ]

SYSTEM_PROMPT = """Tu es Wilson, assistant RAG multi-documents. Tu réponds UNIQUEMENT à partir des EXTRAITS fournis (tous types : CV, README, notes, rapports, etc.).

Règles strictes :
1. N'utilise que les faits explicitement écrits dans les EXTRAITS. Aucune invention.
2. N'ajoute aucune entité, date, chiffre, titre ou détail absent du texte.
3. N'amplifie pas et ne reformule pas de façon trompeuse.
4. Conserve noms propres, dates et chiffres tels quels.
5. Si une info manque : "Non précisé dans les extraits."
6. Réponds en français, concis ; utilise des puces pour les synthèses.
7. Pour une question large ("que contient ce fichier / ces documents ?"), résume les thèmes et faits principaux présents dans les extraits, organisés selon le contenu réel (pas une grille fixe).
8. Si plusieurs sources, distingue-les clairement et cite [n] après les faits importants.
9. Si hors-sujet ou vide : "Je ne trouve pas cette information dans les documents fournis."
"""

def answer_with_rag(
    message: str,
    top_k: int = 5,
    document_ids: list[str] | None = None,
) -> dict:
    chunks = search_chunks(message, top_k=top_k, document_ids=document_ids)
    if not chunks:
        return {
            "answer": "Je ne trouve pas cette information dans les documents fournis.",
            "citations": [],
        }

    context = "\n\n".join(
        f"[{i + 1}] Source: {c['filename']}\n{c['text']}"
        for i, c in enumerate(chunks)
    )
    user = (
        f"EXTRAITS:\n{context}\n\n"
        f"QUESTION:\n{message}\n\n"
        "Réponds en t'appuyant uniquement sur les EXTRAITS ci-dessus."
    )

    client = get_llm_client()
    resp = client.chat.completions.create(
        model=os.getenv("LLM_MODEL"),
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
    )
    return {
        "answer": resp.choices[0].message.content,
        "citations": [
            {
                "id": i + 1,
                "source": c["filename"],
                "chunk_index": c["chunk_index"],
                "excerpt": c["text"][:200],
                "score": c["score"],
            }
            for i, c in enumerate(chunks)
        ],
    }
