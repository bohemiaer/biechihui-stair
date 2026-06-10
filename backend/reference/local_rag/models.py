from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, HttpUrl


class IngestRequest(BaseModel):
    url: HttpUrl
    force_refresh: bool = False


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    top_k: int = Field(default=5, ge=1, le=20)
    final_k: int = Field(default=3, ge=1, le=10)
    min_score: float = Field(default=0.0, ge=0.0)


class AnswerRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    card_id: str = Field(min_length=1)


class KnowledgeCard(BaseModel):
    card_id: str
    item_id: str
    title: str
    source: str
    summary: str
    tags: List[str]
    original_url: str
    score: Optional[float] = None
    vector_score: Optional[float] = None
    fts_score: Optional[float] = None
    merged_score: Optional[float] = None
    rerank_score: Optional[float] = None
    final_score: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    item_id: str
    card: KnowledgeCard
    duplicate: bool = False


class SearchResponse(BaseModel):
    rewritten_query: str
    cards: List[KnowledgeCard]
    top_candidates: List[KnowledgeCard] = Field(default_factory=list)


class AnswerResponse(BaseModel):
    answer: str
    citations: List[str]
    card: KnowledgeCard


class CardListResponse(BaseModel):
    cards: List[KnowledgeCard]
    total: int
