from pathlib import Path
from time import perf_counter, sleep
import json
import os
import subprocess

from fastapi.testclient import TestClient
import pytest
from pytest import fixture

from backend.app.main import app
from backend.app import runtime_config
from backend.app.rag_service import rag_card_to_product_card
from backend.app.runtime_config import save_runtime_config
from backend.app.schemas import AnswerResponse, CitationSource, DailyReport, FolderCreate, HotArticle, KnowledgeCard, RuntimeConfigUpdate, SearchResult, Tag
from backend.app.store import ProductStore, store
from backend.reference.local_rag.db import KnowledgeDB
from backend.reference.local_rag.feedgrab_adapter import extract_url_with_feedgrab, markdown_to_text_without_images, parse_feedgrab_markdown
from backend.reference.local_rag.llm import ModelClient
from backend.reference.local_rag.models import KnowledgeCard as RagKnowledgeCard


@fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    test_store = ProductStore(data_path=tmp_path / "product_store.sqlite3")
    monkeypatch.setattr("backend.app.main.store", test_store)
    monkeypatch.setattr("backend.app.store.store", test_store)
    globals()["store"] = test_store
    yield


def make_card(card_id: str = "rag-card-1", folder_id: str = "uncategorized") -> KnowledgeCard:
    return KnowledgeCard(
        id=card_id,
        title="RAG imported note",
        url="https://example.com/new-note",
        siteName="Example",
        folderId=folder_id,
        tags=[Tag(id="tag-rag", name="RAG")],
        summary="RAG summary",
        contentPreview="RAG content preview",
        fullContent="RAG full content",
        notes="",
        note="",
        wordCount=120,
        createdAt="2026-06-11T00:00:00+00:00",
        updatedAt="2026-06-11T00:00:00+00:00",
        imageAssets=[],
        suggestedQuestions=[
            "这篇文章的核心观点是什么？",
            "我可以如何应用这篇文章？",
            "这篇文章有哪些值得追问的细节？",
        ],
    )


class FakeImageResponse:
    def __init__(self, content: bytes, content_type: str = "image/jpeg"):
        self.content = content
        self.headers = {"Content-Type": content_type}

    def raise_for_status(self):
        return None


def with_updates(model, **updates):
    if hasattr(model, "model_copy"):
        return model.model_copy(update=updates)
    return model.copy(update=updates)


