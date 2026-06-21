from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path

from backend.app.app_paths import resolve_backend_paths

DEFAULT_SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_SILICONFLOW_CHAT_MODEL = "deepseek-ai/DeepSeek-V4-Flash"
DEFAULT_DEEPSEEK_CHAT_MODEL = "deepseek-v4-flash"


def _load_dotenv() -> None:
    if getattr(sys, "frozen", False):
        return

    project_root = Path(__file__).resolve().parent.parent
    candidates = [Path.cwd() / ".env", project_root / ".env", Path.cwd() / ".env.example", project_root / ".env.example"]
    env_path = next((path for path in candidates if path.exists()), None)
    if env_path is None:
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not os.environ.get(key, "").strip():
            os.environ[key] = value.strip().strip('"').strip("'")


def _env_first(*keys: str, default: str = "") -> str:
    for key in keys:
        value = os.getenv(key, "").strip()
        if value:
            return value
    return default


def _normalize_chat_model(base_url: str, model: str) -> str:
    normalized_model = model.strip()
    normalized_base_url = base_url.rstrip("/").lower()

    if "api.deepseek.com" in normalized_base_url:
        if normalized_model in {"", "deepseek-chat", "single-command-check"} or not normalized_model.startswith("deepseek-v4-"):
            return DEFAULT_DEEPSEEK_CHAT_MODEL
        return normalized_model

    if "siliconflow.cn" in normalized_base_url:
        if normalized_model in {"", "deepseek-chat", "single-command-check"}:
            return DEFAULT_SILICONFLOW_CHAT_MODEL
        if normalized_model == "deepseek-v4-flash":
            return DEFAULT_SILICONFLOW_CHAT_MODEL
        if normalized_model == "deepseek-v4-pro":
            return "deepseek-ai/DeepSeek-V4-Pro"
        return normalized_model

    if normalized_model in {"", "deepseek-chat", "single-command-check"}:
        return DEFAULT_SILICONFLOW_CHAT_MODEL

    return normalized_model


@dataclass(frozen=True)
class Settings:
    siliconflow_api_key: str
    siliconflow_base_url: str
    chat_api_key: str
    chat_base_url: str
    embedding_api_key: str
    embedding_base_url: str
    rerank_api_key: str
    chat_model: str
    embedding_model: str
    rerank_api_url: str
    rerank_model: str
    data_dir: Path
    sqlite_path: Path
    lancedb_dir: Path
    use_lancedb: bool


def get_settings() -> Settings:
    _load_dotenv()
    data_dir = Path(os.getenv("DATA_DIR", str(resolve_backend_paths().rag_data_dir)))
    direct_chat_api_key = os.getenv("CHAT_API_KEY", "").strip()
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    siliconflow_api_key = os.getenv("SILICONFLOW_API_KEY", "").strip()

    if direct_chat_api_key:
        chat_api_key = direct_chat_api_key
        chat_base_url = _env_first("CHAT_BASE_URL", default=DEFAULT_DEEPSEEK_BASE_URL).rstrip("/")
    elif deepseek_api_key:
        chat_api_key = deepseek_api_key
        chat_base_url = _env_first("DEEPSEEK_BASE_URL", default=DEFAULT_DEEPSEEK_BASE_URL).rstrip("/")
    else:
        chat_api_key = siliconflow_api_key
        chat_base_url = _env_first("SILICONFLOW_BASE_URL", default=DEFAULT_SILICONFLOW_BASE_URL).rstrip("/")

    chat_model = _normalize_chat_model(chat_base_url, os.getenv("CHAT_MODEL", ""))

    return Settings(
        siliconflow_api_key=siliconflow_api_key,
        siliconflow_base_url=_env_first("SILICONFLOW_BASE_URL", default=DEFAULT_SILICONFLOW_BASE_URL).rstrip("/"),
        chat_api_key=chat_api_key,
        chat_base_url=chat_base_url,
        embedding_api_key=_env_first("EMBEDDING_API_KEY", "SILICONFLOW_API_KEY"),
        embedding_base_url=_env_first("EMBEDDING_BASE_URL", "SILICONFLOW_BASE_URL", default=DEFAULT_SILICONFLOW_BASE_URL).rstrip("/"),
        rerank_api_key=_env_first("RERANK_API_KEY", "SILICONFLOW_API_KEY"),
        chat_model=chat_model,
        embedding_model=_env_first("EMBEDDING_MODEL", default="Qwen/Qwen3-Embedding-0.6B"),
        rerank_api_url=_env_first("RERANK_API_URL"),
        rerank_model=_env_first("RERANK_MODEL"),
        data_dir=data_dir,
        sqlite_path=Path(os.getenv("SQLITE_PATH", str(data_dir / "store.db"))),
        lancedb_dir=Path(os.getenv("LANCEDB_DIR", str(data_dir / "lancedb"))),
        use_lancedb=os.getenv("USE_LANCEDB", "false").lower() in {"1", "true", "yes", "on"},
    )
