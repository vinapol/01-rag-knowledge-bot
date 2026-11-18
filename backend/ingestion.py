from pathlib import Path
import os
from openai import OpenAI
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, PointStruct, VectorParams
from uuid import uuid4

load_dotenv()

COLLECTION = "documents"
QDRANT_URL = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")

def get_qdrant() -> QdrantClient:
    return QdrantClient(url=QDRANT_URL)

def ensure_collection(vector_size: int) -> None:
    client = get_qdrant()
    names = {c.name for c in client.get_collections().collections}
    if COLLECTION not in names:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )

def upsert_chunks(
    doc_id: str,
    filename: str,
    chunks: list[str],
    vectors: list[list[float]],
    conversation_id: str | None = None,
) -> int:
    if len(chunks) != len(vectors):
        raise ValueError("Number of chunks and vectors must be the same")
    if not vectors:
        return 0

    ensure_collection(len(vectors[0]))
    client = get_qdrant()
    points = [
        PointStruct(
            id=str(uuid4()),
            vector=vector,
            payload={
                "doc_id": doc_id,
                "filename": filename,
                "chunk_index": i,
                "text": chunk,
                "conversation_id": conversation_id,
            },
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    client.upsert(collection_name=COLLECTION, points=points)
    return len(points)

def get_embeddings_client() -> OpenAI:
    return OpenAI(
        base_url=os.getenv("EMBEDDINGS_BASE_URL"),
        api_key=os.getenv("EMBEDDINGS_API_KEY", "not-needed"),
    )

def embed_texts(texts: list[str]) -> list[list[float]]:
    client = get_embeddings_client()
    model = os.getenv("EMBEDDINGS_MODEL")
    resp = client.embeddings.create(model=model, input=texts)

    return [item.embedding for item in sorted(resp.data, key=lambda x: x.index)]

def _original_name(path: Path) -> str:
    # Upload path is "{doc_id}.{original_filename}"
    name = path.name
    if "." in name:
        return name.split(".", 1)[1]
    return name

def read_text(path: Path) -> str:
    original = _original_name(path).lower()
    if original.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        pages = [(page.extract_text() or "") for page in reader.pages]
        return "\n".join(pages).strip()

    if original.endswith(".docx"):
        from docx import Document

        doc = Document(str(path))
        return "\n".join(p.text for p in doc.paragraphs if p.text).strip()

    # .md, .txt, .csv, .json, .log, etc.
    return path.read_text(encoding="utf-8", errors="ignore").strip()

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    text = " ".join(text.split())
    if not text:
        return []
    
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks

def ingest_document(
    path: Path,
    doc_id: str,
    filename: str,
    conversation_id: str | None = None,
) -> int:
    text = read_text(path)
    chunks = chunk_text(text)
    if not chunks:
        return 0
    vectors = embed_texts(chunks)
    return upsert_chunks(
        doc_id,
        filename,
        chunks,
        vectors,
        conversation_id=conversation_id,
    )