def test_product_api_smoke_flow(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr("backend.app.main.rag_service.ingest", lambda url, folder_id: make_card(folder_id=folder_id))

    assert client.get("/health").json() == {"ok": True}
    assert client.get("/api/home/summary").status_code == 200
    assert client.get("/api/folders").status_code == 200

    import_response = client.post(
        "/api/import-tasks",
        json={"url": "https://example.com/new-note", "folderId": "uncategorized"},
    )
    assert import_response.status_code == 200
    assert import_response.json()["status"] == "running"

    deadline = perf_counter() + 1.0
    card_id = None
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == import_response.json()["id"]), None)
        if task and task["status"] == "succeeded":
            card_id = task["resultCardId"]
            break
        sleep(0.02)
    assert card_id is not None

    card_response = client.get(f"/api/cards/{card_id}")
    assert card_response.status_code == 200

    delete_response = client.delete(f"/api/cards/{card_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["isDeleted"] is True

    restore_response = client.post(f"/api/cards/{card_id}/restore")
    assert restore_response.status_code == 200
    assert restore_response.json()["isDeleted"] is False

    permanent_response = client.delete(f"/api/cards/{card_id}/permanent")
    assert permanent_response.status_code == 200


def test_import_task_records_model_missing_when_rag_is_not_configured(monkeypatch):
    client = TestClient(app)

    def fail_ingest(url: str, folder_id: str):
        from backend.app.rag_service import RagUnavailableError

        raise RagUnavailableError("CHAT_API_KEY, DEEPSEEK_API_KEY, or SILICONFLOW_API_KEY is required for chat")

    monkeypatch.setattr("backend.app.main.rag_service.ingest", fail_ingest)

    response = client.post(
        "/api/import-tasks",
        json={"url": "https://example.com/new-note", "folderId": "uncategorized"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "running"

    deadline = perf_counter() + 1.0
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == response.json()["id"]), None)
        if task and task["status"] == "failed":
            assert task["errorCode"] == "model_missing"
            break
        sleep(0.02)
    else:
        raise AssertionError("failed import task did not update in time")


def test_import_task_returns_immediately_and_completes_in_background(monkeypatch):
    client = TestClient(app)

    def slow_ingest(url: str, folder_id: str):
      sleep(0.2)
      return make_card(card_id="async-import-card", folder_id=folder_id)

    monkeypatch.setattr("backend.app.main.rag_service.ingest", slow_ingest)

    started_at = perf_counter()
    response = client.post(
        "/api/import-tasks",
        json={"url": "https://example.com/async-note", "folderId": "uncategorized"},
    )
    elapsed = perf_counter() - started_at

    assert response.status_code == 200
    assert response.json()["status"] == "running"
    assert response.json()["stage"] == "fetching"
    assert elapsed < 0.15

    deadline = perf_counter() + 1.0
    while perf_counter() < deadline:
        tasks = client.get("/api/import-tasks/recent").json()
        matching = next((task for task in tasks if task["id"] == response.json()["id"]), None)
        if matching and matching["status"] == "succeeded":
            assert matching["resultCardId"] == "async-import-card"
            break
        sleep(0.02)
    else:
        raise AssertionError("background import task did not complete in time")


def test_rag_card_maps_to_product_card_contract():
    rag_card = RagKnowledgeCard(
        card_id="rag-card",
        item_id="rag-item",
        title="RAG title",
        source="Example",
        summary="RAG summary",
        tags=["RAG", "Embedding"],
        original_url="https://example.com/rag",
        metadata={
            "raw_text": "This is the original content from the crawler.",
            "author": "Author",
            "published_at": "2026-06-11",
            "created_at": "2026-06-11T00:00:00+00:00",
            "updated_at": "2026-06-11T01:00:00+00:00",
        },
    )

    product_card = rag_card_to_product_card(rag_card, folder_id="f-1")

    assert product_card.id == "rag-card"
    assert product_card.folderId == "f-1"
    assert product_card.siteName == "Example"
    assert [tag.name for tag in product_card.tags] == ["RAG", "Embedding"]
    assert product_card.fullContent == "This is the original content from the crawler."
    assert len(product_card.suggestedQuestions) == 3


def test_rag_card_uses_raw_markdown_for_full_content_and_clean_text_for_preview():
    rag_card = RagKnowledgeCard(
        card_id="rag-card",
        item_id="rag-item",
        title="RAG title",
        source="Example",
        summary="RAG summary",
        tags=["RAG"],
        original_url="https://example.com/rag",
        metadata={
            "raw_text": "Clean article text without image markdown.",
            "raw_markdown": "# Original\n\n![cover](https://example.com/cover.jpg)\n\nClean article text without image markdown.",
        },
    )

    product_card = rag_card_to_product_card(rag_card)

    assert product_card.fullContent.startswith("# Original")
    assert "![cover]" in product_card.fullContent
    assert product_card.contentPreview == "Clean article text without image markdown."


def test_feedgrab_markdown_parser_preserves_raw_markdown_and_strips_images_for_text(tmp_path):
    markdown_path = tmp_path / "article.md"
    markdown_path.write_text(
        """---
title: "Feedgrab Title"
source: "https://mp.weixin.qq.com/s/demo"
author:
  - "Author Name"
published: 2026-06-20
cover_image: "https://example.com/cover.jpg"
---

# Feedgrab Title

![cover](https://example.com/cover.jpg)

正文第一段，包含 [链接](https://example.com)。这是一段足够长的文章正文，用来模拟 feedgrab 抓取出的公众号 Markdown 内容。
""",
        encoding="utf-8",
    )

    extracted = parse_feedgrab_markdown(markdown_path, requested_url="https://mp.weixin.qq.com/s/demo")

    assert extracted.title == "Feedgrab Title"
    assert extracted.author == "Author Name"
    assert extracted.source == "微信公众号"
    assert extracted.raw_markdown.startswith("---")
    assert "![cover]" not in extracted.text
    assert "https://example.com/cover.jpg" in extracted.image_urls
    assert "正文第一段，包含 链接。" in extracted.text


def test_feedgrab_import_reuses_project_session_dir_by_default(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("FEEDGRAB_DATA_DIR", raising=False)
    seen_env = {}

    def fake_run(command, cwd, env, capture_output, text, timeout, check):
        seen_env.update(env)
        output_dir = Path(env["OUTPUT_DIR"])
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "xhs-note.md").write_text(
            """---
title: 小红书登录态复用测试
source: http://xhslink.com/o/demo
author: Test Author
---

这是一段小红书正文，用来验证 feedgrab 导入时会复用项目根目录 sessions 里的登录态，而不是临时输出目录里的空登录态。
这段正文需要足够长，保证解析和校验逻辑都能通过，同时不依赖真实网络请求。
""",
            encoding="utf-8",
        )

    monkeypatch.setattr("backend.reference.local_rag.feedgrab_adapter._feedgrab_command", lambda: ["feedgrab"])
    monkeypatch.setattr("backend.reference.local_rag.feedgrab_adapter.subprocess.run", fake_run)

    extracted = extract_url_with_feedgrab(
        "http://xhslink.com/o/demo",
        output_root=tmp_path / "data" / "feedgrab_raw",
    )

    assert seen_env["FEEDGRAB_DATA_DIR"] == str(tmp_path / "sessions")
    assert seen_env["FEEDGRAB_DATA_DIR"] != str(tmp_path / "data" / "feedgrab_raw" / ".feedgrab-data")
    assert extracted.title == "小红书登录态复用测试"


def test_feedgrab_import_uses_app_data_sessions_when_packaged(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("FEEDGRAB_DATA_DIR", raising=False)
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path / "app-data"))
    seen_env = {}

    def fake_run(command, cwd, env, capture_output, text, timeout, check):
        seen_env.update(env)
        output_dir = Path(env["OUTPUT_DIR"])
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "xhs-note.md").write_text(
            """---
title: 小红书应用数据目录测试
source: http://xhslink.com/o/demo
author: Test Author
---

这是一段小红书正文，用来验证安装包运行时 feedgrab session 会写入应用数据目录，而不是安装目录。
这段正文需要足够长，保证解析和校验逻辑都能通过，同时不依赖真实网络请求。
""",
            encoding="utf-8",
        )

    monkeypatch.setattr("backend.reference.local_rag.feedgrab_adapter._feedgrab_command", lambda: ["feedgrab"])
    monkeypatch.setattr("backend.reference.local_rag.feedgrab_adapter.subprocess.run", fake_run)

    extracted = extract_url_with_feedgrab(
        "http://xhslink.com/o/demo",
        output_root=tmp_path / "data" / "feedgrab_raw",
    )

    assert seen_env["FEEDGRAB_DATA_DIR"] == str(tmp_path / "app-data" / "sessions")
    assert extracted.title == "小红书应用数据目录测试"


def test_feedgrab_adapter_uses_packaged_backend_executable(monkeypatch):
    from backend.reference.local_rag import feedgrab_adapter

    monkeypatch.setattr(feedgrab_adapter.sys, "frozen", True, raising=False)
    monkeypatch.setattr(feedgrab_adapter.sys, "executable", r"C:\Program Files\Biechihui\desktop-backend.exe")
    monkeypatch.delenv("FEEDGRAB_COMMAND", raising=False)

    assert feedgrab_adapter._feedgrab_command() == [
        r"C:\Program Files\Biechihui\desktop-backend.exe",
        "--feedgrab",
    ]


def test_feedgrab_login_uses_app_data_sessions_when_packaged(monkeypatch, tmp_path):
    from backend.app import feedgrab_login

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("FEEDGRAB_DATA_DIR", raising=False)
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path / "app-data"))

    assert feedgrab_login._session_dir() == tmp_path / "app-data" / "sessions"


