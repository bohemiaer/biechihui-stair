from __future__ import annotations

from typing import Any, Dict, Optional

from .config import Settings, get_settings
from .db import KnowledgeDB
from .extractors import canonicalize_url, validate_extracted_content
from .feedgrab_adapter import extract_url_with_feedgrab
from .llm import ModelClient
from .models import AnswerResponse, CardListResponse, IngestResponse, KnowledgeCard, SearchResponse
from .retrieval import Retriever
from .vector_index import OptionalLanceIndex


PERSONAL_USER_ID = "personal"


class KnowledgeService:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.settings.data_dir.mkdir(parents=True, exist_ok=True)
        self.db = KnowledgeDB(self.settings.sqlite_path)
        self.models = ModelClient(self.settings)
        self.vector_index = OptionalLanceIndex(self.settings.lancedb_dir, self.settings.use_lancedb)
        self.retriever = Retriever(self.db, self.models, self.vector_index)

    def ingest(self, *, url: str, force_refresh: bool = False, recreate_on_duplicate: bool = False) -> IngestResponse:
        canonical_url = canonicalize_url(url)
        existing = self.db.find_item_by_url_any_user(canonical_url)
        if existing and not force_refresh and not recreate_on_duplicate:
            card = self.db.get_card_by_item(existing["id"])
            if card:
                self._validate_existing_item(existing)
                return IngestResponse(item_id=existing["id"], card=self._to_card(card, include_raw=True), duplicate=True)

        extracted = extract_url_with_feedgrab(url, output_root=self.settings.data_dir / "feedgrab_raw")

        card_payload = self.models.summarize_card(
            title=extracted.title,
            source=extracted.source,
            text=extracted.text,
            image_urls=[],
        )
        title = card_payload["title"]
        summary = card_payload["summary"]
        tags = card_payload["tags"]
        searchable_text = "\n".join([title, extracted.source, summary, " ".join(tags), extracted.text[:2000]])
        embedding = self.models.embed(searchable_text)
        saved = self.db.upsert_item_and_card(
            user_id=existing.get("user_id", PERSONAL_USER_ID) if existing else PERSONAL_USER_ID,
            original_url=extracted.original_url,
            canonical_url=extracted.canonical_url,
            source=extracted.source,
            title=title,
            author=extracted.author,
            published_at=extracted.published_at,
            raw_text=extracted.text,
            raw_markdown=extracted.raw_markdown or extracted.text,
            images=extracted.image_urls,
            item_metadata=extracted.metadata,
            summary=summary,
            tags=tags,
            searchable_text=searchable_text,
            embedding=embedding,
            recreate_existing=recreate_on_duplicate,
        )
        self.vector_index.upsert(saved)
        return IngestResponse(item_id=saved["item_id"], card=self._to_card(saved, include_raw=True), duplicate=bool(existing))

    def _validate_existing_item(self, row: Dict[str, Any]) -> None:
        validate_extracted_content(
            source=str(row.get("source") or ""),
            title=str(row.get("title") or ""),
            text=str(row.get("raw_text") or ""),
        )

    def search(self, *, query: str, top_k: int = 5, final_k: int = 3, min_score: float = 0.0) -> SearchResponse:
        result = self.retriever.search(
            query=query,
            top_k=top_k,
            final_k=final_k,
            min_score=min_score,
        )
        return SearchResponse(
            rewritten_query=result["rewritten_query"],
            cards=[self._to_card(card) for card in result["cards"]],
            top_candidates=[self._to_card(card) for card in result.get("top_candidates", [])],
        )

    def answer(self, *, query: str, card_id: str) -> AnswerResponse:
        card = self.db.get_card_any_user(card_id)
        if not card:
            raise KeyError(f"card not found: {card_id}")
        answer = self.models.answer(query=query, card=card)
        return AnswerResponse(answer=answer, citations=[card["id"], card["item_id"]], card=self._to_card(card))

    def get_card(self, *, card_id: str) -> KnowledgeCard:
        card = self.db.get_card_any_user(card_id)
        if not card:
            raise KeyError(f"card not found: {card_id}")
        return self._to_card(card, include_raw=True)

    def list_cards(self, *, limit: int = 100) -> CardListResponse:
        cards = self.db.list_cards(limit=limit)
        return CardListResponse(cards=[self._to_card(card) for card in cards], total=len(cards))

    def _to_card(self, row: Dict[str, Any], include_raw: bool = False) -> KnowledgeCard:
        metadata = dict(row.get("metadata", {}))
        if row.get("raw_text"):
            metadata["raw_text_preview"] = str(row["raw_text"])[:240]
            if include_raw:
                metadata["raw_text"] = str(row["raw_text"])
        if row.get("raw_markdown"):
            metadata["raw_markdown"] = str(row["raw_markdown"])
        if row.get("author"):
            metadata["author"] = row["author"]
        if row.get("published_at"):
            metadata["published_at"] = row["published_at"]
        if row.get("images"):
            metadata["image_urls"] = list(row["images"])
        if row.get("item_created_at"):
            metadata["created_at"] = row["item_created_at"]
        if row.get("item_updated_at"):
            metadata["updated_at"] = row["item_updated_at"]
        return KnowledgeCard(
            card_id=row["id"],
            item_id=row["item_id"],
            title=row["title"],
            source=row["source"],
            summary=row["summary"],
            tags=list(row.get("tags", [])),
            original_url=row.get("original_url", ""),
            score=row.get("score"),
            vector_score=row.get("vector_score"),
            fts_score=row.get("fts_score"),
            merged_score=row.get("merged_score"),
            rerank_score=row.get("rerank_score"),
            final_score=row.get("final_score"),
            metadata=metadata,
        )
