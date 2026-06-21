from __future__ import annotations

import math
from typing import Iterator, List, Optional, Tuple

from backend.reference.local_rag.llm import ModelAPIError
from backend.reference.local_rag.models import KnowledgeCard as RagKnowledgeCard
from backend.reference.local_rag.extractors import canonicalize_url
from backend.reference.local_rag.service import KnowledgeService

from .schemas import AnswerResponse, CardImageAsset, CitationSource, DailyReport, KnowledgeCard, SearchResult, Tag
from .store import now_iso


class RagUnavailableError(RuntimeError):
    pass


def _tag_id(name: str) -> str:
    normalized = "".join(ch.lower() if ch.isalnum() else "-" for ch in name).strip("-")
    return f"tag-{normalized or 'untagged'}"


def _word_count(text: str) -> int:
    if not text:
        return 0
    words = [part for part in text.replace("\n", " ").split(" ") if part.strip()]
    if len(words) > 1:
        return len(words)
    return max(1, len(text) // 2)


def _build_image_assets(card_id: str, metadata: dict) -> list[CardImageAsset]:
    urls = metadata.get("image_urls") or []
    if not isinstance(urls, list):
        return []
    created_at = str(metadata.get("created_at") or now_iso())
    assets: list[CardImageAsset] = []
    for index, url in enumerate(urls):
        if not isinstance(url, str) or not url.startswith("http"):
            continue
        assets.append(
            CardImageAsset(
                id=f"{card_id}-image-{index + 1}",
                cardId=card_id,
                sourceUrl=url,
                sortOrder=index,
                createdAt=created_at,
            )
        )
    return assets


def _suggested_questions(metadata: dict) -> list[str]:
    raw_questions = metadata.get("suggested_questions") or metadata.get("suggestedQuestions") or []
    questions: list[str] = []
    if isinstance(raw_questions, list):
        questions = [str(question).strip() for question in raw_questions if str(question).strip()]

    fallback = [
        "这篇文章的核心观点是什么？",
        "我可以如何应用这篇文章？",
        "这篇文章有哪些值得追问的细节？",
    ]
    for question in fallback:
        if len(questions) >= 3:
            break
        if question not in questions:
            questions.append(question)
    return questions[:3]


def rag_card_to_product_card(card: RagKnowledgeCard, *, folder_id: str = "uncategorized") -> KnowledgeCard:
    metadata = card.metadata or {}
    raw_text = str(metadata.get("raw_text") or metadata.get("raw_text_preview") or "")
    raw_markdown = str(metadata.get("raw_markdown") or raw_text)
    created_at = str(metadata.get("created_at") or now_iso())
    updated_at = str(metadata.get("updated_at") or created_at)
    count = _word_count(raw_text or card.summary)
    tags = []
    seen_tag_ids = set()
    for name in card.tags:
        tag_id = _tag_id(name)
        if tag_id in seen_tag_ids:
            continue
        seen_tag_ids.add(tag_id)
        tags.append(Tag(id=tag_id, name=name))

    return KnowledgeCard(
        id=card.card_id,
        title=card.title,
        url=card.original_url,
        siteName=card.source,
        folderId=folder_id,
        tags=tags,
        summary=card.summary,
        contentPreview=raw_text[:360] if raw_text else card.summary[:360],
        fullContent=raw_markdown or None,
        notes="",
        note="",
        sourceType="web",
        author=metadata.get("author"),
        publishedAt=metadata.get("published_at"),
        wordCount=count,
        readingTime=max(1, math.ceil(count / 500)),
        createdAt=created_at,
        updatedAt=updated_at,
        suggestedQuestions=_suggested_questions(metadata),
        imageAssets=_build_image_assets(card.card_id, metadata),
    )


class ProductRagService:
    def __init__(self) -> None:
        self.service = KnowledgeService()

    def reload(self) -> None:
        self.service = KnowledgeService()

    def find_existing_card_id_by_url(self, url: str) -> Optional[str]:
        canonical_url = canonicalize_url(url)
        existing = self.service.db.find_item_by_url_any_user(canonical_url)
        if not existing:
            return None
        card = self.service.db.get_card_by_item(existing["id"])
        return str(card["id"]) if card else None

    def ingest(self, *, url: str, folder_id: str, recreate_on_duplicate: bool = False) -> KnowledgeCard:
        try:
            response = self.service.ingest(url=url, recreate_on_duplicate=recreate_on_duplicate)
        except ModelAPIError as exc:
            raise RagUnavailableError(str(exc)) from exc
        except Exception as exc:
            raise RuntimeError(str(exc)) from exc
        return rag_card_to_product_card(response.card, folder_id=folder_id)

    def rewrite(self, query: str) -> str:
        try:
            return self.service.models.rewrite_query(query)
        except ModelAPIError as exc:
            raise RagUnavailableError(str(exc)) from exc

    def search(self, query: str) -> Tuple[str, List[SearchResult]]:
        try:
            response = self.service.search(query=query)
        except ModelAPIError as exc:
            raise RagUnavailableError(str(exc)) from exc
        cards = [rag_card_to_product_card(card) for card in response.cards]
        results = [
            SearchResult(
                cardId=card.id,
                card=card,
                score=float(response.cards[index].final_score or response.cards[index].score or 0.0),
                matchedText=card.summary or card.contentPreview,
                matchedField="summary",
                highlights=[card.summary or card.title],
            )
            for index, card in enumerate(cards)
        ]
        return response.rewritten_query, results

    def answer(self, question: str, card_ids: List[str]) -> AnswerResponse:
        if not card_ids:
            raise ValueError("cardIds is required")

        try:
            response = self.service.answer(query=question, card_id=card_ids[0])
        except ModelAPIError as exc:
            raise RagUnavailableError(str(exc)) from exc
        card = rag_card_to_product_card(response.card)
        return AnswerResponse(
            answer=response.answer,
            citations=[CitationSource(cardId=card.id, title=card.userTitle or card.title, url=card.url, snippet=card.summary or card.contentPreview)],
            usedCardIds=[card.id],
            model=self.service.settings.chat_model,
            createdAt=now_iso(),
        )

    def answer_stream(self, question: str, card_ids: List[str]) -> Iterator[str]:
        if not card_ids:
            raise ValueError("cardIds is required")

        try:
            card = self.service.db.get_card_any_user(card_ids[0])
            if not card:
                raise KeyError(f"card not found: {card_ids[0]}")
            yield from self.service.models.answer_stream(query=question, card=card)
        except ModelAPIError as exc:
            raise RagUnavailableError(str(exc)) from exc

    def generate_daily_report(self, date: str, cards: List[KnowledgeCard]) -> DailyReport:
        if not cards:
            return DailyReport(date=date, summary="该日期暂无知识归档内容。", topics=[], keywords=[], highlightCardIds=[], createdAt=now_iso())

        payload = [
            {
                "id": card.id,
                "title": card.userTitle or card.title,
                "source": card.siteName,
                "summary": card.userSummary or card.summary,
                "tags": [tag.name for tag in card.tags],
                "content": card.fullContent or card.contentPreview,
            }
            for card in cards
        ]
        try:
            report = self.service.models.generate_daily_report(date=date, cards=payload)
        except ModelAPIError as exc:
            raise RagUnavailableError(str(exc)) from exc

        return DailyReport(
            date=date,
            summary=report["summary"],
            topics=report["topics"],
            keywords=report["keywords"],
            highlightCardIds=report["highlightCardIds"] or [card.id for card in cards[:3]],
            createdAt=now_iso(),
        )


rag_service = ProductRagService()
