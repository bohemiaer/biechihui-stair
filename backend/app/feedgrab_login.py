from __future__ import annotations

import os
import json
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


FEEDGRAB_LOGIN_PLATFORMS: Dict[str, str] = {
    "x": "twitter",
    "twitter": "twitter",
    "xhs": "xhs",
    "xiaohongshu": "xhs",
    "wechat": "wechat",
    "mpweixin": "wechat",
}


def start_feedgrab_login(platform: str) -> dict[str, int | str]:
    normalized = str(platform or "").strip().lower()
    feedgrab_platform = FEEDGRAB_LOGIN_PLATFORMS.get(normalized)
    if not feedgrab_platform:
        raise ValueError("不支持的平台，请选择 X、小红书或微信。")

    command = _feedgrab_command()
    session_dir = _session_dir()
    session_dir.mkdir(parents=True, exist_ok=True)
    session_path = session_dir / f"{feedgrab_platform}.json"
    session_mtime = session_path.stat().st_mtime if session_path.exists() else None
    log_path = _login_log_path(session_dir, feedgrab_platform)
    started_at = time.time()
    env = os.environ.copy()
    env.setdefault("FEEDGRAB_DATA_DIR", str(session_dir))
    log_handle = log_path.open("ab")
    log_handle.write(
        (
            f"\n[{datetime.now(timezone.utc).isoformat()}] "
            f"Starting feedgrab login: {' '.join([*command, 'login', feedgrab_platform])}\n"
        ).encode("utf-8", errors="replace")
    )
    log_handle.flush()
    try:
        process = subprocess.Popen(
            [*command, "login", feedgrab_platform],
            cwd=Path.cwd(),
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            creationflags=_creation_flags(),
        )
    except FileNotFoundError as exc:
        log_handle.close()
        raise RuntimeError("feedgrab CLI 未找到，请设置 FEEDGRAB_COMMAND 或安装 feedgrab。") from exc
    except OSError as exc:
        log_handle.close()
        raise RuntimeError(f"feedgrab 登录进程启动失败：{exc}") from exc

    try:
        _ensure_login_process_started(
            process=process,
            session_path=session_path,
            previous_session_mtime=session_mtime,
            log_path=log_path,
            started_at=started_at,
        )
    finally:
        log_handle.close()

    return {"platform": feedgrab_platform, "pid": int(process.pid), "logPath": str(log_path)}


def get_feedgrab_login_statuses() -> dict[str, Any]:
    session_dir = _session_dir()
    return {
        "sessionDir": str(session_dir),
        "platforms": {
            "x": _platform_status(
                label="X",
                session_path=session_dir / "twitter.json",
                required_cookies=["auth_token", "ct0"],
                env_logged_in=bool(os.getenv("X_AUTH_TOKEN", "").strip() and os.getenv("X_CT0", "").strip()),
            ),
            "xhs": _platform_status(
                label="小红书",
                session_path=session_dir / "xhs.json",
                required_cookies=["a1"],
            ),
            "wechat": _platform_status(
                label="微信",
                session_path=session_dir / "wechat.json",
                required_cookies=["slave_sid", "data_ticket"],
                stale_after_hours=96,
            ),
        },
    }


def _feedgrab_command() -> list[str]:
    configured = os.getenv("FEEDGRAB_COMMAND", "").strip()
    if configured:
        return shlex.split(configured, posix=os.name != "nt")

    if getattr(sys, "frozen", False):
        return [sys.executable, "--feedgrab"]

    local_exe = Path.cwd() / ".venv-feedgrab" / "Scripts" / "feedgrab.exe"
    if local_exe.exists():
        return [str(local_exe)]

    return ["feedgrab"]


def _session_dir() -> Path:
    configured = os.getenv("FEEDGRAB_DATA_DIR", "").strip()
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else Path.cwd() / path

    app_data_dir = os.getenv("BIECHIHUI_APP_DATA_DIR", "").strip()
    if app_data_dir:
        return Path(app_data_dir) / "sessions"

    return Path.cwd() / "sessions"


