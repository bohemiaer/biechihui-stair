from __future__ import annotations

import json
import threading
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse

from .aihot_client import fetch_aihot_articles
from .feedgrab_login import get_feedgrab_login_statuses, start_feedgrab_login
from .runtime_config import runtime_config_status, save_runtime_config
from .schemas import AnswerArchiveCreate, AnswerRequest, CardRefreshRequest, FeedgrabLoginRequest, FolderCreate, FolderUpdate, ImportTask, ImportTaskCreate, KnowledgeCardUpdate, RuntimeConfigUpdate, SearchRequest
from .rag_service import RagUnavailableError, rag_service
from .store import store

app = FastAPI(title="Biechihui Product API", version="0.1.0")

ALLOWED_CORS_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def not_found(resource: str, resource_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail={"message": f"{resource} not found: {resource_id}"})


def service_unavailable(message: str) -> HTTPException:
    return HTTPException(status_code=503, detail={"message": message, "type": "model_missing", "recoverable": True})


def invalid_request(message: str, error_type: str = "invalid_request") -> HTTPException:
    return HTTPException(status_code=400, detail={"message": message, "type": error_type, "recoverable": True})


def ensure_card_source_url(card) -> str:
    url = str(card.url or "").strip()
    if not url:
        raise invalid_request("当前知识卡缺少来源链接，无法重新抓取或重新生成。")
    if not url.startswith(("http://", "https://")):
        raise invalid_request("当前知识卡的来源链接格式无效，无法重新抓取或重新生成。")
    return url


def process_import_task(task_id: str, *, url: str, folder_id: str, target_card_id: Optional[str] = None) -> None:
    try:
        matched_card_id = rag_service.find_existing_card_id_by_url(url)
        ingest_kwargs = {"url": url, "folder_id": folder_id}
        if matched_card_id is not None or target_card_id is not None:
            ingest_kwargs["recreate_on_duplicate"] = True
        card = rag_service.ingest(**ingest_kwargs)
        if target_card_id:
            try:
                store.permanently_delete_card(target_card_id)
            except KeyError:
                pass
            stored_card = store.upsert_card(card)
            result_card_id = stored_card.id
        else:
            if matched_card_id and matched_card_id != card.id:
                try:
                    store.permanently_delete_card(matched_card_id)
                except KeyError:
                    pass
            stored_card = store.upsert_card(card)
            result_card_id = stored_card.id
        try:
            store.complete_import_task(task_id, result_card_id)
        except KeyError:
            return
    except RagUnavailableError as exc:
        try:
            store.fail_import_task(task_id, error_code="model_missing", error_message=str(exc), stage="failed")
        except KeyError:
            return
    except Exception as exc:
        try:
            store.fail_import_task(task_id, error_code="fetch_failed", error_message=str(exc), stage="failed")
        except KeyError:
            return


def start_import_task(task: ImportTask) -> None:
    worker = threading.Thread(
        target=process_import_task,
        kwargs={
            "task_id": task.id,
            "url": task.url,
            "folder_id": task.folderId,
            "target_card_id": task.targetCardId,
        },
        daemon=True,
    )
    worker.start()


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/assets/{asset_path:path}")
def card_asset(asset_path: str):
    target_path = (store.assets_root / asset_path).resolve()
    assets_root = store.assets_root.resolve()
    if assets_root not in target_path.parents and target_path != assets_root:
        raise not_found("asset", asset_path)
    if not target_path.is_file():
        raise not_found("asset", asset_path)
    asset_metadata = next(
        (
            asset
            for card in store.cards
            for asset in (card.imageAssets or [])
            if asset.localPath == asset_path
        ),
        None,
    )
    media_type = asset_metadata.mimeType if asset_metadata and asset_metadata.mimeType else None
    return FileResponse(target_path, media_type=media_type)


@app.get("/api/home/summary")
def home_summary():
    return store.home_summary()


@app.get("/api/home/activity")
def home_activity():
    return store.daily_activity()


@app.get("/api/settings/runtime")
def get_runtime_settings():
    return runtime_config_status()


@app.put("/api/settings/runtime")
def update_runtime_settings(request: RuntimeConfigUpdate):
    status = save_runtime_config(request)
    rag_service.reload()
    return status


@app.post("/api/settings/feedgrab/login")
def login_feedgrab_platform(request: FeedgrabLoginRequest):
    try:
        return start_feedgrab_login(request.platform)
    except ValueError as exc:
        raise invalid_request(str(exc), error_type="invalid_platform") from exc
    except RuntimeError as exc:
        raise service_unavailable(str(exc)) from exc


@app.get("/api/settings/feedgrab/status")
def feedgrab_login_status():
    return get_feedgrab_login_statuses()


@app.get("/api/folders")
def folders():
    return store.list_folders()


@app.post("/api/folders")
def create_folder(request: FolderCreate):
    return store.create_folder(request)


@app.patch("/api/folders/{folder_id}")
def update_folder(folder_id: str, request: FolderUpdate):
    try:
        return store.update_folder(folder_id, request)
    except KeyError as exc:
        raise not_found("folder", folder_id) from exc


@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: str):
    try:
        return store.delete_folder(folder_id)
    except KeyError as exc:
        raise not_found("folder", folder_id) from exc


@app.get("/api/cards")
def cards(folder_id: Optional[str] = None, include_deleted: bool = False):
    return store.list_cards(folder_id=folder_id, include_deleted=include_deleted)


