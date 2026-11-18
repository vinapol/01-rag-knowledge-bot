import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "rag.db"
UPLOADS_DIR = Path(__file__).parent / "data" / "uploads"

def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        content_type TEXT,
        size_bytes INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        chunks_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        error_message TEXT
    )
    """)
    conn.commit()
    conn.close()

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
