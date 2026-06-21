from pathlib import Path

from backend.app.app_paths import resolve_backend_paths


def test_resolve_backend_paths_prefers_explicit_base_dir(tmp_path: Path):
    paths = resolve_backend_paths(base_dir=tmp_path)

    assert paths.base_dir == tmp_path
    assert paths.product_db_path == tmp_path / "product_store.sqlite3"
    assert paths.runtime_config_path == tmp_path / "runtime_config.json"
    assert paths.logs_dir == tmp_path / "logs"
    assert paths.rag_data_dir == tmp_path / "local_rag"


def test_resolve_backend_paths_uses_env_override(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("BIECHIHUI_APP_DATA_DIR", str(tmp_path))

    paths = resolve_backend_paths()

    assert paths.base_dir == tmp_path
    assert paths.product_db_path.parent == tmp_path
    assert paths.runtime_config_path.parent == tmp_path
