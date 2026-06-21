from backend.reference.local_rag.config import get_settings


def test_siliconflow_key_is_used_when_specific_keys_are_empty(monkeypatch):
    monkeypatch.setattr("backend.reference.local_rag.config._load_dotenv", lambda: None)
    monkeypatch.setenv("SILICONFLOW_API_KEY", "sf-test-key")
    monkeypatch.delenv("CHAT_API_KEY", raising=False)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    monkeypatch.delenv("EMBEDDING_API_KEY", raising=False)
    monkeypatch.delenv("RERANK_API_KEY", raising=False)

    settings = get_settings()

    assert settings.chat_api_key == "sf-test-key"
    assert settings.embedding_api_key == "sf-test-key"
    assert settings.rerank_api_key == "sf-test-key"


def test_deepseek_chat_key_is_preferred_for_default_chat(monkeypatch):
    monkeypatch.setattr("backend.reference.local_rag.config._load_dotenv", lambda: None)
    monkeypatch.setenv("SILICONFLOW_API_KEY", "sf-test-key")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "deepseek-test-key")
    monkeypatch.delenv("CHAT_API_KEY", raising=False)
    monkeypatch.delenv("CHAT_BASE_URL", raising=False)

    settings = get_settings()

    assert settings.chat_base_url == "https://api.deepseek.com"
    assert settings.chat_api_key == "deepseek-test-key"