def _login_log_path(session_dir: Path, platform: str) -> Path:
    return session_dir / f"feedgrab-login-{platform}.log"


def _startup_timeout_seconds() -> float:
    raw = os.getenv("FEEDGRAB_LOGIN_STARTUP_TIMEOUT", "2").strip()
    try:
        return max(0.1, float(raw))
    except ValueError:
        return 2.0


def _ensure_login_process_started(
    *,
    process: subprocess.Popen,
    session_path: Path,
    previous_session_mtime: Optional[float],
    log_path: Path,
    started_at: float,
) -> None:
    try:
        return_code = process.wait(timeout=_startup_timeout_seconds())
    except subprocess.TimeoutExpired:
        return

    if return_code == 0 and _session_was_updated(session_path, previous_session_mtime, started_at):
        return

    detail = _read_log_tail(log_path)
    message = (
        "feedgrab 登录进程启动后立即退出，浏览器窗口没有打开。"
        f"日志：{log_path}"
    )
    if detail:
        message += f"\n{detail}"
    raise RuntimeError(message)


def _session_was_updated(session_path: Path, previous_mtime: Optional[float], started_at: float) -> bool:
    if not session_path.exists():
        return False
    current_mtime = session_path.stat().st_mtime
    if previous_mtime is None:
        return current_mtime >= started_at - 1
    return current_mtime > previous_mtime


def _read_log_tail(log_path: Path, max_chars: int = 1200) -> str:
    try:
        text = log_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""
    return text[-max_chars:].strip()


def _platform_status(
    *,
    label: str,
    session_path: Path,
    required_cookies: list[str],
    stale_after_hours: Optional[int] = None,
    env_logged_in: bool = False,
) -> dict[str, Any]:
    if env_logged_in:
        return {
            "label": label,
            "loggedIn": True,
            "state": "logged_in",
            "message": "已通过环境变量配置登录态",
            "sessionPath": str(session_path),
            "updatedAt": "",
            "ageHours": None,
            "missingCookies": [],
        }

    if not session_path.exists():
        return {
            "label": label,
            "loggedIn": False,
            "state": "missing",
            "message": "未检测到登录态",
            "sessionPath": str(session_path),
            "updatedAt": "",
            "ageHours": None,
            "missingCookies": required_cookies,
        }

    updated_at = datetime.fromtimestamp(session_path.stat().st_mtime, tz=timezone.utc)
    age_hours = max(0.0, (datetime.now(timezone.utc) - updated_at).total_seconds() / 3600)
    cookies = _read_cookie_names(session_path)
    missing = [name for name in required_cookies if name not in cookies]
    if missing:
        state = "invalid"
        message = f"已找到 session，但缺少关键 Cookie：{', '.join(missing)}"
        logged_in = False
    elif stale_after_hours is not None and age_hours > stale_after_hours:
        state = "stale"
        message = f"登录态可能已过期，已保存约 {int(age_hours)} 小时"
        logged_in = False
    else:
        state = "logged_in"
        message = "已检测到有效登录态"
        logged_in = True

    return {
        "label": label,
        "loggedIn": logged_in,
        "state": state,
        "message": message,
        "sessionPath": str(session_path),
        "updatedAt": updated_at.isoformat(),
        "ageHours": round(age_hours, 1),
        "missingCookies": missing,
    }


def _read_cookie_names(session_path: Path) -> set[str]:
    try:
        data = json.loads(session_path.read_text(encoding="utf-8"))
    except Exception:
        return set()
    cookies = data.get("cookies", [])
    if not isinstance(cookies, list):
        return set()
    return {str(cookie.get("name")) for cookie in cookies if isinstance(cookie, dict) and cookie.get("name")}


def _creation_flags() -> int:
    if os.name != "nt":
        return 0
    return getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
