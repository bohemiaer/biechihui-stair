from __future__ import annotations

import mimetypes
import os
import shutil
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Optional
from urllib.parse import urlparse
from uuid import uuid4

import requests

from .app_paths import resolve_backend_paths
from .db import ProductDatabase
from .schemas import (
    AnswerResponse,
    AnswerArchive,
    AnswerArchiveCreate,
    CardImageAsset,
    CitationSource,
    DailyActivity,
    DailyReport,
    DashboardStats,
    Folder,
    FolderCreate,
    FolderUpdate,
    HotArticle,
    ImportTask,
    ImportTaskCreate,
    KnowledgeCard,
    KnowledgeCardUpdate,
    SearchResult,
    Tag,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def model_update(model: Any, updates: Mapping[str, Any]) -> Any:
    if hasattr(model, "model_copy"):
        return model.model_copy(update=dict(updates))
    return model.copy(update=dict(updates))


def model_to_dict(model: Any, exclude_unset: bool = False) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=exclude_unset)
    return model.dict(exclude_unset=exclude_unset)


def _asset_attr(asset: Any, name: str, default: Any = None) -> Any:
    if isinstance(asset, dict):
        return asset.get(name, default)
    return getattr(asset, name, default)


def default_guide_cards(now: str) -> list[KnowledgeCard]:
    return [
        KnowledgeCard(
            id="guide-overview",
            title="别吃灰功能介绍：这个知识库现在能帮你做什么",
            url="https://docs.biechihui.local/features",
            siteName="产品内置指南",
            folderId="uncategorized",
            tags=[Tag(id="tag-guide-product", name="产品介绍"), Tag(id="tag-guide-onboarding", name="新手必读")],
            summary="你可以把网页链接导入知识库、在知识库里编辑摘要和标签、按时间线回看当天归档、用 AI 检索问答做基于文章的问答。",
            contentPreview="功能总览：1. 导入网页链接生成知识卡片；2. 在知识库中编辑标题、摘要、备注和标签；3. 在时间线中回看每天归档；4. 在 AI 检索问答里基于文章内容提问；5. 对推荐文章一键加入知识库。",
            fullContent="功能总览\n1. 导入网页链接，系统会抓取原文、生成摘要与标签，并写入本地知识库。\n2. 在知识库中，你可以编辑标题、摘要、备注、标签，并用重要/坏数据状态管理内容质量。\n3. 在时间线页面，你可以按日期回看当天新增的知识卡片，并在需要时生成日报。\n4. 在 AI 检索问答页面，你可以先检索，再基于选中的知识卡片进行问答，并把回答归档回文章。\n5. 推荐页会展示外部热点文章，支持直接导入到指定文件夹。",
            notes="",
            note="",
            wordCount=920,
            readingTime=2,
            suggestedQuestions=[
                "这篇文章适合用来解决什么问题？",
                "我可以怎样开始使用这个知识库？",
                "这套流程最容易踩坑的地方是什么？",
            ],
            createdAt=now,
            updatedAt=now,
        ),
        KnowledgeCard(
            id="guide-usage",
            title="使用指南：第一次上手建议这样用",
            url="https://docs.biechihui.local/getting-started",
            siteName="产品内置指南",
            folderId="uncategorized",
            tags=[Tag(id="tag-guide-usage", name="使用指南"), Tag(id="tag-guide-workflow", name="工作流")],
            summary="推荐顺序是先导入 3 到 5 篇你真正要用的文章，再补标签和备注，然后去搜索页试一次检索和问答，最后到时间线生成日报。",
            contentPreview="建议流程：先导入真实文章，不要先堆文件夹；导入后补充备注和标签；再去搜索页试检索和问答；最后到时间线生成日报，这样更容易判断知识库是否真的有用。",
            fullContent="第一次上手建议\n1. 先导入 3 到 5 篇你后面会真的拿来查的文章。\n2. 导入完成后，检查每张卡片的标题、摘要、标签是否合理，并补上你自己的备注。\n3. 进入 AI 检索问答页，用自然语言搜一遍，再挑一张卡提问，确认回答是否靠谱。\n4. 如果某张卡片内容不理想，再使用重新抓取或重新生成能力更新它。\n5. 到时间线页面查看当天归档，最后生成日报作为当天收集总结。",
            notes="",
            note="",
            wordCount=840,
            readingTime=2,
            suggestedQuestions=[
                "第一次上手应该先导入哪些文章？",
                "如何判断这套工作流是否有效？",
                "导入之后还需要补充哪些信息？",
            ],
            createdAt=now,
            updatedAt=now,
        ),
    ]


