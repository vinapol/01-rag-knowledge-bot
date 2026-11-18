import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "rag.db"
UPLOADS_DIR = Path(__file__).parent / "data" / "uploads"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _column_names(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row["name"] for row in rows}


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_connection()
    conn.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Nouvelle conversation',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        attachments_json TEXT,
        citations_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        content_type TEXT,
        size_bytes INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        chunks_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        error_message TEXT,
        conversation_id TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
    """)

    # Migration douce si la table documents existait déjà sans conversation_id
    if "conversation_id" not in _column_names(conn, "documents"):
        conn.execute("ALTER TABLE documents ADD COLUMN conversation_id TEXT")

    conn.commit()
    conn.close()
