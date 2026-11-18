from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from ingestion import ingest_document
import uuid
from db import init_db, get_connection, UPLOADS_DIR
from chat import answer_with_rag
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # TODO: ping Qdrant / créer collection si absent
    yield
    # TODO: fermer connexions

app = FastAPI(
    title="RAG Knowledge Bot",
    description="A RAG knowledge bot",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/v1/documents")
async def create_document(file: UploadFile = File(...)):
    doc_id = str(uuid.uuid4())
    filename = file.filename
    content = await file.read()
    
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOADS_DIR / f"{doc_id}.{filename}"
    dest.write_bytes(content)

    created_at = datetime.now().isoformat()
    conn = get_connection()
    conn.execute("""
    INSERT INTO documents (id, filename, content_type, size_bytes, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (doc_id, filename, file.content_type, len(content), created_at))
    conn.commit()
    conn.close()

    status = "pending"
    chunks_count = 0
    error_message = None
    try:
        chunks_count = ingest_document(dest, doc_id, filename or "untitled")
        status = "indexed"
        conn = get_connection()
        conn.execute(
            "UPDATE documents SET status = ?, chunks_count = ?, error_message = NULL WHERE id = ?",
            (status, chunks_count, doc_id),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        status = "error"
        error_message = str(e)
        conn = get_connection()
        conn.execute(
            "UPDATE documents SET status = ?, error_message = ? WHERE id = ?",
            (status, error_message, doc_id),
        )
        conn.commit()
        conn.close()

    return {
        "id": doc_id,
        "filename": filename,
        "status": status,
        "size_bytes": len(content),
        "chunks_count": chunks_count,
        "error_message": error_message,
    }

@app.get("/api/v1/documents")
async def get_documents():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, filename, status, chunks_count, created_at, error_message FROM documents ORDER BY created_at DESC"
        ).fetchall()
    conn.close()
    return {"documents": [dict(row) for row in rows]}

@app.delete("/api/v1/documents/{document_id}")
async def delete_document(document_id: str):
    conn = get_connection()
    row = conn.execute("SELECT filename FROM documents WHERE id = ?", (document_id,)).fetchone()
    if row is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")
    
    conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    conn.commit()
    conn.close()

    dest = UPLOADS_DIR / f"{document_id}.{row['filename']}"
    if dest.exists():
        dest.unlink()
    return {"success": True}

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    top_k: int = 5
    document_ids: list[str] | None = None

@app.post("/api/v1/chat")
async def chat(body: ChatRequest):
    return answer_with_rag(
        body.message,
        top_k=body.top_k,
        document_ids=body.document_ids,
    )