def test_feedgrab_login_uses_packaged_backend_executable(monkeypatch):
    from backend.app import feedgrab_login

    monkeypatch.setattr(feedgrab_login.sys, "frozen", True, raising=False)
    monkeypatch.setattr(feedgrab_login.sys, "executable", r"C:\Program Files\Biechihui\desktop-backend.exe")
    monkeypatch.delenv("FEEDGRAB_COMMAND", raising=False)

    assert feedgrab_login._feedgrab_command() == [
        r"C:\Program Files\Biechihui\desktop-backend.exe",
        "--feedgrab",
    ]


def test_feedgrab_login_returns_when_child_keeps_running(monkeypatch, tmp_path):
    from backend.app import feedgrab_login

    class RunningProcess:
        pid = 12345

        def wait(self, timeout=None):
            raise subprocess.TimeoutExpired("feedgrab", timeout)

    def fake_popen(*args, **kwargs):
        kwargs["stdout"].write(b"Opening browser...\n")
        kwargs["stdout"].flush()
        return RunningProcess()

    session_dir = tmp_path / "sessions"
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("FEEDGRAB_DATA_DIR", str(session_dir))
    monkeypatch.setenv("FEEDGRAB_COMMAND", "feedgrab")
    monkeypatch.setenv("FEEDGRAB_LOGIN_STARTUP_TIMEOUT", "0.1")
    monkeypatch.setattr(feedgrab_login.subprocess, "Popen", fake_popen)

    result = feedgrab_login.start_feedgrab_login("x")

    assert result["pid"] == 12345
    assert result["platform"] == "twitter"
    assert Path(result["logPath"]).exists()


def test_feedgrab_login_reports_fast_exit_without_session(monkeypatch, tmp_path):
    from backend.app import feedgrab_login

    class ExitedProcess:
        pid = 12345

        def wait(self, timeout=None):
            return 0

    def fake_popen(*args, **kwargs):
        kwargs["stdout"].write(b"Playwright is not installed.\n")
        kwargs["stdout"].flush()
        return ExitedProcess()

    session_dir = tmp_path / "sessions"
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("FEEDGRAB_DATA_DIR", str(session_dir))
    monkeypatch.setenv("FEEDGRAB_COMMAND", "feedgrab")
    monkeypatch.setenv("FEEDGRAB_LOGIN_STARTUP_TIMEOUT", "0.1")
    monkeypatch.setattr(feedgrab_login.subprocess, "Popen", fake_popen)

    with pytest.raises(RuntimeError) as exc:
        feedgrab_login.start_feedgrab_login("xhs")

    assert "立即退出" in str(exc.value)
    assert "Playwright is not installed" in str(exc.value)


def test_markdown_to_text_without_images_removes_image_noise():
    cleaned = markdown_to_text_without_images(
        "# Title\n\n![alt](https://example.com/a.jpg)\n\n<img src=\"https://example.com/b.jpg\" />\n\n正文 [链接](https://example.com)"
    )

    assert "https://example.com/a.jpg" not in cleaned
    assert "https://example.com/b.jpg" not in cleaned
    assert "正文 链接" in cleaned


def test_summarize_card_prompt_does_not_send_image_urls(monkeypatch):
    captured = {}
    client = ModelClient.__new__(ModelClient)

    def fake_chat_text(prompt: str):
        captured["prompt"] = prompt
        return '{"title":"标题","summary":"摘要","tags":["标签"]}'

    monkeypatch.setattr(client, "_chat_text", fake_chat_text)

    result = client.summarize_card(
        title="标题",
        source="Example",
        text="正文",
        image_urls=["https://example.com/image.jpg"],
    )

    assert result["summary"] == "摘要"
    assert "https://example.com/image.jpg" not in captured["prompt"]
    assert "图片URL" not in captured["prompt"]


def test_chat_text_stream_decodes_utf8_sse_without_charset(monkeypatch):
    client = ModelClient.__new__(ModelClient)
    client.settings = type(
        "Settings",
        (),
        {
            "chat_api_key": "test-key",
            "chat_base_url": "https://example.com/v1",
            "chat_model": "test-model",
        },
    )()

    class FakeStreamResponse:
        encoding = "ISO-8859-1"

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, traceback):
            return False

        def raise_for_status(self):
            return None

        def iter_lines(self, decode_unicode=False):
            line = 'data: {"choices":[{"delta":{"content":"流式回答"}}]}'.encode("utf-8")
            if decode_unicode:
                yield line.decode(self.encoding)
            else:
                yield line
            yield b"data: [DONE]".decode(self.encoding) if decode_unicode else b"data: [DONE]"

    monkeypatch.setattr("backend.reference.local_rag.llm.requests.post", lambda *args, **kwargs: FakeStreamResponse())

    assert "".join(client._chat_text_stream("问题")) == "流式回答"


def test_rag_card_mapping_deduplicates_tag_ids():
    rag_card = RagKnowledgeCard(
        card_id="rag-card",
        item_id="rag-item",
        title="RAG title",
        source="Example",
        summary="RAG summary",
        tags=["RAG", "RAG"],
        original_url="https://example.com/rag",
        metadata={},
    )

    product_card = rag_card_to_product_card(rag_card)

    assert [tag.id for tag in product_card.tags] == ["tag-rag"]


