from __future__ import annotations

import json
import os
from typing import Dict

from .app_paths import resolve_backend_paths
from .schemas import RuntimeConfigStatus, RuntimeConfigUpdate

DEFAULT_SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
DEFAULT_CHAT_BASE_URL = DEFAULT_SILICONFLOW_BASE_URL
DEFAULT_CHAT_MODEL = "deepseek-ai/DeepSeek-V4-Flash"

CONFIG_PATH = resolve_backend_paths().runtime_config_path

SECRET_FIELDS = {"siliconflowApiKey", "chatApiKey", "embeddingApiKey", "rerankApiKey"}
PROVIDER_FALLBACK_SECRET_FIELDS = {"embeddingApiKey", "rerankApiKey"}

FIELD_TO_ENV = {
    "siliconflowApiKey": "SILICONFLOW_API_KEY",
    "siliconflowBaseUrl": "SILICONFLOW_BASE_URL",
    "chatApiKey": "CHAT_API_KEY",
    "chatBaseUrl": "CHAT_BASE_URL",
    "chatModel": "CHAT_MODEL",
    "embeddingApiKey": "EMBEDDING_API_KEY",
    "embeddingBaseUrl": "EMBEDDING_BASE_URL",
    "embeddingModel": "EMBEDDING_MODEL",
    "rerankApiKey": "RERANK_API_KEY",
    "rerankApiUrl": "RERANK_API_URL",
    "rerankModel": "RERANK_MODEL",
    "useLancedb": "USE_LANCEDB",
}

DEFAULTS = {
    "siliconflowBaseUrl": DEFAULT_SILICONFLOW_BASE_URL,
    "chatBaseUrl": DEFAULT_CHAT_BASE_URL,
    "chatModel": DEFAULT_CHAT_MODEL,
    "embeddingBaseUrl": DEFAULT_SILICONFLOW_BASE_URL,
    "embeddingModel": "Qwen/Qwen3-Embedding-0.6B",
    "rerankApiUrl": "",
    "rerankModel": "",
    "useLancedb": "false",
}


def load_runtime_config() -> Dict[str, str]:
    if not CONFIG_PATH.exists():
        return {}
    try:
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(payload, dict):
        return {}
    return {str(key): str(value) for key, value in payload.items() if value is not None}


def apply_runtime_config() -> None:
    values = load_runtime_config()
    for field, env_name in FIELD_TO_ENV.items():
        value = values.get(field, "")
        normalized = value.strip()
        if normalized:
            os.environ[env_name] = normalized
        else:
            os.environ.pop(env_name, None)


def save_runtime_config(update: RuntimeConfigUpdate) -> RuntimeConfigStatus:
    current = load_runtime_config()
    payload = update.model_dump(exclude_unset=True) if hasattr(update, "model_dump") else update.dict(exclude_unset=True)

    if str(payload.get("siliconflowApiKey") or "").strip():
        for field in PROVIDER_FALLBACK_SECRET_FIELDS:
            if field in payload and not str(payload[field] or "").strip():
                current.pop(field, None)

    for field, value in payload.items():
        if value is None:
            continue
        normalized = str(value).strip()
        if field in SECRET_FIELDS and not normalized:
            continue
        current[field] = normalized

    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    apply_runtime_config()
    return runtime_config_status()


def _configured(field: str) -> bool:
    values = load_runtime_config()
    env_name = FIELD_TO_ENV[field]
    return bool(values.get(field, "").strip() or os.getenv(env_name, "").strip())


def _value(field: str) -> str:
    values = load_runtime_config()
    env_name = FIELD_TO_ENV[field]
    return values.get(field) or os.getenv(env_name) or DEFAULTS.get(field, "")


def runtime_config_status() -> RuntimeConfigStatus:
    from backend.reference.local_rag.config import get_settings

    settings = get_settings()
    return RuntimeConfigStatus(
        chatConfigured=_configured("chatApiKey") or _configured("siliconflowApiKey"),
        embeddingConfigured=_configured("embeddingApiKey") or _configured("siliconflowApiKey"),
        rerankConfigured=_configured("rerankApiKey") or bool(_value("rerankApiUrl")),
        siliconflowConfigured=_configured("siliconflowApiKey"),
        siliconflowBaseUrl=_value("siliconflowBaseUrl"),
        chatBaseUrl=settings.chat_base_url,
        chatModel=settings.chat_model,
        embeddingBaseUrl=_value("embeddingBaseUrl"),
        embeddingModel=_value("embeddingModel"),
        rerankApiUrl=_value("rerankApiUrl"),
        rerankModel=_value("rerankModel"),
        useLancedb=_value("useLancedb").lower() in {"1", "true", "yes", "on"},
        configPath=str(CONFIG_PATH),
    )


apply_runtime_config()
