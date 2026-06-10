from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv() -> None:
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
    data_dir = Path(os.getenv("DATA_DIR", "local_rag_data"))
    return Settings(
        siliconflow_api_key=os.getenv("SILICONFLOW_API_KEY", ""),
        siliconflow_base_url=os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1").rstrip("/"),
        chat_api_key=os.getenv("CHAT_API_KEY", os.getenv("DEEPSEEK_API_KEY", os.getenv("SILICONFLOW_API_KEY", ""))),
        chat_base_url=os.getenv(
            "CHAT_BASE_URL",
            os.getenv("DEEPSEEK_BASE_URL", os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")),
        ).rstrip("/"),
        embedding_api_key=os.getenv("EMBEDDING_API_KEY", os.getenv("SILICONFLOW_API_KEY", "")),
        embedding_base_url=os.getenv("EMBEDDING_BASE_URL", os.getenv("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1")).rstrip("/"),
        rerank_api_key=os.getenv("RERANK_API_KEY", os.getenv("SILICONFLOW_API_KEY", "")),
        chat_model=os.getenv("CHAT_MODEL", "deepseek-ai/DeepSeek-V3"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B"),
        rerank_api_url=os.getenv("RERANK_API_URL", ""),
        rerank_model=os.getenv("RERANK_MODEL", ""),
        data_dir=data_dir,
        sqlite_path=Path(os.getenv("SQLITE_PATH", str(data_dir / "store.db"))),
        lancedb_dir=Path(os.getenv("LANCEDB_DIR", str(data_dir / "lancedb"))),
        use_lancedb=os.getenv("USE_LANCEDB", "false").lower() in {"1", "true", "yes", "on"},
    )