def test_folder_crud_and_calendar_activity():
    client = TestClient(app)

    create_response = client.post("/api/folders", json={"name": "Research"})
    assert create_response.status_code == 200
    folder_id = create_response.json()["id"]

    rename_response = client.patch(f"/api/folders/{folder_id}", json={"name": "Research Notes"})
    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == "Research Notes"

    calendar_response = client.get("/api/calendar/days")
    assert calendar_response.status_code == 200
    assert calendar_response.json()

    report_response = client.get("/api/calendar/days/2026-06-10")
    assert report_response.status_code == 200
    assert report_response.json() is None

    delete_response = client.delete(f"/api/folders/{folder_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["id"] == folder_id


def test_create_daily_report_uses_rag_service(monkeypatch):
    client = TestClient(app)
    card = make_card(card_id="daily-card", folder_id="uncategorized")
    store.upsert_card(card)
    calls = []

    def generate_daily_report(date: str, cards: list[KnowledgeCard]) -> DailyReport:
        calls.append((date, [item.id for item in cards]))
        return DailyReport(
            date=date,
            summary="DeepSeek generated daily report",
            topics=["RAG 归档重点"],
            keywords=["RAG"],
            highlightCardIds=[card.id],
            createdAt="2026-06-11T01:00:00+00:00",
        )

    monkeypatch.setattr("backend.app.main.rag_service.generate_daily_report", generate_daily_report)

    response = client.post("/api/calendar/days/2026-06-11/daily-report")

    assert response.status_code == 200
    assert response.json()["summary"] == "DeepSeek generated daily report"
    assert calls == [("2026-06-11", [card.id])]
    persisted_response = client.get("/api/calendar/days/2026-06-11")
    assert persisted_response.status_code == 200
    assert persisted_response.json()["summary"] == "DeepSeek generated daily report"


def test_feedgrab_login_endpoint_starts_supported_platform(monkeypatch):
    client = TestClient(app)
    calls = []

    def fake_login(platform: str):
        calls.append(platform)
        return {"platform": "twitter", "pid": 12345}

    monkeypatch.setattr("backend.app.main.start_feedgrab_login", fake_login)

    response = client.post("/api/settings/feedgrab/login", json={"platform": "x"})

    assert response.status_code == 200
    assert response.json() == {"platform": "twitter", "pid": 12345}
    assert calls == ["x"]


def test_feedgrab_login_endpoint_rejects_unsupported_platform(monkeypatch):
    client = TestClient(app)

    def fake_login(platform: str):
        raise ValueError("不支持的平台，请选择 X、小红书或微信。")

    monkeypatch.setattr("backend.app.main.start_feedgrab_login", fake_login)

    response = client.post("/api/settings/feedgrab/login", json={"platform": "unknown"})

    assert response.status_code == 400
    assert response.json()["detail"]["type"] == "invalid_platform"


def test_feedgrab_login_status_detects_sessions(monkeypatch, tmp_path):
    client = TestClient(app)
    session_dir = tmp_path / "sessions"
    session_dir.mkdir()
    (session_dir / "xhs.json").write_text(
        json.dumps({"cookies": [{"name": "a1", "value": "ok"}]}),
        encoding="utf-8",
    )
    (session_dir / "wechat.json").write_text(
        json.dumps({"cookies": [{"name": "slave_sid", "value": "ok"}, {"name": "data_ticket", "value": "ok"}]}),
        encoding="utf-8",
    )
    monkeypatch.setenv("FEEDGRAB_DATA_DIR", str(session_dir))
    monkeypatch.delenv("X_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("X_CT0", raising=False)

    response = client.get("/api/settings/feedgrab/status")

    assert response.status_code == 200
    platforms = response.json()["platforms"]
    assert platforms["x"]["loggedIn"] is False
    assert platforms["xhs"]["loggedIn"] is True
    assert platforms["wechat"]["loggedIn"] is True


def test_feedgrab_login_status_detects_x_environment_cookie(monkeypatch, tmp_path):
    client = TestClient(app)
    monkeypatch.setenv("FEEDGRAB_DATA_DIR", str(tmp_path / "sessions"))
    monkeypatch.setenv("X_AUTH_TOKEN", "token")
    monkeypatch.setenv("X_CT0", "ct0")

    response = client.get("/api/settings/feedgrab/status")

    assert response.status_code == 200
    assert response.json()["platforms"]["x"]["loggedIn"] is True
    assert "环境变量" in response.json()["platforms"]["x"]["message"]


def test_refresh_and_regenerate_reingest_card_content(monkeypatch):
    client = TestClient(app)
    store.upsert_card(make_card(card_id="refresh-card", folder_id="uncategorized"))
    store.upsert_card(make_card(card_id="regenerate-card", folder_id="uncategorized"))
    ingest_calls = []

    def reingest(url: str, folder_id: str, recreate_on_duplicate: bool = False):
        ingest_calls.append((url, folder_id))
        return KnowledgeCard(
            id="new-rag-id",
            title="Updated by reingest",
            url=url,
            siteName="Updated Source",
            folderId=folder_id,
            tags=[Tag(id="tag-updated", name="Updated")],
            summary="Updated summary",
            contentPreview="Updated preview",
            fullContent="Updated full content",
            notes="",
            note="",
            wordCount=256,
            createdAt="2026-06-12T00:00:00+00:00",
            updatedAt="2026-06-12T00:00:00+00:00",
        )

    monkeypatch.setattr("backend.app.main.rag_service.ingest", reingest)

    refresh_response = client.post("/api/cards/refresh-card/refresh", json={})
    regenerate_response = client.post("/api/cards/regenerate-card/regenerate")

    assert refresh_response.status_code == 200
    assert regenerate_response.status_code == 200
    assert refresh_response.json()["status"] == "running"
    assert refresh_response.json()["url"] == "https://example.com/new-note"
    assert regenerate_response.json()["id"] == "regenerate-card"
    assert regenerate_response.json()["summary"] == "Updated summary"
    assert regenerate_response.json()["userSummary"] is None

    deadline = perf_counter() + 1.0
    refreshed_card_id = None
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == refresh_response.json()["id"]), None)
        if task and task["status"] == "succeeded":
            refreshed_card_id = task["resultCardId"]
            break
        sleep(0.02)
    else:
        raise AssertionError("refresh import task did not update in time")

    assert ingest_calls == [
        ("https://example.com/new-note", "uncategorized"),
        ("https://example.com/new-note", "uncategorized"),
    ]
    assert refreshed_card_id == "new-rag-id"
    assert client.get("/api/cards/refresh-card").status_code == 404
    refreshed_card = client.get(f"/api/cards/{refreshed_card_id}").json()
    assert refreshed_card["summary"] == "Updated summary"
    assert refreshed_card["siteName"] == "Updated Source"


def test_refresh_and_regenerate_return_400_when_card_url_is_missing():
    client = TestClient(app)
    store.upsert_card(with_updates(make_card(card_id="missing-url-card"), url=""))

    refresh_response = client.post("/api/cards/missing-url-card/refresh", json={})
    regenerate_response = client.post("/api/cards/missing-url-card/regenerate")

    assert refresh_response.status_code == 400
    assert "缺少来源链接" in refresh_response.json()["detail"]["message"]
    assert regenerate_response.status_code == 400
    assert "缺少来源链接" in regenerate_response.json()["detail"]["message"]


