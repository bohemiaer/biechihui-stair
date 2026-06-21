from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class KnowledgeDB:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode = MEMORY")
        conn.execute("PRAGMA foreign_keys = ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS knowledge_item (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    original_url TEXT NOT NULL,
                    canonical_url TEXT NOT NULL,
                    source TEXT NOT NULL,
                    title TEXT NOT NULL,
                    author TEXT,
                    published_at TEXT,
                    raw_text TEXT NOT NULL,
                    raw_markdown TEXT NOT NULL DEFAULT '',
                    images_json TEXT NOT NULL DEFAULT '[]',
                    metadata_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(user_id, canonical_url)
                );

                CREATE TABLE IF NOT EXISTS knowledge_card (
                    id TEXT PRIMARY KEY,
                    item_id TEXT NOT NULL REFERENCES knowledge_item(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    source TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    tags_json TEXT NOT NULL DEFAULT '[]',
                    searchable_text TEXT NOT NULL,
                    embedding_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_card_fts
                USING fts5(card_id UNINDEXED, user_id UNINDEXED, title, summary, tags, searchable_text);
                """
            )
            item_columns = {
                row["name"] for row in conn.execute("PRAGMA table_info(knowledge_item)").fetchall()
            }
            if "raw_markdown" not in item_columns:
                conn.execute("ALTER TABLE knowledge_item ADD COLUMN raw_markdown TEXT NOT NULL DEFAULT ''")

    def find_item_by_url(self, user_id: str, canonical_url: str) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT * FROM knowledge_item WHERE user_id = ? AND canonical_url = ?",
                (user_id, canonical_url),
            ).fetchone()
            return self._row_to_item(row) if row else None

    def find_item_by_url_any_user(self, canonical_url: str) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT *
                FROM knowledge_item
                WHERE canonical_url = ?
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (canonical_url,),
            ).fetchone()
            return self._row_to_item(row) if row else None

    def get_card_by_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json,
                       i.images_json, i.author, i.published_at,
                       i.created_at AS item_created_at, i.updated_at AS item_updated_at
                FROM knowledge_card c
                JOIN knowledge_item i ON i.id = c.item_id
                WHERE c.item_id = ?
                """,
                (item_id,),
            ).fetchone()
            return self._row_to_card(row) if row else None

    def get_card(self, user_id: str, card_id: str) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json
                       , i.images_json
                FROM knowledge_card c
                JOIN knowledge_item i ON i.id = c.item_id
                WHERE c.user_id = ? AND c.id = ?
                """,
                (user_id, card_id),
            ).fetchone()
            return self._row_to_card(row) if row else None

    def get_card_any_user(self, card_id: str) -> Optional[Dict[str, Any]]:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json
                       , i.images_json
                FROM knowledge_card c
                JOIN knowledge_item i ON i.id = c.item_id
                WHERE c.id = ?
                """,
                (card_id,),
            ).fetchone()
            return self._row_to_card(row) if row else None

    def upsert_item_and_card(
        self,
        *,
        user_id: str,
        original_url: str,
        canonical_url: str,
        source: str,
        title: str,
        author: str,
        published_at: str,
        raw_text: str,
        images: List[str],
        item_metadata: Dict[str, Any],
        summary: str,
        tags: List[str],
        searchable_text: str,
        embedding: List[float],
        raw_markdown: str = "",
        recreate_existing: bool = False,
    ) -> Dict[str, Any]:
        ts = now_iso()
        with self.connect() as conn:
            existing = conn.execute(
                "SELECT id FROM knowledge_item WHERE user_id = ? AND canonical_url = ?",
                (user_id, canonical_url),
            ).fetchone()
            if existing and recreate_existing:
                item_id = existing["id"]
                card = conn.execute("SELECT id FROM knowledge_card WHERE item_id = ?", (item_id,)).fetchone()
                if card:
                    conn.execute("DELETE FROM knowledge_card_fts WHERE card_id = ?", (card["id"],))
                conn.execute("DELETE FROM knowledge_item WHERE id = ?", (item_id,))
                existing = None

            if existing:
                item_id = existing["id"]
                conn.execute(
                    """
                    UPDATE knowledge_item
                    SET original_url = ?, source = ?, title = ?, author = ?, published_at = ?,
                        raw_text = ?, raw_markdown = ?, images_json = ?, metadata_json = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        original_url,
                        source,
                        title,
                        author,
                        published_at,
                        raw_text,
                        raw_markdown,
                        json.dumps(images, ensure_ascii=False),
                        json.dumps(item_metadata, ensure_ascii=False),
                        ts,
                        item_id,
                    ),
                )
                card = conn.execute("SELECT id FROM knowledge_card WHERE item_id = ?", (item_id,)).fetchone()
                card_id = card["id"] if card else uuid.uuid4().hex
            else:
                item_id = uuid.uuid4().hex
                card_id = uuid.uuid4().hex
                conn.execute(
                    """
                    INSERT INTO knowledge_item
                    (id, user_id, original_url, canonical_url, source, title, author, published_at,
                     raw_text, raw_markdown, images_json, metadata_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item_id,
                        user_id,
                        original_url,
                        canonical_url,
                        source,
                        title,
                        author,
                        published_at,
                        raw_text,
                        raw_markdown,
                        json.dumps(images, ensure_ascii=False),
                        json.dumps(item_metadata, ensure_ascii=False),
                        ts,
                        ts,
                    ),
                )

            conn.execute(
                """
                INSERT INTO knowledge_card
                (id, item_id, user_id, title, source, summary, tags_json, searchable_text,
                 embedding_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    source = excluded.source,
                    summary = excluded.summary,
                    tags_json = excluded.tags_json,
                    searchable_text = excluded.searchable_text,
                    embedding_json = excluded.embedding_json,
                    updated_at = excluded.updated_at
                """,
                (
                    card_id,
                    item_id,
                    user_id,
                    title,
                    source,
                    summary,
                    json.dumps(tags, ensure_ascii=False),
                    searchable_text,
                    json.dumps(embedding),
                    ts,
                    ts,
                ),
            )
            conn.execute("DELETE FROM knowledge_card_fts WHERE card_id = ?", (card_id,))
            conn.execute(
                """
                INSERT INTO knowledge_card_fts
                (card_id, user_id, title, summary, tags, searchable_text)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (card_id, user_id, title, summary, " ".join(tags), searchable_text),
            )
            row = conn.execute(
                """
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json
                       , i.images_json
                FROM knowledge_card c JOIN knowledge_item i ON i.id = c.item_id
                WHERE c.id = ?
                """,
                (card_id,),
            ).fetchone()
            return self._row_to_card(row)

    def all_cards(self, user_id: str) -> List[Dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json
                       , i.images_json
                FROM knowledge_card c JOIN knowledge_item i ON i.id = c.item_id
                WHERE c.user_id = ?
                """,
                (user_id,),
            ).fetchall()
            return [self._row_to_card(row) for row in rows]

    def all_cards_any_user(self) -> List[Dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json
                       , i.images_json
                FROM knowledge_card c JOIN knowledge_item i ON i.id = c.item_id
                """
            ).fetchall()
            return [self._row_to_card(row) for row in rows]

    def list_cards(self, user_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        with self.connect() as conn:
            params: List[Any] = []
            where = ""
            if user_id:
                where = "WHERE c.user_id = ?"
                params.append(user_id)
            params.append(limit)
            rows = conn.execute(
                f"""
                SELECT c.*, i.original_url, i.raw_text, i.raw_markdown, i.metadata_json,
                       i.images_json,
                       i.author, i.published_at, i.created_at AS item_created_at,
                       i.updated_at AS item_updated_at
                FROM knowledge_card c JOIN knowledge_item i ON i.id = c.item_id
                {where}
                ORDER BY i.updated_at DESC
                LIMIT ?
                """,
                tuple(params),
            ).fetchall()
            return [self._row_to_card(row) for row in rows]

    def fts_search(self, user_id: str, query: str, limit: int) -> List[Dict[str, Any]]:
        terms = [t for t in query.replace('"', " ").split() if t]
        if not terms:
            return []
        fts_query = " OR ".join(f'"{term}"' for term in terms)
        with self.connect() as conn:
            try:
                rows = conn.execute(
                    """
                    SELECT card_id, bm25(knowledge_card_fts) AS rank
                    FROM knowledge_card_fts
                    WHERE knowledge_card_fts MATCH ? AND user_id = ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (fts_query, user_id, limit),
                ).fetchall()
            except sqlite3.OperationalError:
                return []
            return [{"card_id": row["card_id"], "rank": float(row["rank"])} for row in rows]

    def fts_search_any_user(self, query: str, limit: int) -> List[Dict[str, Any]]:
        terms = [t for t in query.replace('"', " ").split() if t]
        if not terms:
            return []
        fts_query = " OR ".join(f'"{term}"' for term in terms)
        with self.connect() as conn:
            try:
                rows = conn.execute(
                    """
                    SELECT card_id, bm25(knowledge_card_fts) AS rank
                    FROM knowledge_card_fts
                    WHERE knowledge_card_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (fts_query, limit),
                ).fetchall()
            except sqlite3.OperationalError:
                return []
            return [{"card_id": row["card_id"], "rank": float(row["rank"])} for row in rows]

    def _row_to_item(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        data["images"] = json.loads(data.pop("images_json") or "[]")
        data["metadata"] = json.loads(data.pop("metadata_json") or "{}")
        return data

    def _row_to_card(self, row: sqlite3.Row) -> Dict[str, Any]:
        data = dict(row)
        data["tags"] = json.loads(data.pop("tags_json") or "[]")
        data["embedding"] = json.loads(data.pop("embedding_json") or "[]")
        if "metadata_json" in data:
            data["metadata"] = json.loads(data.pop("metadata_json") or "{}")
        else:
            data["metadata"] = {}
        if "images_json" in data:
            data["images"] = json.loads(data.pop("images_json") or "[]")
        else:
            data["images"] = []
        return data
