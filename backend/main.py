from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from ingestion import ingest_document
import json
import uuid
from db import init_db, get_connection, UPLOADS_DIR
from chat import answer_with_rag


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


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


def _now() -> str:
    return datetime.now().isoformat()


def _get_conversation(conn, conversation_id: str):
    return conn.execute(
        "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?",
        (conversation_id,),
    ).fetchone()


def _conversation_document_ids(conn, conversation_id: str) -> list[str]:
    rows = conn.execute(
        """
        SELECT id FROM documents
        WHERE conversation_id = ? AND status = 'indexed'
        ORDER BY created_at ASC
        """,
        (conversation_id,),
    ).fetchall()
    return [row["id"] for row in rows]


def _save_message(
    conn,
    conversation_id: str,
    role: str,
    content: str,
    attachments: list | None = None,
    citations: list | None = None,
) -> dict:
    msg_id = str(uuid.uuid4())
    created_at = _now()
    conn.execute(
        """
        INSERT INTO messages
        (id, conversation_id, role, content, attachments_json, citations_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            msg_id,
            conversation_id,
            role,
            content,
            json.dumps(attachments) if attachments else None,
            json.dumps(citations) if citations else None,
            created_at,
        ),
    )
    conn.execute(
        "UPDATE conversations SET updated_at = ? WHERE id = ?",
        (created_at, conversation_id),
    )
    return {
        "id": msg_id,
        "role": role,
        "content": content,
        "attachments": attachments,
        "citations": citations,
        "created_at": created_at,
    }


def _serialize_message(row) -> dict:
    return {
        "id": row["id"],
        "role": row["role"],
        "content": row["content"],
        "attachments": json.loads(row["attachments_json"]) if row["attachments_json"] else None,
        "citations": json.loads(row["citations_json"]) if row["citations_json"] else None,
        "created_at": row["created_at"],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


class CreateConversationRequest(BaseModel):
    title: str | None = None


@app.get("/api/v1/conversations")
async def list_conversations():
    conn = get_connection()
    rows = conn.execute(
        """
        SELECT id, title, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC
        """
    ).fetchall()
    conn.close()
    return {"conversations": [dict(row) for row in rows]}


@app.post("/api/v1/conversations")
async def create_conversation(body: CreateConversationRequest | None = None):
    conversation_id = str(uuid.uuid4())
    now = _now()
    title = (body.title.strip() if body and body.title else "") or "Nouvelle conversation"
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        """,
        (conversation_id, title, now, now),
    )
    conn.commit()
    conn.close()
    return {
        "id": conversation_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
    }


@app.get("/api/v1/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    conn = get_connection()
    conversation = _get_conversation(conn, conversation_id)
    if conversation is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = conn.execute(
        """
        SELECT id, role, content, attachments_json, citations_json, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        """,
        (conversation_id,),
    ).fetchall()
    documents = conn.execute(
        """
        SELECT id, filename, status, chunks_count, created_at, error_message
        FROM documents
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        """,
        (conversation_id,),
    ).fetchall()
    conn.close()
    return {
        "conversation": dict(conversation),
        "messages": [_serialize_message(row) for row in messages],
        "documents": [dict(row) for row in documents],
    }


@app.delete("/api/v1/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    conn = get_connection()
    conversation = _get_conversation(conn, conversation_id)
    if conversation is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    docs = conn.execute(
        "SELECT id, filename FROM documents WHERE conversation_id = ?",
        (conversation_id,),
    ).fetchall()
    conn.execute("DELETE FROM messages WHERE conversation_id = ?", (conversation_id,))
    conn.execute("DELETE FROM documents WHERE conversation_id = ?", (conversation_id,))
    conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()

    for doc in docs:
        dest = UPLOADS_DIR / f"{doc['id']}.{doc['filename']}"
        if dest.exists():
            dest.unlink()

    return {"success": True}


@app.post("/api/v1/documents")
async def create_document(
    file: UploadFile = File(...),
    conversation_id: str = Form(...),
):
    conn = get_connection()
    conversation = _get_conversation(conn, conversation_id)
    if conversation is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    doc_id = str(uuid.uuid4())
    filename = file.filename
    content = await file.read()

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    dest = UPLOADS_DIR / f"{doc_id}.{filename}"
    dest.write_bytes(content)

    created_at = _now()
    conn.execute(
        """
        INSERT INTO documents
        (id, filename, content_type, size_bytes, created_at, conversation_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (doc_id, filename, file.content_type, len(content), created_at, conversation_id),
    )
    conn.commit()

    status = "pending"
    chunks_count = 0
    error_message = None
    try:
        chunks_count = ingest_document(
            dest,
            doc_id,
            filename or "untitled",
            conversation_id=conversation_id,
        )
        status = "indexed"
        conn.execute(
            "UPDATE documents SET status = ?, chunks_count = ?, error_message = NULL WHERE id = ?",
            (status, chunks_count, doc_id),
        )
        conn.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?",
            (_now(), conversation_id),
        )
        conn.commit()
    except Exception as e:
        status = "error"
        error_message = str(e)
        conn.execute(
            "UPDATE documents SET status = ?, error_message = ? WHERE id = ?",
            (status, error_message, doc_id),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "id": doc_id,
        "filename": filename,
        "status": status,
        "size_bytes": len(content),
        "chunks_count": chunks_count,
        "error_message": error_message,
        "conversation_id": conversation_id,
    }


@app.get("/api/v1/documents")
async def get_documents(conversation_id: str | None = None):
    conn = get_connection()
    if conversation_id:
        rows = conn.execute(
            """
            SELECT id, filename, status, chunks_count, created_at, error_message, conversation_id
            FROM documents
            WHERE conversation_id = ?
            ORDER BY created_at DESC
            """,
            (conversation_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT id, filename, status, chunks_count, created_at, error_message, conversation_id
            FROM documents
            ORDER BY created_at DESC
            """
        ).fetchall()
    conn.close()
    return {"documents": [dict(row) for row in rows]}


@app.delete("/api/v1/documents/{document_id}")
async def delete_document(document_id: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT filename FROM documents WHERE id = ?",
        (document_id,),
    ).fetchone()
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


class ChatAttachmentIn(BaseModel):
    id: str
    filename: str


class ChatRequest(BaseModel):
    message: str
    conversation_id: str
    top_k: int = 5
    attachments: list[ChatAttachmentIn] | None = None


@app.post("/api/v1/chat")
async def chat(body: ChatRequest):
    conn = get_connection()
    conversation = _get_conversation(conn, body.conversation_id)
    if conversation is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Conversation not found")

    document_ids = _conversation_document_ids(conn, body.conversation_id)
    title = conversation["title"]
    if title == "Nouvelle conversation" and body.message.strip():
        new_title = body.message.strip()[:48]
        conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (new_title, _now(), body.conversation_id),
        )
        conn.commit()

    attachments = (
        [a.model_dump() for a in body.attachments] if body.attachments else None
    )
    _save_message(
        conn,
        body.conversation_id,
        "user",
        body.message.strip(),
        attachments=attachments,
    )
    conn.commit()

    result = answer_with_rag(
        body.message,
        top_k=body.top_k,
        document_ids=document_ids or None,
        conversation_id=body.conversation_id,
    )

    assistant_msg = _save_message(
        conn,
        body.conversation_id,
        "assistant",
        result["answer"] or "",
        citations=result.get("citations"),
    )
    conn.commit()
    conn.close()

    return {
        **result,
        "conversation_id": body.conversation_id,
        "message": assistant_msg,
    }