def test_import_downloads_local_xiaohongshu_images(monkeypatch, tmp_path):
    client = TestClient(app)
    image_url = "https://ci.xiaohongshu.com/asset-1.jpg"

    monkeypatch.setattr("requests.get", lambda *args, **kwargs: FakeImageResponse(b"image-bytes"))
    monkeypatch.setattr(
        "backend.app.main.rag_service.ingest",
        lambda url, folder_id: with_updates(
            make_card(),
            imageAssets=[
                {
                    "id": "asset-source-1",
                    "cardId": "rag-card-1",
                    "sourceUrl": image_url,
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 0,
                    "status": "pending",
                    "createdAt": "2026-06-11T00:00:00+00:00",
                }
            ],
        ),
    )

    response = client.post("/api/import-tasks", json={"url": "https://www.xiaohongshu.com/explore/demo", "folderId": "uncategorized"})

    assert response.status_code == 200
    deadline = perf_counter() + 1.0
    card = None
    while perf_counter() < deadline:
        response_card = client.get("/api/cards/rag-card-1")
        if response_card.status_code == 200:
            card = response_card.json()
            break
        sleep(0.02)
    assert card is not None
    assert len(card["imageAssets"]) == 1
    assert card["imageAssets"][0]["sourceUrl"] == image_url
    assert card["imageAssets"][0]["localPath"]
    assert (tmp_path / card["imageAssets"][0]["localPath"]).exists()


def test_local_card_image_asset_can_be_served(monkeypatch, tmp_path):
    client = TestClient(app)
    image_url = "https://ci.xiaohongshu.com/asset-1.jpg"

    monkeypatch.setattr("requests.get", lambda *args, **kwargs: FakeImageResponse(b"served-image", "image/png"))
    created = store.upsert_card(
        with_updates(
            make_card(card_id="card-with-served-image"),
            imageAssets=[
                {
                    "id": "asset-source-1",
                    "cardId": "card-with-served-image",
                    "sourceUrl": image_url,
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 0,
                    "status": "pending",
                    "createdAt": "2026-06-11T00:00:00+00:00",
                }
            ],
        )
    )

    asset_response = client.get(f"/api/assets/{created.imageAssets[0].localPath}")

    assert asset_response.status_code == 200
    assert asset_response.content == b"served-image"
    assert asset_response.headers["content-type"].startswith("image/png")


def test_local_image_download_uses_platform_referer_headers(monkeypatch):
    calls = []

    def fake_get(url, **kwargs):
        calls.append((url, kwargs.get("headers") or {}))
        return FakeImageResponse(b"image-bytes")

    monkeypatch.setattr("requests.get", fake_get)

    store.upsert_card(
        with_updates(
            make_card(card_id="card-with-platform-images"),
            imageAssets=[
                {
                    "id": "asset-xhs",
                    "cardId": "card-with-platform-images",
                    "sourceUrl": "https://sns-webpic-qc.xhscdn.com/demo.webp",
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 0,
                    "status": "pending",
                    "createdAt": "2026-06-11T00:00:00+00:00",
                },
                {
                    "id": "asset-wechat",
                    "cardId": "card-with-platform-images",
                    "sourceUrl": "https://mmbiz.qpic.cn/demo.jpg",
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 1,
                    "status": "pending",
                    "createdAt": "2026-06-11T00:00:00+00:00",
                },
            ],
        )
    )

    assert calls[0][1]["Referer"] == "https://www.xiaohongshu.com/"
    assert calls[1][1]["Referer"] == "https://mp.weixin.qq.com/"
    assert "Mozilla/5.0" in calls[0][1]["User-Agent"]


def test_local_rag_duplicate_lookup_keeps_image_urls(tmp_path):
    db = KnowledgeDB(tmp_path / "knowledge.sqlite3")
    saved = db.upsert_item_and_card(
        user_id="personal",
        original_url="http://xhslink.com/o/4mP1DC1Nnbu",
        canonical_url="http://xhslink.com/o/4mP1DC1Nnbu",
        source="小红书",
        title="测试小红书",
        author="tester",
        published_at="",
        raw_text="正文",
        raw_markdown="# 标题\n\n正文",
        images=["https://example.com/image-1.jpg", "https://example.com/image-2.jpg"],
        item_metadata={"extractor": "xhs_state"},
        summary="摘要",
        tags=["测试"],
        searchable_text="测试 摘要 正文",
        embedding=[0.1, 0.2],
    )

    duplicate = db.get_card_by_item(saved["item_id"])

    assert duplicate is not None
    assert duplicate["images"] == ["https://example.com/image-1.jpg", "https://example.com/image-2.jpg"]
    assert duplicate["raw_markdown"] == "# 标题\n\n正文"


def test_local_rag_recreate_duplicate_generates_new_item_and_card_ids(tmp_path):
    db = KnowledgeDB(tmp_path / "knowledge.sqlite3")
    first = db.upsert_item_and_card(
        user_id="personal",
        original_url="https://example.com/duplicate",
        canonical_url="https://example.com/duplicate",
        source="Example",
        title="First import",
        author="tester",
        published_at="",
        raw_text="正文一",
        images=[],
        item_metadata={},
        summary="摘要一",
        tags=["测试"],
        searchable_text="测试 摘要一 正文一",
        embedding=[0.1, 0.2],
    )

    second = db.upsert_item_and_card(
        user_id="personal",
        original_url="https://example.com/duplicate",
        canonical_url="https://example.com/duplicate",
        source="Example",
        title="Second import",
        author="tester",
        published_at="",
        raw_text="正文二",
        images=[],
        item_metadata={},
        summary="摘要二",
        tags=["测试"],
        searchable_text="测试 摘要二 正文二",
        embedding=[0.3, 0.4],
        recreate_existing=True,
    )

    assert second["item_id"] != first["item_id"]
    assert second["id"] != first["id"]
    assert db.get_card_by_item(first["item_id"]) is None
    assert db.get_card_by_item(second["item_id"]) is not None


