from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import requests

from .schemas import HotArticle


AIHOT_BASE_URL = os.getenv("AIHOT_BASE_URL", "https://aihot.virxact.com").rstrip("/")


def _category(value: str) -> str:
    mapping = {
        "ai-products": "ai-product",
        "ai-product": "ai-product",
        "ai-models": "featured",
        "industry": "featured",
        "paper": "featured",
        "tip": "skills",
        "tools": "skills",
        "frontend": "frontend",
        "ux": "ux",
    }
    return mapping.get(value, "featured")


def _published_at(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value
    return datetime.now(timezone.utc).isoformat()


def fetch_aihot_articles(*, mode: str = "selected", limit: int = 30) -> list[HotArticle]:
    response = requests.get(
        f"{AIHOT_BASE_URL}/api/public/items",
        params={"mode": mode},
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 Biechihui/0.1 (+local knowledge app)",
        },
        timeout=15,
    )
    response.encoding = "utf-8"
    response.raise_for_status()
    payload = response.json()
    items = payload.get("items", []) if isinstance(payload, dict) else []
    articles: list[HotArticle] = []
    for item in items[:limit]:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("title_en") or "").strip()
        url = str(item.get("url") or "").strip()
        if not title or not url:
            continue
        articles.append(
            HotArticle(
                id=f"aihot-{item.get('id')}",
                title=title,
                source=str(item.get("source") or "AI HOT"),
                publishedAt=_published_at(item.get("publishedAt")),
                summary=str(item.get("summary") or ""),
                url=url,
                status="idle",
                category=_category(str(item.get("category") or "")),
                reason=f"AIHOT 精选，热度分 {item.get('score')}" if item.get("score") is not None else "AIHOT 精选内容",
            )
        )
    return articles
