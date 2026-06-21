from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class BackendPaths:
    base_dir: Path
    logs_dir: Path
    product_db_path: Path
    runtime_config_path: Path
    rag_data_dir: Path


def _default_dev_base_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "backend" / "data"


def resolve_backend_paths(base_dir: Path | None = None) -> BackendPaths:
    root = Path(base_dir or os.getenv("BIECHIHUI_APP_DATA_DIR") or _default_dev_base_dir()).resolve()

    return BackendPaths(
        base_dir=root,
        logs_dir=root / "logs",
        product_db_path=root / "product_store.sqlite3",
        runtime_config_path=root / "runtime_config.json",
        rag_data_dir=root / "local_rag",
    )