def test_delete_card_removes_local_image_assets(monkeypatch, tmp_path):
    client = TestClient(app)
    image_url = "https://ci.xiaohongshu.com/delete-me.jpg"

    monkeypatch.setattr("requests.get", lambda *args, **kwargs: FakeImageResponse(b"delete-image"))
    created = store.upsert_card(
        with_updates(
            make_card(card_id="card-with-image"),
            imageAssets=[
                {
                    "id": "asset-source-1",
                    "cardId": "card-with-image",
                    "sourceUrl": image_url,
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 0,
                    "status": "pending",
                    "createdAt": "2026-06-11T00:00:00+00:00",
                }
            ],
        )
    )
    local_path = tmp_path / created.imageAssets[0].localPath
    assert local_path.exists()

    response = client.delete("/api/cards/card-with-image")

    assert response.status_code == 200
    assert response.json()["imageAssets"] == []
    assert not local_path.exists()


def test_refresh_replaces_existing_local_image_assets(monkeypatch, tmp_path):
    client = TestClient(app)
    old_url = "https://ci.xiaohongshu.com/old.jpg"
    new_url = "https://ci.xiaohongshu.com/new.jpg"

    def fake_download(url, *args, **kwargs):
        payload = b"old-image" if url == old_url else b"new-image"
        return FakeImageResponse(payload)

    monkeypatch.setattr("requests.get", fake_download)
    original = store.upsert_card(
        with_updates(
            make_card(card_id="refresh-images"),
            imageAssets=[
                {
                    "id": "asset-old",
                    "cardId": "refresh-images",
                    "sourceUrl": old_url,
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 0,
                    "status": "pending",
                    "createdAt": "2026-06-11T00:00:00+00:00",
                }
            ],
        )
    )
    old_local_path = tmp_path / original.imageAssets[0].localPath
    assert old_local_path.exists()
    assert old_local_path.read_bytes() == b"old-image"

    monkeypatch.setattr(
        "backend.app.main.rag_service.ingest",
        lambda url, folder_id, recreate_on_duplicate=False: with_updates(
            make_card(card_id="different-rag-id"),
            id="different-rag-id",
            title="Refreshed title",
            imageAssets=[
                {
                    "id": "asset-new",
                    "cardId": "different-rag-id",
                    "sourceUrl": new_url,
                    "localPath": "",
                    "mimeType": "",
                    "sortOrder": 0,
                    "status": "pending",
                    "createdAt": "2026-06-12T00:00:00+00:00",
                }
            ],
        ),
    )

    response = client.post("/api/cards/refresh-images/refresh", json={})

    assert response.status_code == 200
    assert response.json()["status"] == "running"

    deadline = perf_counter() + 1.0
    card = None
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == response.json()["id"]), None)
        if task and task["status"] == "succeeded":
            card = client.get(f"/api/cards/{task['resultCardId']}").json()
            break
        sleep(0.02)
    else:
        raise AssertionError("refreshed card did not update in time")

    assert client.get("/api/cards/refresh-images").status_code == 404
    assert len(card["imageAssets"]) == 1
    assert card["imageAssets"][0]["sourceUrl"] == new_url
    refreshed_local_path = tmp_path / card["imageAssets"][0]["localPath"]
    assert refreshed_local_path.exists()
    assert refreshed_local_path.read_bytes() == b"new-image"


def test_duplicate_import_replaces_existing_product_card(monkeypatch):
    client = TestClient(app)
    old_card = make_card(card_id="duplicate-card", folder_id="uncategorized")
    store.upsert_card(old_card)

    monkeypatch.setattr(
        "backend.app.main.rag_service.find_existing_card_id_by_url",
        lambda url: "duplicate-card",
        raising=False,
    )
    monkeypatch.setattr(
        "backend.app.main.rag_service.ingest",
        lambda url, folder_id, recreate_on_duplicate=False: make_card(card_id="replacement-card", folder_id=folder_id),
    )

    response = client.post(
        "/api/import-tasks",
        json={"url": "https://example.com/new-note", "folderId": "uncategorized"},
    )

    assert response.status_code == 200

    deadline = perf_counter() + 1.0
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == response.json()["id"]), None)
        if task and task["status"] == "succeeded":
            break
        sleep(0.02)
    else:
        raise AssertionError("duplicate import task did not complete in time")

    assert client.get("/api/cards/duplicate-card").status_code == 404
    replacement = client.get("/api/cards/replacement-card")
    assert replacement.status_code == 200
    assert replacement.json()["url"] == "https://example.com/new-note"


def test_hot_article_import_returns_immediately_and_completes_in_background(monkeypatch):
    client = TestClient(app)
    store.upsert_hot_articles([
        HotArticle(
            id="hot-async",
            title="Async hot article",
            source="AIHOT",
            publishedAt="2026-06-18T00:00:00+00:00",
            summary="Async hot article summary",
            url="https://example.com/hot-async",
            status="idle",
            category="featured",
            importTaskId=None,
            importedCardId=None,
        )
    ])

    def slow_ingest(url: str, folder_id: str):
        sleep(0.2)
        return make_card(card_id="hot-import-card", folder_id=folder_id)

    monkeypatch.setattr("backend.app.main.rag_service.ingest", slow_ingest)

    started_at = perf_counter()
    response = client.post("/api/hot/articles/hot-async/import", json={"folderId": "uncategorized"})
    elapsed = perf_counter() - started_at

    assert response.status_code == 200
    assert response.json()["status"] == "running"
    assert elapsed < 0.15

    deadline = perf_counter() + 1.0
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == response.json()["id"]), None)
        if task and task["status"] == "succeeded":
            break
        sleep(0.02)
    else:
        raise AssertionError("hot article import task did not complete in time")


def test_hot_articles_returns_error_when_remote_fetch_fails(monkeypatch):
    client = TestClient(app)
    monkeypatch.setattr("backend.app.main.fetch_aihot_articles", lambda: (_ for _ in ()).throw(RuntimeError("upstream down")))

    response = client.get("/api/hot/articles")

    assert response.status_code == 502
    assert "热文拉取失败" in response.json()["detail"]["message"]


