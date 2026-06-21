from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any, Optional

from .extractors import ExtractedContent, _source_from_host, canonicalize_url, validate_extracted_content


FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.S)
MARKDOWN_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
MARKDOWN_LINK_RE = re.compile(r"(?<!!)\[([^\]]+)\]\(([^)]+)\)")
HTML_IMAGE_RE = re.compile(r"<img\b[^>]*>", re.I)


def extract_url_with_feedgrab(url: str, *, output_root: Path, timeout: int = 180) -> ExtractedContent:
    output_root.mkdir(parents=True, exist_ok=True)
    run_dir = output_root / uuid.uuid4().hex
    run_dir.mkdir(parents=True, exist_ok=True)

    command = _feedgrab_command()
    env = os.environ.copy()
    env["OUTPUT_DIR"] = str(run_dir)
    env.setdefault("FEEDGRAB_DATA_DIR", str(_feedgrab_data_dir()))

    try:
        subprocess.run(
            [*command, url],
            cwd=Path.cwd(),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=True,
        )
    except FileNotFoundError as exc:
        raise RuntimeError("feedgrab CLI 未找到，请设置 FEEDGRAB_COMMAND 或安装 feedgrab。") from exc
    except subprocess.CalledProcessError as exc:
        detail = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(f"feedgrab 抓取失败：{detail[:1000]}") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"feedgrab 抓取超时：{url}") from exc

    markdown_path = _latest_markdown_file(run_dir)
    if markdown_path is None:
        raise RuntimeError("feedgrab 抓取完成但没有生成 Markdown 文件。")

    return parse_feedgrab_markdown(markdown_path, requested_url=url)


def parse_feedgrab_markdown(markdown_path: Path, *, requested_url: str) -> ExtractedContent:
    raw_markdown = markdown_path.read_text(encoding="utf-8")
    frontmatter, body = _split_frontmatter(raw_markdown)
    image_urls = _extract_image_urls(raw_markdown)
    cover_image = str(frontmatter.get("cover_image") or "").strip()
    if cover_image and cover_image not in image_urls:
        image_urls.insert(0, cover_image)

    original_url = str(frontmatter.get("source") or requested_url).strip()
    canonical_url = canonicalize_url(original_url)
    source = _source_from_host(_host_from_url(canonical_url))
    text = markdown_to_text_without_images(body)
    title = str(frontmatter.get("title") or _fallback_title(text) or markdown_path.stem).strip()
    author = _first_author(frontmatter)
    published = str(frontmatter.get("published") or "").strip()
    validate_extracted_content(source=source, title=title, text=text)

    metadata = {
        "extractor": "feedgrab",
        "raw_markdown_path": str(markdown_path),
    }

    return ExtractedContent(
        original_url=original_url,
        canonical_url=canonical_url,
        source=source,
        title=title,
        text=text,
        raw_markdown=raw_markdown,
        raw_markdown_path=str(markdown_path),
        author=author,
        published_at=published,
        image_urls=image_urls[:50],
        metadata=metadata,
    )


def markdown_to_text_without_images(markdown: str) -> str:
    text = HTML_IMAGE_RE.sub("", markdown)
    text = MARKDOWN_IMAGE_RE.sub("", text)
    text = MARKDOWN_LINK_RE.sub(r"\1", text)
    text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"^[ \t]*#{1,6}[ \t]*", "", text, flags=re.M)
    text = re.sub(r"^[ \t]*[-*+][ \t]+", "", text, flags=re.M)
    text = re.sub(r"^[ \t]*>[ \t]?", "", text, flags=re.M)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


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


def _feedgrab_data_dir() -> Path:
    configured = os.getenv("FEEDGRAB_DATA_DIR", "").strip()
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else Path.cwd() / path

    app_data_dir = os.getenv("BIECHIHUI_APP_DATA_DIR", "").strip()
    if app_data_dir:
        return Path(app_data_dir) / "sessions"

    return Path.cwd() / "sessions"


def _latest_markdown_file(root: Path) -> Optional[Path]:
    files = [path for path in root.rglob("*.md") if path.is_file()]
    if not files:
        return None
    return max(files, key=lambda path: path.stat().st_mtime)


def _split_frontmatter(markdown: str) -> tuple[dict[str, Any], str]:
    match = FRONTMATTER_RE.match(markdown)
    if not match:
        return {}, markdown
    return _parse_simple_yaml(match.group(1)), markdown[match.end():]


def _parse_simple_yaml(raw: str) -> dict[str, Any]:
    data: dict[str, Any] = {}
    current_key = ""
    for line in raw.splitlines():
        if not line.strip():
            continue
        if line.startswith("  - ") and current_key:
            data.setdefault(current_key, []).append(_clean_yaml_value(line[4:]))
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        current_key = key.strip()
        cleaned = value.strip()
        data[current_key] = [] if cleaned == "" else _clean_yaml_value(cleaned)
    return data


def _clean_yaml_value(value: str) -> str:
    return value.strip().strip('"').strip("'")


def _extract_image_urls(markdown: str) -> list[str]:
    urls: list[str] = []
    for _alt, url in MARKDOWN_IMAGE_RE.findall(markdown):
        cleaned = url.strip()
        if cleaned.startswith("http") and cleaned not in urls:
            urls.append(cleaned)
    return urls


def _first_author(frontmatter: dict[str, Any]) -> str:
    author = frontmatter.get("author_name") or frontmatter.get("author")
    if isinstance(author, list):
        return str(author[0]).strip() if author else ""
    return str(author or "").strip()


def _fallback_title(text: str) -> str:
    for line in text.splitlines():
        cleaned = line.strip()
        if cleaned:
            return cleaned[:80]
    return ""


def _host_from_url(url: str) -> str:
    from urllib.parse import urlparse

    return urlparse(url).netloc
