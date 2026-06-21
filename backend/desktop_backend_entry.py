from __future__ import annotations

import os
import sys

import uvicorn

from backend.app.main import app


def run_feedgrab_cli() -> None:
    from feedgrab.cli import main as feedgrab_main

    sys.argv = ["feedgrab", *sys.argv[2:]]
    feedgrab_main()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--feedgrab":
        run_feedgrab_cli()
        raise SystemExit(0)

    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8001")))