def test_product_store_persists_to_sqlite(tmp_path):
    data_path = tmp_path / "product_store.sqlite3"
    first_store = ProductStore(data_path=data_path)
    created = first_store.create_folder(FolderCreate(name="Persisted"))

    second_store = ProductStore(data_path=data_path)
    folder_names = [folder.name for folder in second_store.list_folders()]

    assert created.name in folder_names


def test_product_database_schema_contains_required_tables_and_columns(tmp_path):
    data_path = tmp_path / "product_store.sqlite3"
    product_store = ProductStore(data_path=data_path)

    expected_columns = {
        "folder": {"id", "name", "parent_id", "is_system", "sort_order", "created_at", "updated_at"},
        "import_task": {
            "id", "url", "folder_id", "status", "stage", "progress", "error_code",
            "error_message", "retry_count", "result_card_id", "target_card_id", "hot_article_id",
            "created_at", "updated_at",
        },
        "knowledge_card": {
            "id", "item_id", "folder_id", "note", "is_important", "is_bad", "deleted_at",
            "deleted_from_folder_id", "refresh_status", "last_refreshed_at",
            "user_title", "user_summary", "searchable_text",
            "suggested_questions_json",
        },
        "knowledge_item": {"id", "card_id", "raw_text", "parsed_text", "word_count", "created_at"},
        "card_tag": {"card_id", "tag_id", "name"},
        "card_image_asset": {"id", "card_id", "source_url", "local_path", "mime_type", "sort_order", "status", "created_at"},
        "search_index": {"card_id", "searchable_text", "updated_at"},
    }

    with product_store.db.connect() as connection:
        for table, columns in expected_columns.items():
            actual_columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})")}
            assert columns <= actual_columns

        uncategorized = connection.execute("SELECT * FROM folder WHERE id = 'uncategorized'").fetchone()
        assert uncategorized is not None
        assert uncategorized["is_system"] == 1


def test_product_database_persists_suggested_questions(tmp_path):
    product_store = ProductStore(data_path=tmp_path / "product_store.sqlite3")
    product_store.upsert_card(make_card(card_id="question-card"))

    reloaded_store = ProductStore(data_path=tmp_path / "product_store.sqlite3")
    card = reloaded_store.get_card("question-card")

    assert card.suggestedQuestions == [
        "这篇文章的核心观点是什么？",
        "我可以如何应用这篇文章？",
        "这篇文章有哪些值得追问的细节？",
    ]


def test_runtime_config_uses_absolute_config_path():
    assert runtime_config.CONFIG_PATH.is_absolute()


def test_runtime_config_uses_override_path(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path))
    monkeypatch.setattr(runtime_config, "CONFIG_PATH", tmp_path / "runtime_config.json")

    status = save_runtime_config(RuntimeConfigUpdate(siliconflowApiKey="sf-test"))

    assert Path(status.configPath) == tmp_path / "runtime_config.json"
    assert (tmp_path / "runtime_config.json").exists()


def test_product_store_uses_override_path(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path))

    store = ProductStore()

    assert store.data_path == tmp_path / "product_store.sqlite3"


