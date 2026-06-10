from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional


class OptionalLanceIndex:
    def __init__(self, path: Path, enabled: bool):
        self.path = path
        self.enabled = enabled
        self.available = False
        self._db: Any = None
        self._table: Any = None
        if not enabled:
            return
        try:
            import lancedb  # type: ignore

            self.path.mkdir(parents=True, exist_ok=True)
            self._db = lancedb.connect(str(self.path))
            self._table = self._open_table()
            self.available = True
        except Exception:
            self.available = False

    def upsert(self, card: Dict[str, Any]) -> None:
        if not self.available:
            return
        record = {
            "id": card["id"],
            "item_id": card["item_id"],
            "user_id": card["user_id"],
            "title": card["title"],
            "summary": card["summary"],
            "source": card["source"],
            "searchable_text": card["searchable_text"],
            "vector": card["embedding"],
        }
        if self._table is None:
            try:
                self._table = self._db.create_table("knowledge_cards", data=[record])
                return
            except Exception:
                self.available = False
                return
        try:
            merger = self._table.merge_insert("id")
            merger.when_matched_update_all().when_not_matched_insert_all().execute([record])
        except Exception:
            try:
                self._table.add([record])
            except Exception:
                self.available = False

    def search(self, *, embedding: List[float], limit: int) -> List[Dict[str, Any]]:
        if not self.available:
            return []
        try:
            rows = (
                self._table.search(embedding)
                .limit(limit)
                .to_list()
            )
        except Exception:
            return []
        hits: List[Dict[str, Any]] = []
        for row in rows:
            distance = row.get("_distance")
            score = 1.0 / (1.0 + float(distance)) if isinstance(distance, (int, float)) else 0.0
            hits.append({"card_id": row.get("id"), "score": score})
        return [hit for hit in hits if hit.get("card_id")]

    def _open_table(self) -> Optional[Any]:
        try:
            return self._db.open_table("knowledge_cards")
        except Exception:
            return None