@app.get("/api/cards/{card_id}")
def card(card_id: str):
    try:
        return store.get_card(card_id)
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, request: KnowledgeCardUpdate):
    try:
        return store.update_card(card_id, request)
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: str):
    try:
        return store.delete_card(card_id)
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.post("/api/cards/{card_id}/restore")
def restore_card(card_id: str):
    try:
        return store.restore_card(card_id)
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.delete("/api/cards/{card_id}/permanent")
def permanently_delete_card(card_id: str):
    try:
        return store.permanently_delete_card(card_id)
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.post("/api/cards/{card_id}/refresh")
def refresh_card(card_id: str, request: CardRefreshRequest = CardRefreshRequest()):
    try:
        card = store.get_card(card_id)
        url = ensure_card_source_url(card)
        task = store.create_import_task(
            ImportTaskCreate(url=url, folderId=card.folderId),
            target_card_id=card_id,
        )
        start_import_task(task)
        return task
    except HTTPException:
        raise
    except RagUnavailableError as exc:
        raise service_unavailable(str(exc)) from exc
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.post("/api/cards/{card_id}/regenerate")
def regenerate_card(card_id: str):
    try:
        card = store.get_card(card_id)
        url = ensure_card_source_url(card)
        regenerated = rag_service.ingest(url=url, folder_id=card.folderId)
        return store.replace_card_content(card_id, regenerated, preserve_notes=True)
    except HTTPException:
        raise
    except RagUnavailableError as exc:
        raise service_unavailable(str(exc)) from exc
    except KeyError as exc:
        raise not_found("card", card_id) from exc
    except Exception as exc:
        raise invalid_request(str(exc), error_type="fetch_failed") from exc


@app.post("/api/cards/{card_id}/answer-archives")
def archive_answer(card_id: str, request: AnswerArchiveCreate):
    if request.cardId != card_id:
        request = request.copy(update={"cardId": card_id})
    try:
        return store.archive_answer(request)
    except KeyError as exc:
        raise not_found("card", card_id) from exc


@app.get("/api/import-tasks/recent")
def recent_import_tasks():
    return store.recent_import_tasks()


@app.post("/api/import-tasks")
def create_import_task(request: ImportTaskCreate):
    task = store.create_import_task(request)
    start_import_task(task)
    return task


@app.post("/api/import-tasks/{task_id}/retry")
def retry_import_task(task_id: str):
    try:
        task = store.retry_import_task(task_id)
        start_import_task(task)
        return task
    except KeyError as exc:
        raise not_found("import task", task_id) from exc


@app.get("/api/calendar/days")
def calendar_days():
    return store.daily_activity()


@app.get("/api/calendar/days/{date}")
def calendar_day(date: str):
    return store.daily_report(date)


@app.post("/api/calendar/days/{date}/daily-report")
def create_daily_report(date: str):
    try:
        report = rag_service.generate_daily_report(date, store.cards_for_date(date))
        return store.save_daily_report(report)
    except RagUnavailableError as exc:
        raise service_unavailable(str(exc)) from exc


@app.get("/api/hot/articles")
def hot_articles():
    try:
        return store.upsert_hot_articles(fetch_aihot_articles())
    except Exception as exc:
        raise HTTPException(status_code=502, detail={"message": f"热文拉取失败：{exc}", "type": "hot_fetch_failed", "recoverable": True}) from exc


@app.get("/api/hot/articles/{article_id}")
def hot_article(article_id: str):
    article = next((item for item in store.hot_list() if item.id == article_id), None)
    if not article:
        raise not_found("hot article", article_id)
    return article


@app.post("/api/hot/articles/{article_id}/import")
def import_hot_article(article_id: str, request: Dict[str, str]):
    try:
        task = store.import_hot_article(article_id, request.get("folderId", "uncategorized"))
        start_import_task(task)
        return task
    except KeyError as exc:
        raise not_found("hot article", article_id) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail={"message": str(exc), "type": "fetch_failed", "recoverable": True}) from exc


@app.post("/api/search/rewrite")
def rewrite_search_query(request: SearchRequest):
    try:
        return {"query": rag_service.rewrite(request.query.strip())}
    except RagUnavailableError as exc:
        raise service_unavailable(str(exc)) from exc


@app.post("/search")
def search(request: SearchRequest):
    try:
        _rewritten, results = rag_service.search(request.query)
        deleted_ids = {card.id for card in store.list_cards(include_deleted=True) if card.isDeleted}
        visible_results = []
        for result in results:
            if result.cardId in deleted_ids:
                continue
            store.upsert_card(result.card)
            visible_results.append(result)
        return visible_results
    except RagUnavailableError as exc:
        raise service_unavailable(str(exc)) from exc


@app.post("/answer")
def answer(request: AnswerRequest):
    try:
        return rag_service.answer(request.question, request.cardIds)
    except RagUnavailableError as exc:
        raise service_unavailable(str(exc)) from exc


@app.post("/answer/stream")
def answer_stream(request: AnswerRequest):
    def stream():
        answer_text = ""
        try:
            for token in rag_service.answer_stream(request.question, request.cardIds):
                answer_text += token
                yield f"event: token\ndata: {json.dumps({'token': token}, ensure_ascii=False)}\n\n"
            yield f"event: done\ndata: {json.dumps({'answer': answer_text, 'model': rag_service.service.settings.chat_model}, ensure_ascii=False)}\n\n"
        except RagUnavailableError as exc:
            yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'message': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