def test_cors_allows_tauri_localhost_origin():
    client = TestClient(app)

    response = client.options(
        "/api/home/summary",
        headers={
            "Origin": "http://tauri.localhost",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://tauri.localhost"


def test_search_and_answer_endpoints(monkeypatch):
    client = TestClient(app)
    card = make_card()

    monkeypatch.setattr("backend.app.main.rag_service.rewrite", lambda query: "normalization")
    monkeypatch.setattr(
        "backend.app.main.rag_service.search",
        lambda query: (
            "normalization",
            [SearchResult(cardId=card.id, card=card, score=0.9, matchedText=card.summary, matchedField="summary", highlights=[card.summary])],
        ),
    )
    monkeypatch.setattr(
        "backend.app.main.rag_service.answer",
        lambda question, cardIds: AnswerResponse(
            answer="RAG answer",
            citations=[CitationSource(cardId=card.id, title=card.title, url=card.url, snippet=card.summary)],
            usedCardIds=[card.id],
            model="test-model",
            createdAt="2026-06-11T00:00:00+00:00",
        ),
    )

    rewrite_response = client.post("/api/search/rewrite", json={"query": "范式"})
    assert rewrite_response.status_code == 200
    assert rewrite_response.json()["query"] == "normalization"

    search_response = client.post("/search", json={"query": "normalization"})
    assert search_response.status_code == 200
    results = search_response.json()
    assert results

    answer_response = client.post(
        "/answer",
        json={"question": "这篇文章讲了什么？", "cardIds": [results[0]["cardId"]]},
    )
    assert answer_response.status_code == 200
    assert answer_response.json()["citations"]


def test_stream_answer_and_archive(monkeypatch):
    client = TestClient(app)
    card = make_card()
    store.upsert_card(card)

    monkeypatch.setattr("backend.app.main.rag_service.answer_stream", lambda question, cardIds: iter(["流式", "回答"]))

    stream_response = client.post("/answer/stream", json={"question": "讲了什么？", "cardIds": [card.id]})
    assert stream_response.status_code == 200
    assert "event: token" in stream_response.text
    assert "流式回答" in stream_response.text

    archive_response = client.post(
        f"/api/cards/{card.id}/answer-archives",
        json={
            "cardId": card.id,
            "question": "讲了什么？",
            "answer": "流式回答",
            "usedCardIds": [card.id],
            "model": "test-stream-model",
        },
    )
    assert archive_response.status_code == 200
    assert archive_response.json()["answer"] == "流式回答"

    card_response = client.get(f"/api/cards/{card.id}")
    assert card_response.status_code == 200
    assert card_response.json()["answerArchives"][0]["question"] == "讲了什么？"


def test_search_excludes_deleted_cards(monkeypatch):
    client = TestClient(app)
    deleted_card = make_card(card_id="deleted-search-card")
    monkeypatch.setattr("backend.app.main.rag_service.ingest", lambda url, folder_id: deleted_card)
    monkeypatch.setattr(
        "backend.app.main.rag_service.search",
        lambda query: (
            query,
            [SearchResult(cardId=deleted_card.id, card=deleted_card, score=0.9, matchedText=deleted_card.summary, matchedField="summary", highlights=[deleted_card.summary])],
        ),
    )

    import_response = client.post(
        "/api/import-tasks",
        json={"url": "https://example.com/deleted-search-target", "folderId": "uncategorized"},
    )
    deadline = perf_counter() + 1.0
    card_id = None
    while perf_counter() < deadline:
        task = next((item for item in client.get("/api/import-tasks/recent").json() if item["id"] == import_response.json()["id"]), None)
        if task and task["status"] == "succeeded":
            card_id = task["resultCardId"]
            break
        sleep(0.02)
    assert card_id is not None
    delete_response = client.delete(f"/api/cards/{card_id}")
    assert delete_response.status_code == 200

    search_response = client.post("/search", json={"query": "deleted-search-target"})
    assert search_response.status_code == 200
    returned_ids = [item["cardId"] for item in search_response.json()]
    assert card_id not in returned_ids


def test_runtime_settings_can_be_saved_and_reload_rag(tmp_path, monkeypatch):
    from backend.app import runtime_config
    from backend.reference.local_rag import config as rag_config

    client = TestClient(app)
    config_path = tmp_path / "runtime_config.json"
    reload_calls = []

    monkeypatch.setattr(runtime_config, "CONFIG_PATH", config_path)
    monkeypatch.setattr(rag_config, "_load_dotenv", lambda: None)
    monkeypatch.setattr("backend.app.main.rag_service.reload", lambda: reload_calls.append("reloaded"))
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("CHAT_MODEL", raising=False)

    response = client.put(
        "/api/settings/runtime",
        json={
            "siliconflowApiKey": "sk-test-key",
            "chatModel": "test-chat-model",
            "embeddingModel": "test-embedding-model",
            "useLancedb": True,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["chatConfigured"] is True
    assert body["embeddingConfigured"] is True
    assert body["chatModel"] == "test-chat-model"
    assert body["embeddingModel"] == "test-embedding-model"
    assert body["useLancedb"] is True
    assert reload_calls == ["reloaded"]


def test_siliconflow_key_update_keeps_chat_override_but_replaces_stale_embedding_and_rerank_keys(tmp_path, monkeypatch):
    from backend.app import runtime_config
    from backend.reference.local_rag.config import get_settings

    config_path = tmp_path / "runtime_config.json"
    monkeypatch.setattr(runtime_config, "CONFIG_PATH", config_path)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-old-key")
    monkeypatch.delenv("CHAT_API_KEY", raising=False)
    monkeypatch.delenv("EMBEDDING_API_KEY", raising=False)
    monkeypatch.delenv("RERANK_API_KEY", raising=False)
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.delenv("SILICONFLOW_BASE_URL", raising=False)

    runtime_config.save_runtime_config(
        RuntimeConfigUpdate(
            siliconflowApiKey="siliconflow-old-key",
            chatApiKey="chat-old-key",
            embeddingApiKey="embedding-old-key",
            rerankApiKey="rerank-old-key",
        )
    )

    runtime_config.save_runtime_config(
        RuntimeConfigUpdate(
            siliconflowApiKey="siliconflow-new-key",
            chatApiKey="",
            embeddingApiKey="",
            rerankApiKey="",
        )
    )

    saved_payload = runtime_config.load_runtime_config()
    settings = get_settings()

    assert saved_payload["siliconflowApiKey"] == "siliconflow-new-key"
    assert saved_payload["chatApiKey"] == "chat-old-key"
    assert "embeddingApiKey" not in saved_payload
    assert "rerankApiKey" not in saved_payload
    assert settings.chat_api_key == "chat-old-key"
    assert settings.embedding_api_key == "siliconflow-new-key"
    assert settings.rerank_api_key == "siliconflow-new-key"


def test_runtime_status_reports_effective_siliconflow_chat_defaults(tmp_path, monkeypatch):
    from backend.app import runtime_config
    from backend.reference.local_rag import config as rag_config

    config_path = tmp_path / "runtime_config.json"
    monkeypatch.setattr(runtime_config, "CONFIG_PATH", config_path)
    monkeypatch.setattr(rag_config, "_load_dotenv", lambda: None)
    monkeypatch.delenv("CHAT_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.setenv("SILICONFLOW_API_KEY", "sk-siliconflow-live-key")

    runtime_config.save_runtime_config(
        RuntimeConfigUpdate(
            siliconflowApiKey="sk-siliconflow-live-key",
            chatBaseUrl="https://api.deepseek.com",
            chatModel="deepseek-chat",
        )
    )

    status = runtime_config.runtime_config_status()

    assert status.chatBaseUrl == "https://api.siliconflow.cn/v1"
    assert status.chatModel == "deepseek-ai/DeepSeek-V4-Flash"


def test_packaged_rag_config_does_not_load_development_dotenv(tmp_path, monkeypatch):
    from backend.reference.local_rag import config as rag_config

    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text("SILICONFLOW_API_KEY=should-not-load\nX_AUTH_TOKEN=should-not-load\n", encoding="utf-8")
    monkeypatch.setattr(rag_config.sys, "frozen", True, raising=False)
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.delenv("X_AUTH_TOKEN", raising=False)

    rag_config._load_dotenv()

    assert "SILICONFLOW_API_KEY" not in os.environ
    assert "X_AUTH_TOKEN" not in os.environ


def test_get_settings_prefers_deepseek_key_for_direct_chat_and_normalizes_legacy_model(monkeypatch):
    from backend.reference.local_rag import config as rag_config

    monkeypatch.setattr(rag_config, "_load_dotenv", lambda: None)
    monkeypatch.delenv("CHAT_API_KEY", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-deepseek-live-key")
    monkeypatch.delenv("SILICONFLOW_API_KEY", raising=False)
    monkeypatch.setenv("CHAT_MODEL", "deepseek-chat")
    monkeypatch.delenv("DEEPSEEK_BASE_URL", raising=False)

    settings = rag_config.get_settings()

    assert settings.chat_api_key == "sk-deepseek-live-key"
    assert settings.chat_base_url == "https://api.deepseek.com"
    assert settings.chat_model == "deepseek-v4-flash"
