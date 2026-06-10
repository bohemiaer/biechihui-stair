from __future__ import annotations

import math
from typing import Dict, List

from .db import KnowledgeDB
from .llm import ModelClient
from .vector_index import OptionalLanceIndex


def cosine_similarity(left: List[float], right: List[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left)) or 1.0
    right_norm = math.sqrt(sum(b * b for b in right)) or 1.0
    return dot / (left_norm * right_norm)


class Retriever:
    def __init__(self, db: KnowledgeDB, models: ModelClient, vector_index: OptionalLanceIndex):
        self.db = db
        self.models = models
        self.vector_index = vector_index

    def search(self, *, query: str, top_k: int = 5, final_k: int = 3, min_score: float = 0.0) -> Dict:
        rewritten = self.models.rewrite_query(query)
        query_embedding = self.models.embed(rewritten)
        all_cards = self.db.all_cards_any_user()
        vector_scores = {
            card["id"]: max(0.0, cosine_similarity(query_embedding, card.get("embedding", [])))
            for card in all_cards
        }
        for hit in self.vector_index.search(embedding=query_embedding, limit=max(top_k * 2, 10)):
            vector_scores[str(hit["card_id"])] = max(vector_scores.get(str(hit["card_id"]), 0.0), float(hit["score"]))
        fts_hits = self.db.fts_search_any_user(rewritten, limit=max(top_k * 4, 20))
        fts_scores = self._normalize_fts(fts_hits)

        merged: List[Dict] = []
        by_id = {card["id"]: card for card in all_cards}
        candidate_ids = set(vector_scores.keys()) | set(fts_scores.keys())
        for card_id in candidate_ids:
            card = by_id.get(card_id)
            if not card:
                continue
            score = 0.65 * vector_scores.get(card_id, 0.0) + 0.35 * fts_scores.get(card_id, 0.0)
            if score < min_score:
                continue
            out = dict(card)
            out["vector_score"] = vector_scores.get(card_id, 0.0)
            out["fts_score"] = fts_scores.get(card_id, 0.0)
            out["merged_score"] = score
            out["rerank_score"] = None
            out["final_score"] = score
            out["score"] = score
            merged.append(out)

        merged.sort(key=lambda item: item.get("score", 0.0), reverse=True)
        candidates = merged[:top_k]
        reranked = self.models.rerank(rewritten, candidates, top_k)
        reranked = self._apply_final_scores(reranked, rerank_used=self._rerank_enabled())
        return {
            "rewritten_query": rewritten,
            "cards": reranked[:final_k],
            "top_candidates": reranked[:top_k],
        }

    def _normalize_fts(self, hits: List[Dict]) -> Dict[str, float]:
        if not hits:
            return {}
        ranks = [hit["rank"] for hit in hits]
        best = min(ranks)
        worst = max(ranks)
        if best == worst:
            return {hit["card_id"]: 1.0 for hit in hits}
        return {
            hit["card_id"]: 1.0 - ((hit["rank"] - best) / (worst - best))
            for hit in hits
        }

    def _rerank_enabled(self) -> bool:
        return bool(self.models.settings.rerank_api_url and self.models.settings.rerank_model)

    def _apply_final_scores(self, cards: List[Dict], *, rerank_used: bool) -> List[Dict]:
        normalized: List[Dict] = []
        for card in cards:
            out = dict(card)
            final_score = float(out.get("score", out.get("merged_score", 0.0)) or 0.0)
            out["rerank_score"] = final_score if rerank_used else None
            out["final_score"] = final_score
            out["score"] = final_score
            normalized.append(out)
        return normalized
