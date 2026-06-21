from __future__ import annotations

import uvicorn
import os

from .main import app


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8001")))
