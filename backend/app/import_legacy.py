from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable

from backend.reference.local_rag.models import KnowledgeCard as RagKnowledgeCard

from .rag_service import rag_card_to_product_card
from .store import ProductStore, store


def _load_legacy_cards(source_db: Path) -> Iterable[RagKnowledgeCard]:
    connection = sqlite3.connect(str(source_db))
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT c.*, i.original_url, i.raw_text, i.metadata_json,
                   i.author, i.published_at, i.created_at AS item_created_at,
                   i.updated_at AS item_updated_at
            FROM knowledge_card c
            JOIN knowledge_item i ON i.id = c.item_id
            ORDER BY i.updated_at DESC
            """
        ).fetchall()
    finally:
        connection.close()

    for row in rows:
        metadata: Dict[str, Any] = json.loads(row["metadata_json"] or "{}")
        metadata["raw_text"] = row["raw_text"]
        metadata["author"] = row["author"]
        metadata["published_at"] = row["published_at"]
        metadata["created_at"] = row["item_created_at"]
        metadata["updated_at"] = row["item_updated_at"]

        yield RagKnowledgeCard(
            card_id=row["id"],
            item_id=row["item_id"],
            title=row["title"],
            source=row["source"],
            summary=row["summary"],
            tags=json.loads(row["tags_json"] or "[]"),
            original_url=row["original_url"],
            metadata=metadata,
        )


def import_legacy_rag_database(
    source_db: Path,
    *,
    rag_target_db: Path,
    product_store: ProductStore = store,
    folder_id: str = "uncategorized",
) -> dict[str, int | str]:
    if not source_db.exists():
        raise FileNotFoundError(source_db)

    rag_target_db.parent.mkdir(parents=True, exist_ok=True)
    if source_db.resolve() != rag_target_db.resolve():
        if rag_target_db.exists():
            backup = rag_target_db.with_suffix(f"{rag_target_db.suffix}.bak")
            shutil.copy2(rag_target_db, backup)
        shutil.copy2(source_db, rag_target_db)

    imported = 0
    for legacy_card in _load_legacy_cards(source_db):
        product_store.upsert_card(rag_card_to_product_card(legacy_card, folder_id=folder_id))
        imported += 1

    return {
        "source": str(source_db),
        "ragTarget": str(rag_target_db),
        "importedCards": imported,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a legacy local_rag SQLite database into the product store.")
    parser.add_argument("--source", default="local_rag_data copy/store.db")
    parser.add_argument("--rag-target", default="local_rag_data/store.db")
    parser.add_argument("--folder-id", default="uncategorized")
    args = parser.parse_args()

    result = import_legacy_rag_database(
        Path(args.source),
        rag_target_db=Path(args.rag_target),
        folder_id=args.folder_id,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
