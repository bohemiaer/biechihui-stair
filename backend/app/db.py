from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List


class ProductDatabase:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.init_schema()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.path))
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def init_schema(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS folder (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    parent_id TEXT NULL,
                    is_system INTEGER NOT NULL DEFAULT 0,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS knowledge_item (
                    id TEXT PRIMARY KEY,
                    card_id TEXT UNIQUE,
                    raw_text TEXT NOT NULL DEFAULT '',
                    parsed_text TEXT NOT NULL DEFAULT '',
                    word_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS knowledge_card (
                    id TEXT PRIMARY KEY,
                    item_id TEXT NULL,
                    title TEXT NOT NULL,
                    url TEXT NOT NULL,
                    site_name TEXT NOT NULL,
                    folder_id TEXT NOT NULL DEFAULT 'uncategorized',
                    summary TEXT NOT NULL DEFAULT '',
                    content_preview TEXT NOT NULL DEFAULT '',
                    full_content TEXT NULL,
                    notes TEXT NOT NULL DEFAULT '',
                    note TEXT NULL,
                    source_type TEXT NOT NULL DEFAULT 'web',
                    author TEXT NULL,
                    published_at TEXT NULL,
                    word_count INTEGER NOT NULL DEFAULT 0,
                    reading_time INTEGER NOT NULL DEFAULT 1,
                    user_title TEXT NULL,
                    user_summary TEXT NULL,
                    last_edited_at TEXT NULL,
                    edited_by_user INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    is_important INTEGER NOT NULL DEFAULT 0,
                    is_bad INTEGER NOT NULL DEFAULT 0,
                    deleted_at TEXT NULL,
                    deleted_from_folder_id TEXT NULL,
                    archived_at TEXT NULL,
                    refresh_status TEXT NOT NULL DEFAULT 'idle',
                    last_refreshed_at TEXT NULL,
                    suggested_questions_json TEXT NOT NULL DEFAULT '[]',
                    searchable_text TEXT NOT NULL DEFAULT '',
                    FOREIGN KEY(folder_id) REFERENCES folder(id)
                );

                CREATE TABLE IF NOT EXISTS card_tag (
                    card_id TEXT NOT NULL,
                    tag_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    PRIMARY KEY(card_id, tag_id),
                    FOREIGN KEY(card_id) REFERENCES knowledge_card(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS card_image_asset (
                    id TEXT PRIMARY KEY,
                    card_id TEXT NOT NULL,
                    source_url TEXT NOT NULL,
                    local_path TEXT NOT NULL DEFAULT '',
                    mime_type TEXT NOT NULL DEFAULT '',
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(card_id) REFERENCES knowledge_card(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS import_task (
                    id TEXT PRIMARY KEY,
                    url TEXT NOT NULL,
                    folder_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    error_code TEXT NULL,
                    error_message TEXT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    result_card_id TEXT NULL,
                    target_card_id TEXT NULL,
                    hot_article_id TEXT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(folder_id) REFERENCES folder(id)
                );

                CREATE TABLE IF NOT EXISTS search_index (
                    card_id TEXT PRIMARY KEY,
                    searchable_text TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(card_id) REFERENCES knowledge_card(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS hot_article (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    source TEXT NOT NULL,
                    published_at TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    url TEXT NOT NULL,
                    status TEXT NOT NULL,
                    category TEXT NOT NULL,
                    reason TEXT NULL,
                    import_task_id TEXT NULL,
                    imported_card_id TEXT NULL
                );

                CREATE TABLE IF NOT EXISTS daily_report (
                    date TEXT PRIMARY KEY,
                    summary TEXT NOT NULL,
                    topics_json TEXT NOT NULL DEFAULT '[]',
                    keywords_json TEXT NOT NULL DEFAULT '[]',
                    highlight_card_ids_json TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS answer_archive (
                    id TEXT PRIMARY KEY,
                    card_id TEXT NOT NULL,
                    question TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    used_card_ids_json TEXT NOT NULL DEFAULT '[]',
                    model TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(card_id) REFERENCES knowledge_card(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_knowledge_card_folder_id ON knowledge_card(folder_id);
                CREATE INDEX IF NOT EXISTS idx_knowledge_card_deleted_at ON knowledge_card(deleted_at);
                CREATE INDEX IF NOT EXISTS idx_import_task_status ON import_task(status);
                CREATE INDEX IF NOT EXISTS idx_answer_archive_card_id ON answer_archive(card_id);
                """
            )
            import_task_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(import_task)").fetchall()
            }
            if "target_card_id" not in import_task_columns:
                connection.execute("ALTER TABLE import_task ADD COLUMN target_card_id TEXT NULL")
            if "hot_article_id" not in import_task_columns:
                connection.execute("ALTER TABLE import_task ADD COLUMN hot_article_id TEXT NULL")
            knowledge_card_columns = {
                row["name"] for row in connection.execute("PRAGMA table_info(knowledge_card)").fetchall()
            }
            if "suggested_questions_json" not in knowledge_card_columns:
                connection.execute("ALTER TABLE knowledge_card ADD COLUMN suggested_questions_json TEXT NOT NULL DEFAULT '[]'")

    def has_data(self) -> bool:
        with self.connect() as connection:
            row = connection.execute("SELECT COUNT(*) AS count FROM folder").fetchone()
            return bool(row and row["count"] > 0)

    def load_snapshot(self) -> Dict[str, List[Dict[str, Any]]]:
        with self.connect() as connection:
            folders = [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "parentId": row["parent_id"],
                    "isSystem": bool(row["is_system"]),
                    "sortOrder": row["sort_order"],
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                }
                for row in connection.execute("SELECT * FROM folder ORDER BY sort_order, created_at")
            ]
            tag_rows = connection.execute("SELECT * FROM card_tag ORDER BY name").fetchall()
            tags_by_card: Dict[str, List[Dict[str, str]]] = {}
            for row in tag_rows:
                tags_by_card.setdefault(row["card_id"], []).append({"id": row["tag_id"], "name": row["name"]})
            asset_rows = connection.execute(
                "SELECT * FROM card_image_asset ORDER BY card_id, sort_order, created_at"
            ).fetchall()
            assets_by_card: Dict[str, List[Dict[str, Any]]] = {}
            for row in asset_rows:
                assets_by_card.setdefault(row["card_id"], []).append(
                    {
                        "id": row["id"],
                        "cardId": row["card_id"],
                        "sourceUrl": row["source_url"],
                        "localPath": row["local_path"],
                        "mimeType": row["mime_type"],
                        "sortOrder": row["sort_order"],
                        "status": row["status"],
                        "createdAt": row["created_at"],
                    }
                )
            archive_rows = connection.execute("SELECT * FROM answer_archive ORDER BY created_at DESC").fetchall()
            archives_by_card: Dict[str, List[Dict[str, Any]]] = {}
            for row in archive_rows:
                archives_by_card.setdefault(row["card_id"], []).append(
                    {
                        "id": row["id"],
                        "cardId": row["card_id"],
                        "question": row["question"],
                        "answer": row["answer"],
                        "usedCardIds": json.loads(row["used_card_ids_json"] or "[]"),
                        "model": row["model"],
                        "createdAt": row["created_at"],
                    }
                )

            cards = []
            for row in connection.execute("SELECT * FROM knowledge_card ORDER BY updated_at DESC"):
                cards.append(
                    {
                        "id": row["id"],
                        "title": row["title"],
                        "url": row["url"],
                        "siteName": row["site_name"],
                        "folderId": row["folder_id"],
                        "tags": tags_by_card.get(row["id"], []),
                        "summary": row["summary"],
                        "contentPreview": row["content_preview"],
                        "fullContent": row["full_content"],
                        "notes": row["notes"],
                        "note": row["note"],
                        "sourceType": row["source_type"],
                        "author": row["author"],
                        "publishedAt": row["published_at"],
                        "wordCount": row["word_count"],
                        "readingTime": row["reading_time"],
                        "userTitle": row["user_title"],
                        "userSummary": row["user_summary"],
                        "lastEditedAt": row["last_edited_at"],
                        "editedByUser": bool(row["edited_by_user"]),
                        "createdAt": row["created_at"],
                        "updatedAt": row["updated_at"],
                        "isImportant": bool(row["is_important"]),
                        "isBadData": bool(row["is_bad"]),
                        "isDeleted": row["deleted_at"] is not None,
                        "deletedAt": row["deleted_at"],
                        "deletedFromFolderId": row["deleted_from_folder_id"],
                        "archivedAt": row["archived_at"],
                        "refreshStatus": row["refresh_status"],
                        "lastRefreshedAt": row["last_refreshed_at"],
                        "suggestedQuestions": json.loads(row["suggested_questions_json"] or "[]"),
                        "answerArchives": archives_by_card.get(row["id"], []),
                        "imageAssets": assets_by_card.get(row["id"], []),
                    }
                )

            import_tasks = [
                {
                    "id": row["id"],
                    "url": row["url"],
                    "folderId": row["folder_id"],
                    "status": row["status"],
                    "stage": row["stage"],
                    "progress": row["progress"],
                    "errorCode": row["error_code"],
                    "errorMessage": row["error_message"],
                    "retryCount": row["retry_count"],
                    "resultCardId": row["result_card_id"],
                    "targetCardId": row["target_card_id"],
                    "hotArticleId": row["hot_article_id"],
                    "createdAt": row["created_at"],
                    "updatedAt": row["updated_at"],
                }
                for row in connection.execute("SELECT * FROM import_task ORDER BY created_at DESC")
            ]
            hot_articles = [
                {
                    "id": row["id"],
                    "title": row["title"],
                    "source": row["source"],
                    "publishedAt": row["published_at"],
                    "summary": row["summary"],
                    "url": row["url"],
                    "status": row["status"],
                    "category": row["category"],
                    "reason": row["reason"],
                    "importTaskId": row["import_task_id"],
                    "importedCardId": row["imported_card_id"],
                }
                for row in connection.execute("SELECT * FROM hot_article ORDER BY published_at DESC")
            ]
            daily_reports = [
                {
                    "date": row["date"],
                    "summary": row["summary"],
                    "topics": json.loads(row["topics_json"] or "[]"),
                    "keywords": json.loads(row["keywords_json"] or "[]"),
                    "highlightCardIds": json.loads(row["highlight_card_ids_json"] or "[]"),
                    "createdAt": row["created_at"],
                }
                for row in connection.execute("SELECT * FROM daily_report ORDER BY date DESC")
            ]

        return {
            "folders": folders,
            "cards": cards,
            "importTasks": import_tasks,
            "hotArticles": hot_articles,
            "dailyReports": daily_reports,
        }

    def save_snapshot(self, snapshot: Dict[str, List[Dict[str, Any]]]) -> None:
        with self.connect() as connection:
            connection.execute("DELETE FROM card_tag")
            connection.execute("DELETE FROM card_image_asset")
            connection.execute("DELETE FROM search_index")
            connection.execute("DELETE FROM import_task")
            connection.execute("DELETE FROM hot_article")
            connection.execute("DELETE FROM daily_report")
            connection.execute("DELETE FROM answer_archive")
            connection.execute("DELETE FROM knowledge_item")
            connection.execute("DELETE FROM knowledge_card")
            connection.execute("DELETE FROM folder")

            for folder in snapshot["folders"]:
                connection.execute(
                    """
                    INSERT INTO folder (id, name, parent_id, is_system, sort_order, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        folder["id"],
                        folder["name"],
                        folder.get("parentId"),
                        int(bool(folder.get("isSystem"))),
                        folder.get("sortOrder", 0),
                        folder["createdAt"],
                        folder["updatedAt"],
                    ),
                )

            for card in snapshot["cards"]:
                item_id = f"item-{card['id']}"
                raw_text = card.get("fullContent") or card.get("contentPreview") or ""
                searchable_text = " ".join(
                    [
                        card.get("title") or "",
                        card.get("siteName") or "",
                        card.get("summary") or "",
                        card.get("contentPreview") or "",
                        " ".join(tag.get("name", "") for tag in card.get("tags", [])),
                    ]
                )
                connection.execute(
                    """
                    INSERT INTO knowledge_item (id, card_id, raw_text, parsed_text, word_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (item_id, card["id"], raw_text, raw_text, card.get("wordCount", 0), card["createdAt"]),
                )
                connection.execute(
                    """
                    INSERT INTO knowledge_card (
                        id, item_id, title, url, site_name, folder_id, summary, content_preview, full_content,
                        notes, note, source_type, author, published_at, word_count, reading_time,
                        user_title, user_summary, last_edited_at, edited_by_user, created_at, updated_at,
                        is_important, is_bad, deleted_at, deleted_from_folder_id, archived_at,
                        refresh_status, last_refreshed_at, suggested_questions_json, searchable_text
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        card["id"],
                        item_id,
                        card["title"],
                        card["url"],
                        card["siteName"],
                        card["folderId"],
                        card.get("summary", ""),
                        card.get("contentPreview", ""),
                        card.get("fullContent"),
                        card.get("notes", ""),
                        card.get("note"),
                        card.get("sourceType", "web"),
                        card.get("author"),
                        card.get("publishedAt"),
                        card.get("wordCount", 0),
                        card.get("readingTime", 1),
                        card.get("userTitle"),
                        card.get("userSummary"),
                        card.get("lastEditedAt"),
                        int(bool(card.get("editedByUser"))),
                        card["createdAt"],
                        card["updatedAt"],
                        int(bool(card.get("isImportant"))),
                        int(bool(card.get("isBadData"))),
                        card.get("deletedAt"),
                        card.get("deletedFromFolderId"),
                        card.get("archivedAt"),
                        card.get("refreshStatus", "idle"),
                        card.get("lastRefreshedAt"),
                        json.dumps(card.get("suggestedQuestions", []), ensure_ascii=False),
                        searchable_text,
                    ),
                )
                connection.execute(
                    "INSERT INTO search_index (card_id, searchable_text, updated_at) VALUES (?, ?, ?)",
                    (card["id"], searchable_text, card["updatedAt"]),
                )
                for tag in card.get("tags", []):
                    connection.execute(
                        "INSERT INTO card_tag (card_id, tag_id, name) VALUES (?, ?, ?)",
                        (card["id"], tag["id"], tag["name"]),
                    )
                for asset in card.get("imageAssets", []):
                    connection.execute(
                        """
                        INSERT INTO card_image_asset (
                            id, card_id, source_url, local_path, mime_type, sort_order, status, created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            asset["id"],
                            asset.get("cardId") or card["id"],
                            asset.get("sourceUrl", ""),
                            asset.get("localPath", ""),
                            asset.get("mimeType", ""),
                            asset.get("sortOrder", 0),
                            asset.get("status", "pending"),
                            asset["createdAt"],
                        ),
                    )
                for archive in card.get("answerArchives", []):
                    connection.execute(
                        """
                        INSERT INTO answer_archive (id, card_id, question, answer, used_card_ids_json, model, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            archive["id"],
                            archive.get("cardId") or card["id"],
                            archive["question"],
                            archive["answer"],
                            json.dumps(archive.get("usedCardIds", []), ensure_ascii=False),
                            archive.get("model", ""),
                            archive["createdAt"],
                        ),
                    )

            for task in snapshot["importTasks"]:
                connection.execute(
                    """
                    INSERT INTO import_task (
                        id, url, folder_id, status, stage, progress, error_code, error_message,
                        retry_count, result_card_id, target_card_id, hot_article_id, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        task["id"],
                        task["url"],
                        task["folderId"],
                        task["status"],
                        task["stage"],
                        task["progress"],
                        task.get("errorCode"),
                        task.get("errorMessage"),
                        task.get("retryCount", 0),
                        task.get("resultCardId"),
                        task.get("targetCardId"),
                        task.get("hotArticleId"),
                        task["createdAt"],
                        task["updatedAt"],
                    ),
                )

            for article in snapshot["hotArticles"]:
                connection.execute(
                    """
                    INSERT INTO hot_article (
                        id, title, source, published_at, summary, url, status, category,
                        reason, import_task_id, imported_card_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        article["id"],
                        article["title"],
                        article["source"],
                        article["publishedAt"],
                        article["summary"],
                        article["url"],
                        article["status"],
                        article["category"],
                        article.get("reason"),
                        article.get("importTaskId"),
                        article.get("importedCardId"),
                    ),
                )

            for report in snapshot.get("dailyReports", []):
                connection.execute(
                    """
                    INSERT INTO daily_report (
                        date, summary, topics_json, keywords_json, highlight_card_ids_json, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        report["date"],
                        report["summary"],
                        json.dumps(report.get("topics", []), ensure_ascii=False),
                        json.dumps(report.get("keywords", []), ensure_ascii=False),
                        json.dumps(report.get("highlightCardIds", []), ensure_ascii=False),
                        report["createdAt"],
                    ),
                )