class ProductStore:
    def __init__(self, data_path: Optional[Path] = None) -> None:
        default_path = resolve_backend_paths().product_db_path
        self.data_path = data_path or Path(os.getenv("BIECHIHUI_DATA_PATH", str(default_path)))
        self.assets_root = self.data_path.parent
        self.card_assets_dir = self.assets_root / "card_assets"
        self.card_assets_dir.mkdir(parents=True, exist_ok=True)
        self.db = ProductDatabase(self.data_path)
        self._load_or_seed()

    def reset(self) -> None:
        self._seed()
        self._persist()

    def _load_or_seed(self) -> None:
        if self.db.has_data():
            payload = self.db.load_snapshot()
            self.folders = [Folder(**item) for item in payload.get("folders", [])]
            self.cards = [KnowledgeCard(**item) for item in payload.get("cards", [])]
            self.import_tasks = [ImportTask(**item) for item in payload.get("importTasks", [])]
            self.hot_articles = [HotArticle(**item) for item in payload.get("hotArticles", [])]
            self.daily_reports = [DailyReport(**item) for item in payload.get("dailyReports", [])]
            self._normalize_seed_data()
            self._refresh_counts()
            self._persist()
            return

        self._seed()
        self._persist()

    def _seed(self) -> None:
        now = now_iso()
        self.folders: list[Folder] = [
            Folder(id="uncategorized", name="未分类", cardCount=0, isSystem=True, createdAt=now, updatedAt=now, sortOrder=0),
        ]
        self.cards: list[KnowledgeCard] = [
            *default_guide_cards(now),
        ]
        self.import_tasks: list[ImportTask] = []
        self.hot_articles: list[HotArticle] = []
        self.daily_reports: list[DailyReport] = []
        self._refresh_counts()

    def _normalize_seed_data(self) -> None:
        legacy_folder_ids = {"f-1", "f-2", "f-4"}
        legacy_card_ids = {"c-1"}
        legacy_hot_article_ids = {"h-1"}
        had_legacy_guides = any(card.id in legacy_card_ids for card in self.cards)

        self.folders = [folder for folder in self.folders if folder.id not in legacy_folder_ids]
        self.cards = [card for card in self.cards if card.id not in legacy_card_ids]
        self.hot_articles = [article for article in self.hot_articles if article.id not in legacy_hot_article_ids]

        if had_legacy_guides and not any(card.id.startswith("guide-") for card in self.cards):
            self.cards = default_guide_cards(now_iso()) + self.cards

        if not any(folder.id == "uncategorized" for folder in self.folders):
            now = now_iso()
            self.folders.insert(0, Folder(id="uncategorized", name="未分类", cardCount=0, isSystem=True, createdAt=now, updatedAt=now, sortOrder=0))

    def _snapshot(self) -> dict[str, Any]:
        return {
            "folders": [model_to_dict(folder) for folder in self.folders],
            "cards": [model_to_dict(card) for card in self.cards],
            "importTasks": [model_to_dict(task) for task in self.import_tasks],
            "hotArticles": [model_to_dict(article) for article in self.hot_articles],
            "dailyReports": [model_to_dict(report) for report in self.daily_reports],
        }

    def _persist(self) -> None:
        self.db.save_snapshot(self._snapshot())

    def _card_asset_dir(self, card_id: str) -> Path:
        return self.card_assets_dir / card_id

    def _remove_card_assets(self, card_id: str) -> None:
        asset_dir = self._card_asset_dir(card_id)
        if asset_dir.exists():
            shutil.rmtree(asset_dir, ignore_errors=True)

    def _guess_asset_extension(self, source_url: str, mime_type: str, fallback_index: int) -> str:
        parsed = urlparse(source_url)
        suffix = Path(parsed.path).suffix.lower()
        if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}:
            return suffix
        guessed = mimetypes.guess_extension((mime_type or "").split(";")[0].strip()) or ""
        if guessed == ".jpe":
            guessed = ".jpg"
        return guessed or f".img{fallback_index}"

    def _image_request_headers(self, source_url: str) -> dict[str, str]:
        host = urlparse(source_url).netloc.lower()
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            ),
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        }
        if "xhscdn.com" in host or "xiaohongshu.com" in host:
            headers["Referer"] = "https://www.xiaohongshu.com/"
        elif "mmbiz.qpic.cn" in host or "qq.com" in host:
            headers["Referer"] = "https://mp.weixin.qq.com/"
        return headers

    def _materialize_image_assets(self, card: KnowledgeCard, *, card_id: Optional[str] = None) -> KnowledgeCard:
        final_card_id = card_id or card.id
        source_assets = list(card.imageAssets or [])
        if not source_assets:
            return model_update(card, {"imageAssets": []})

        asset_dir = self._card_asset_dir(final_card_id)
        asset_dir.mkdir(parents=True, exist_ok=True)
        materialized_assets: list[CardImageAsset] = []

        for index, asset in enumerate(source_assets):
            source_url = str(_asset_attr(asset, "sourceUrl", "") or "").strip()
            if not source_url.startswith("http"):
                continue
            try:
                response = requests.get(source_url, headers=self._image_request_headers(source_url), timeout=20)
                response.raise_for_status()
            except Exception:
                continue

            mime_type = str(response.headers.get("Content-Type", "") or "").split(";")[0].strip()
            extension = self._guess_asset_extension(source_url, mime_type, index + 1)
            file_name = f"{index + 1:02d}{extension}"
            file_path = asset_dir / file_name
            file_path.write_bytes(response.content)
            relative_path = file_path.relative_to(self.assets_root).as_posix()
            materialized_assets.append(
                CardImageAsset(
                    id=str(_asset_attr(asset, "id", f"{final_card_id}-image-{index + 1}")),
                    cardId=final_card_id,
                    sourceUrl=source_url,
                    localPath=relative_path,
                    mimeType=mime_type,
                    sortOrder=int(_asset_attr(asset, "sortOrder", index)),
                    status="downloaded",
                    createdAt=str(_asset_attr(asset, "createdAt", now_iso())),
                )
            )

        return model_update(card, {"imageAssets": materialized_assets})

    def _refresh_counts(self) -> None:
        counts = {folder.id: 0 for folder in self.folders}
        for card in self.cards:
            if not card.isDeleted:
                counts[card.folderId] = counts.get(card.folderId, 0) + 1
        self.folders = [model_update(folder, {"cardCount": counts.get(folder.id, 0)}) for folder in self.folders]

    def home_summary(self) -> DashboardStats:
        active_cards = [card for card in self.cards if not card.isDeleted]
        return DashboardStats(
            totalCards=len(active_cards),
            totalWords=sum(card.wordCount or 0 for card in active_cards),
            totalFolders=len([folder for folder in self.folders if not folder.isSystem]),
            weeklyImports=len([task for task in self.import_tasks if task.status in {"running", "succeeded"}]),
        )

    def daily_activity(self) -> list[DailyActivity]:
        active_cards = [card for card in self.cards if not card.isDeleted]
        grouped: dict[str, list[KnowledgeCard]] = {}
        for card in active_cards:
            try:
                date = datetime.fromisoformat(card.createdAt.replace("Z", "+00:00")).date().isoformat()
            except ValueError:
                date = today()
            grouped.setdefault(date, []).append(card)

        return [
            DailyActivity(
                date=date,
                count=len(cards),
                tokenCount=sum((card.wordCount or 0) * 2 for card in cards),
                wordCount=sum(card.wordCount or 0 for card in cards),
                cardIds=[card.id for card in cards],
            )
            for date, cards in sorted(grouped.items())
        ]

    def cards_for_date(self, date: str) -> list[KnowledgeCard]:
        cards: list[KnowledgeCard] = []
        for card in self.cards:
            if card.isDeleted:
                continue
            try:
                card_date = datetime.fromisoformat(card.createdAt.replace("Z", "+00:00")).date().isoformat()
            except ValueError:
                card_date = today()
            if card_date == date:
                cards.append(card)
        return deepcopy(cards)

    def list_folders(self) -> list[Folder]:
        return deepcopy(self.folders)

    def create_folder(self, request: FolderCreate) -> Folder:
        now = now_iso()
        folder = Folder(id=f"folder-{uuid4().hex[:8]}", name=request.name, cardCount=0, createdAt=now, updatedAt=now, sortOrder=len(self.folders))
        self.folders.append(folder)
        self._persist()
        return deepcopy(folder)

    def update_folder(self, folder_id: str, request: FolderUpdate) -> Folder:
        for index, folder in enumerate(self.folders):
            if folder.id == folder_id:
                updated = model_update(folder, {"name": request.name, "updatedAt": now_iso()})
                self.folders[index] = updated
                self._persist()
                return deepcopy(updated)
        raise KeyError(folder_id)

    def delete_folder(self, folder_id: str) -> dict[str, int | str]:
        folder = next((item for item in self.folders if item.id == folder_id), None)
        if not folder or folder.isSystem:
            raise KeyError(folder_id)
        moved = 0
        for index, card in enumerate(self.cards):
            if card.folderId == folder_id:
                self.cards[index] = model_update(card, {"folderId": "uncategorized", "updatedAt": now_iso()})
                moved += 1
        self.folders = [item for item in self.folders if item.id != folder_id]
        self._refresh_counts()
        self._persist()
        return {"id": folder_id, "movedCardCount": moved}

    def list_cards(self, folder_id: Optional[str] = None, include_deleted: bool = False) -> list[KnowledgeCard]:
        cards = self.cards
        if folder_id:
            cards = [card for card in cards if card.folderId == folder_id]
        if not include_deleted:
            cards = [card for card in cards if not card.isDeleted]
        return deepcopy(cards)

    def get_card(self, card_id: str) -> KnowledgeCard:
        card = next((item for item in self.cards if item.id == card_id), None)
        if not card:
            raise KeyError(card_id)
        return deepcopy(card)

    def update_card(self, card_id: str, request: KnowledgeCardUpdate) -> KnowledgeCard:
        for index, card in enumerate(self.cards):
            if card.id == card_id:
                updates = model_to_dict(request, exclude_unset=True)
                if "note" in updates:
                    updates["notes"] = updates["note"]
                updates.update({"updatedAt": now_iso(), "lastEditedAt": now_iso(), "editedByUser": True})
                updated = model_update(card, updates)
                self.cards[index] = updated
                self._refresh_counts()
                self._persist()
                return deepcopy(updated)
        raise KeyError(card_id)

    def archive_answer(self, request: AnswerArchiveCreate) -> AnswerArchive:
        card = self.get_card(request.cardId)
        archive = AnswerArchive(
            id=f"qa-{uuid4().hex[:10]}",
            cardId=card.id,
            question=request.question,
            answer=request.answer,
            usedCardIds=request.usedCardIds or [card.id],
            model=request.model,
            createdAt=now_iso(),
        )
        for index, item in enumerate(self.cards):
            if item.id == card.id:
                archives = list(item.answerArchives or [])
                archives.insert(0, archive)
                self.cards[index] = model_update(item, {"answerArchives": archives, "updatedAt": now_iso()})
                self._persist()
                return deepcopy(archive)
        raise KeyError(request.cardId)

    def delete_card(self, card_id: str) -> KnowledgeCard:
        for index, card in enumerate(self.cards):
            if card.id == card_id:
                self._remove_card_assets(card_id)
                deleted = model_update(card, {
                    "isDeleted": True,
                    "deletedAt": now_iso(),
                    "deletedFromFolderId": card.folderId,
                    "updatedAt": now_iso(),
                    "imageAssets": [],
                })
                self.cards[index] = deleted
                self._refresh_counts()
                self._persist()
                return deepcopy(deleted)
        raise KeyError(card_id)

    def restore_card(self, card_id: str) -> KnowledgeCard:
        card = self.get_card(card_id)
        target_folder = card.deletedFromFolderId if any(folder.id == card.deletedFromFolderId for folder in self.folders) else "uncategorized"
        for index, item in enumerate(self.cards):
            if item.id == card_id:
                restored = model_update(item, {"isDeleted": False, "deletedAt": None, "folderId": target_folder, "updatedAt": now_iso()})
                self.cards[index] = restored
                self._refresh_counts()
                self._persist()
                return deepcopy(restored)
        raise KeyError(card_id)

    def permanently_delete_card(self, card_id: str) -> dict[str, str]:
        self._remove_card_assets(card_id)
        original_count = len(self.cards)
        self.cards = [card for card in self.cards if card.id != card_id]
        if len(self.cards) == original_count:
            raise KeyError(card_id)
        self._refresh_counts()
        self._persist()
        return {"id": card_id}

    def replace_card_content(self, card_id: str, incoming_card: KnowledgeCard, *, preserve_notes: bool = True) -> KnowledgeCard:
        current = self.get_card(card_id)
        self._remove_card_assets(card_id)
        incoming_with_assets = self._materialize_image_assets(incoming_card, card_id=card_id)
        preserved_note = current.note or current.notes if preserve_notes else ""
        preserved_archives = deepcopy(current.answerArchives)
        updated = model_update(
            incoming_with_assets,
            {
                "id": current.id,
                "folderId": current.folderId,
                "createdAt": current.createdAt,
                "updatedAt": now_iso(),
                "lastRefreshedAt": now_iso(),
                "notes": preserved_note,
                "note": preserved_note,
                "answerArchives": preserved_archives,
                "isImportant": current.isImportant,
                "isBadData": current.isBadData,
                "userTitle": None,
                "userSummary": None,
                "lastEditedAt": None,
                "editedByUser": False,
            },
        )
        for index, card in enumerate(self.cards):
            if card.id == card_id:
                self.cards[index] = updated
                self._refresh_counts()
                self._persist()
                return deepcopy(updated)
        raise KeyError(card_id)

    def mark_card_refresh_status(self, card_id: str, status: str) -> KnowledgeCard:
        for index, card in enumerate(self.cards):
            if card.id == card_id:
                updates: dict[str, Any] = {
                    "refreshStatus": status,
                    "updatedAt": now_iso(),
                }
                if status == "idle":
                    updates["lastRefreshedAt"] = now_iso()
                updated = model_update(card, updates)
                self.cards[index] = updated
                self._persist()
                return deepcopy(updated)
        raise KeyError(card_id)

    def recent_import_tasks(self) -> list[ImportTask]:
        return deepcopy(self.import_tasks[:10])

    def get_import_task(self, task_id: str) -> ImportTask:
        task = next((item for item in self.import_tasks if item.id == task_id), None)
        if not task:
            raise KeyError(task_id)
        return deepcopy(task)

    def create_import_task(
        self,
        request: ImportTaskCreate,
        *,
        target_card_id: Optional[str] = None,
        hot_article_id: Optional[str] = None,
    ) -> ImportTask:
        now = now_iso()
        task = ImportTask(
            id=f"task-{uuid4().hex[:8]}",
            url=request.url,
            folderId=request.folderId,
            status="running",
            stage="fetching",
            progress=35,
            targetCardId=target_card_id,
            hotArticleId=hot_article_id,
            createdAt=now,
            updatedAt=now,
        )
        self.import_tasks.insert(0, task)
        if target_card_id:
            self.mark_card_refresh_status(target_card_id, "refreshing")
        if hot_article_id:
            self.hot_articles = [
                model_update(article, {"status": "running", "importTaskId": task.id})
                if article.id == hot_article_id else article
                for article in self.hot_articles
            ]
        self._persist()
        return deepcopy(task)

    def retry_import_task(self, task_id: str) -> ImportTask:
        for index, task in enumerate(self.import_tasks):
            if task.id == task_id:
                updated = model_update(task, {"status": "running", "stage": "fetching", "progress": 25, "retryCount": task.retryCount + 1, "updatedAt": now_iso()})
                self.import_tasks[index] = updated
                if task.targetCardId:
                    self.mark_card_refresh_status(task.targetCardId, "refreshing")
                if task.hotArticleId:
                    self.hot_articles = [
                        model_update(article, {"status": "running", "importTaskId": task.id})
                        if article.id == task.hotArticleId else article
                        for article in self.hot_articles
                    ]
                self._persist()
                return deepcopy(updated)
        raise KeyError(task_id)

    def fail_import_task(self, task_id: str, *, error_code: str, error_message: str, stage: str = "failed") -> ImportTask:
        for index, task in enumerate(self.import_tasks):
            if task.id == task_id:
                updated = model_update(task, {
                    "status": "failed",
                    "stage": stage,
                    "progress": 100,
                    "errorCode": error_code,
                    "errorMessage": error_message,
                    "updatedAt": now_iso(),
                })
                self.import_tasks[index] = updated
                if task.targetCardId:
                    try:
                        self.mark_card_refresh_status(task.targetCardId, "failed")
                    except KeyError:
                        pass
                if task.hotArticleId:
                    self.hot_articles = [
                        model_update(article, {"status": "failed", "importTaskId": task.id})
                        if article.id == task.hotArticleId else article
                        for article in self.hot_articles
                    ]
                self._persist()
                return deepcopy(updated)
        raise KeyError(task_id)

    def complete_import_task(self, task_id: str, card_id: str) -> ImportTask:
        for index, task in enumerate(self.import_tasks):
            if task.id == task_id:
                updated = model_update(task, {
                    "status": "succeeded",
                    "stage": "done",
                    "progress": 100,
                    "resultCardId": card_id,
                    "updatedAt": now_iso(),
                })
                self.import_tasks[index] = updated
                if task.hotArticleId:
                    self.hot_articles = [
                        model_update(article, {"status": "imported", "importTaskId": task.id, "importedCardId": card_id})
                        if article.id == task.hotArticleId else article
                        for article in self.hot_articles
                    ]
                self._persist()
                return deepcopy(updated)
        raise KeyError(task_id)

    def upsert_card(self, card: KnowledgeCard) -> KnowledgeCard:
        for index, existing in enumerate(self.cards):
            if existing.id == card.id:
                if not card.folderId and existing.folderId:
                    card = model_update(card, {"folderId": existing.folderId})
                if card.imageAssets and not any(asset.localPath for asset in existing.imageAssets):
                    self._remove_card_assets(card.id)
                    card = self._materialize_image_assets(card, card_id=card.id)
                elif not card.imageAssets:
                    card = model_update(card, {"imageAssets": existing.imageAssets})
                else:
                    card = model_update(card, {"imageAssets": existing.imageAssets})
                self.cards[index] = card
                self._refresh_counts()
                self._persist()
                return deepcopy(card)
        card = self._materialize_image_assets(card, card_id=card.id)
        self.cards.insert(0, card)
        self._refresh_counts()
        self._persist()
        return deepcopy(card)

    def daily_report(self, date: str) -> Optional[DailyReport]:
        report = next((item for item in self.daily_reports if item.date == date), None)
        return deepcopy(report) if report else None

    def save_daily_report(self, report: DailyReport) -> DailyReport:
        self.daily_reports = [item for item in self.daily_reports if item.date != report.date]
        self.daily_reports.insert(0, report)
        self._persist()
        return deepcopy(report)

    def hot_list(self) -> list[HotArticle]:
        return deepcopy(self.hot_articles)

    def upsert_hot_articles(self, articles: list[HotArticle]) -> list[HotArticle]:
        existing_by_id = {article.id: article for article in self.hot_articles}
        merged: list[HotArticle] = []
        for article in articles:
            existing = existing_by_id.get(article.id)
            if existing:
                article = model_update(
                    article,
                    {
                        "status": existing.status,
                        "importTaskId": existing.importTaskId,
                        "importedCardId": existing.importedCardId,
                    },
                )
            merged.append(article)
        self.hot_articles = merged
        self._persist()
        return deepcopy(self.hot_articles)

    def import_hot_article(self, article_id: str, folder_id: str) -> ImportTask:
        article = next((item for item in self.hot_articles if item.id == article_id), None)
        if not article:
            raise KeyError(article_id)
        return self.create_import_task(ImportTaskCreate(url=article.url, folderId=folder_id), hot_article_id=article_id)

    def search(self, query: str) -> list[SearchResult]:
        normalized = query.lower()
        matches = [card for card in self.list_cards() if normalized in " ".join([card.title, card.summary, card.contentPreview, card.siteName]).lower()]
        if not matches:
            matches = self.list_cards()[:3]
        return [
            SearchResult(cardId=card.id, card=card, score=0.86, matchedText=card.summary or card.contentPreview, matchedField="summary", highlights=[card.summary or card.title])
            for card in matches
        ]

    def answer(self, question: str, card_ids: list[str]) -> AnswerResponse:
        cards = [self.get_card(card_id) for card_id in card_ids]
        return AnswerResponse(
            answer=f"基于你选择的 {len(cards)} 张知识卡，“{question}” 的核心答案是：先定位资料，再结合摘要与原文交叉验证。",
            citations=[CitationSource(cardId=card.id, title=card.userTitle or card.title, url=card.url, snippet=card.summary or card.contentPreview) for card in cards],
            usedCardIds=[card.id for card in cards],
            model="product-api-mock",
            createdAt=now_iso(),
        )

    def make_card_from_url(self, url: str, folder_id: str) -> KnowledgeCard:
        now = now_iso()
        host = urlparse(url).netloc or "Imported Source"
        card = KnowledgeCard(
            id=f"card-{uuid4().hex[:8]}",
            title=f"Imported content from {host}",
            url=url,
            siteName=host,
            folderId=folder_id,
            tags=[Tag(id=f"tag-{uuid4().hex[:6]}", name="Imported")],
            summary="这是一条由产品 API 外壳创建的导入占位内容。",
            contentPreview="真实抓取、摘要和 embedding 会在接入 local_rag service 后替换这里。",
            fullContent="真实抓取、摘要和 embedding 会在接入 local_rag service 后替换这里。",
            wordCount=120,
            suggestedQuestions=[
                "这篇导入内容的核心观点是什么？",
                "我可以怎样把它用到当前项目？",
                "还有哪些细节值得继续追问？",
            ],
            createdAt=now,
            updatedAt=now,
        )
        self.cards.insert(0, card)
        self._refresh_counts()
        self._persist()
        return card


store = ProductStore()
