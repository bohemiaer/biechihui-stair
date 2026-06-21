from __future__ import annotations

import html
import json
import os
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse, urlunparse

import requests


DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

WECHAT_MOBILE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 "
    "Safari/604.1 MicroMessenger/8.0.47"
)


@dataclass
class ExtractedContent:
    original_url: str
    canonical_url: str
    source: str
    title: str
    text: str
    raw_markdown: str = ""
    raw_markdown_path: str = ""
    author: str = ""
    published_at: str = ""
    image_urls: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


def canonicalize_url(url: str) -> str:
    parsed = urlparse(str(url).strip())
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc.lower()
    path = re.sub(r"/+$", "", parsed.path or "/")
    return urlunparse((scheme, netloc, path, "", parsed.query, ""))


def extract_url(url: str, timeout: int = 20) -> ExtractedContent:
    from .config import _load_dotenv

    _load_dotenv()
    original = str(url)
    canonical = canonicalize_url(original)
    parsed = urlparse(canonical)
    source = _source_from_host(parsed.netloc)
    if source in {"x.com", "twitter.com"} and _has_x_cookie_config():
        return _extract_x_with_browser(original, canonical, source, timeout=timeout)
    headers = {"User-Agent": DEFAULT_UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6"}
    response = requests.get(original, headers=headers, timeout=timeout)
    response.raise_for_status()
    response.encoding = response.encoding or "utf-8"
    html_text = response.text
    _raise_if_blocked_placeholder(source, html_text)
    if source == "微信公众号":
        return _extract_wechat(original, canonical, html_text)
    if source == "小红书":
        return _extract_xhs(original, canonical, html_text)
    return _extract_generic(original, canonical, source, html_text)


def _source_from_host(host: str) -> str:
    host = host.lower()
    if "mp.weixin.qq.com" in host:
        return "微信公众号"
    if "zhihu.com" in host:
        return "知乎"
    if "xiaohongshu.com" in host or "xhslink.com" in host:
        return "小红书"
    if host == "x.com" or host.endswith(".x.com"):
        return "x.com"
    if host == "twitter.com" or host.endswith(".twitter.com"):
        return "twitter.com"
    return host or "外部链接"


def _has_x_cookie_config() -> bool:
    return bool(os.getenv("X_AUTH_TOKEN", "").strip() and os.getenv("X_CT0", "").strip())


def _raise_if_blocked_placeholder(source: str, html_text: str) -> None:
    lowered = html_text.lower()
    if source not in {"x.com", "twitter.com"}:
        return
    blocked_markers = [
        "javascript is disabled in this browser",
        "please enable javascript or switch to a supported browser to continue using x.com",
        "privacy related extensions may cause issues on x.com",
    ]
    if all(marker in lowered for marker in blocked_markers):
        raise ValueError("x.com content is not accessible without JavaScript; skipping placeholder page")


def _extract_x_with_browser(
    original: str,
    canonical: str,
    source: str,
    *,
    timeout: int = 20,
) -> ExtractedContent:
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is required for x.com extraction. Install it with `playwright install chromium`.") from exc

    auth_token = os.getenv("X_AUTH_TOKEN", "").strip()
    ct0 = os.getenv("X_CT0", "").strip()
    twid = os.getenv("X_TWID", "").strip()
    if not auth_token or not ct0:
        raise ValueError("X_AUTH_TOKEN and X_CT0 are required for x.com extraction")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=DEFAULT_UA,
            locale="zh-CN",
            viewport={"width": 1440, "height": 1200},
        )
        cookies = [
            {"name": "auth_token", "value": auth_token, "domain": ".x.com", "path": "/", "httpOnly": True, "secure": True},
            {"name": "ct0", "value": ct0, "domain": ".x.com", "path": "/", "httpOnly": False, "secure": True},
        ]
        if twid:
            cookies.append({"name": "twid", "value": twid, "domain": ".x.com", "path": "/", "httpOnly": False, "secure": True})
        context.add_cookies(cookies)
        page = context.new_page()
        try:
            page.goto(original, wait_until="domcontentloaded", timeout=timeout * 1000)
            page.wait_for_timeout(3000)
            page.wait_for_selector("article", timeout=timeout * 1000)
        except PlaywrightTimeoutError as exc:
            browser.close()
            raise ValueError(f"x.com page did not finish loading in time: {original}") from exc

        article = page.locator("article").first
        tweet_text = article.locator("[data-testid='tweetText']")
        tweet_blocks = tweet_text.all_inner_texts()
        longform_title, longform_blocks = _read_x_longform_snapshot(article)
        if _has_x_longform_signal(longform_title, longform_blocks):
            retried_title, retried_blocks = _retry_read_x_longform_snapshot(article, timeout_ms=timeout * 1000)
            longform_title, longform_blocks = _pick_richer_x_longform_snapshot(
                initial_title=longform_title,
                initial_blocks=longform_blocks,
                retried_title=retried_title,
                retried_blocks=retried_blocks,
            )
        title, text, x_mode = _select_x_text_content(
            tweet_blocks=tweet_blocks,
            longform_title=longform_title,
            longform_blocks=longform_blocks,
        )
        author = ""
        user_name = article.locator("[data-testid='User-Name']").first
        if user_name.count():
            author = user_name.inner_text(timeout=5000).split("\n")[0].strip()
        image_urls: List[str] = []
        for src in article.locator("img").evaluate_all("(nodes) => nodes.map((node) => node.getAttribute('src') || '')"):
            if isinstance(src, str) and src.startswith("http") and "profile_images" not in src and src not in image_urls:
                image_urls.append(src)
        browser.close()

    if not text.strip():
        raise ValueError(f"x.com page loaded but no tweet text was extracted: {original}")
    return ExtractedContent(
        original_url=original,
        canonical_url=canonical,
        source=source,
        title=title.strip() or "X 帖子",
        text=text.strip(),
        author=author,
        image_urls=image_urls[:20],
        metadata={"extractor": "x_browser", "x_mode": x_mode},
    )


def _compose_x_longform_text(*, title: str, body_blocks: List[str]) -> str:
    parts: List[str] = []
    cleaned_title = title.strip()
    if cleaned_title:
        parts.append(cleaned_title)
    for block in body_blocks:
        cleaned = str(block).strip()
        if cleaned and cleaned not in parts:
            parts.append(cleaned)
    return "\n\n".join(parts).strip()


def _normalize_x_text_blocks(blocks: List[str]) -> List[str]:
    normalized: List[str] = []
    for block in blocks:
        cleaned = str(block).strip()
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


def _read_x_longform_snapshot(article: Any) -> Tuple[str, List[str]]:
    longform_title_locator = article.locator("[data-testid='twitter-article-title']")
    rich_text = article.locator("[data-testid='twitterArticleRichTextView'], [data-testid='longformRichTextComponent']")
    longform_title = longform_title_locator.first.inner_text(timeout=5000) if longform_title_locator.count() else ""
    longform_blocks = rich_text.all_inner_texts() if rich_text.count() else []
    return str(longform_title).strip(), _normalize_x_text_blocks(longform_blocks)


def _has_x_longform_signal(longform_title: str, longform_blocks: List[str]) -> bool:
    return bool(str(longform_title).strip() or _normalize_x_text_blocks(longform_blocks))


def _score_x_longform_snapshot(title: str, blocks: List[str]) -> Tuple[int, int, int]:
    normalized_blocks = _normalize_x_text_blocks(blocks)
    total_chars = sum(len(block) for block in normalized_blocks)
    return (1 if str(title).strip() else 0, len(normalized_blocks), total_chars)


def _pick_richer_x_longform_snapshot(
    *,
    initial_title: str,
    initial_blocks: List[str],
    retried_title: str,
    retried_blocks: List[str],
) -> Tuple[str, List[str]]:
    initial_normalized = _normalize_x_text_blocks(initial_blocks)
    retried_normalized = _normalize_x_text_blocks(retried_blocks)
    if _score_x_longform_snapshot(retried_title, retried_normalized) > _score_x_longform_snapshot(initial_title, initial_normalized):
        return str(retried_title).strip(), retried_normalized
    return str(initial_title).strip(), initial_normalized


def _retry_read_x_longform_snapshot(article: Any, *, timeout_ms: int) -> Tuple[str, List[str]]:
    deadline_attempts = max(2, min(5, timeout_ms // 1000))
    best_title, best_blocks = _read_x_longform_snapshot(article)
    stable_reads = 0
    previous_score = _score_x_longform_snapshot(best_title, best_blocks)

    rich_text = article.locator("[data-testid='twitterArticleRichTextView'], [data-testid='longformRichTextComponent']")
    if rich_text.count():
        try:
            rich_text.first.scroll_into_view_if_needed(timeout=5000)
        except Exception:
            pass

    for _ in range(deadline_attempts):
        article.page.wait_for_timeout(800)
        current_title, current_blocks = _read_x_longform_snapshot(article)
        best_title, best_blocks = _pick_richer_x_longform_snapshot(
            initial_title=best_title,
            initial_blocks=best_blocks,
            retried_title=current_title,
            retried_blocks=current_blocks,
        )
        current_score = _score_x_longform_snapshot(current_title, current_blocks)
        if current_score == previous_score:
            stable_reads += 1
            if stable_reads >= 2:
                break
        else:
            stable_reads = 0
            previous_score = current_score

    return best_title, best_blocks


def _select_x_text_content(*, tweet_blocks: List[str], longform_title: str, longform_blocks: List[str]) -> tuple[str, str, str]:
    normalized_longform_blocks = _normalize_x_text_blocks(longform_blocks)
    cleaned_longform_title = str(longform_title).strip()
    if cleaned_longform_title or normalized_longform_blocks:
        return (
            cleaned_longform_title,
            _compose_x_longform_text(title=cleaned_longform_title, body_blocks=normalized_longform_blocks),
            "longform",
        )

    normalized_tweet_blocks = _normalize_x_text_blocks(tweet_blocks)
    tweet_title = normalized_tweet_blocks[0] if normalized_tweet_blocks else ""
    return tweet_title, "\n".join(normalized_tweet_blocks).strip(), "tweet"


def _extract_wechat(original: str, canonical: str, html_text: str) -> ExtractedContent:
    title = _first_match(html_text, [r"var msg_title\s*=\s*'([^']*)'", r"<title[^>]*>(.*?)</title>"])
    author = _first_match(html_text, [r"var nickname\s*=\s*'([^']*)'", r'id="js_name"[^>]*>(.*?)</'])
    published_at = _first_match(html_text, [r"var ct\s*=\s*\"?(\d+)\"?"])
    content = _first_match(html_text, [r'id="js_content"[^>]*>(.*?)</div>'])
    if not content:
        if _looks_like_wechat_renderable_article(html_text):
            return _extract_wechat_with_browser(original, canonical)
        raise ValueError("微信公众号正文未成功加载：未找到 js_content 正文容器")
    text = _html_to_text(content)
    validate_extracted_content(source="微信公众号", title=title, text=text)
    return ExtractedContent(
        original_url=original,
        canonical_url=canonical,
        source="微信公众号",
        title=_clean(title) or "未命名微信文章",
        author=_clean(author),
        published_at=published_at,
        text=text,
        image_urls=_extract_images(content),
        metadata={"extractor": "wechat"},
    )


def _looks_like_wechat_renderable_article(html_text: str) -> bool:
    lowered = html_text.lower()
    if "wappoc_appmsgcaptcha" in lowered:
        return False
    return "window.msg_title" in html_text or 'property="og:title"' in lowered or "property='og:title'" in lowered


def _extract_wechat_with_browser(original: str, canonical: str, *, timeout: int = 30) -> ExtractedContent:
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError("Playwright is required for rendered WeChat extraction. Install it with `playwright install chromium`.") from exc

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=WECHAT_MOBILE_UA,
            locale="zh-CN",
            viewport={"width": 430, "height": 1200},
            is_mobile=True,
        )
        page = context.new_page()
        try:
            page.goto(original, wait_until="domcontentloaded", timeout=timeout * 1000)
            page.wait_for_timeout(6000)
            page.wait_for_selector("#js_content", timeout=timeout * 1000)
        except PlaywrightTimeoutError as exc:
            browser.close()
            raise ValueError(f"微信公众号正文未成功加载：浏览器渲染超时 {original}") from exc

        content = page.locator("#js_content").first
        text = content.inner_text(timeout=5000).strip()
        title = ""
        title_node = page.locator("#js_text_title, .rich_media_title").first
        if title_node.count():
            title = title_node.inner_text(timeout=5000).strip()
        author = ""
        author_node = page.locator("#js_name, .profile_nickname, .account_nickname").first
        if author_node.count():
            author = author_node.inner_text(timeout=5000).strip()
        published_at = ""
        time_node = page.locator("#publish_time, .rich_media_meta_text").first
        if time_node.count():
            published_at = time_node.inner_text(timeout=5000).strip()
        image_urls: List[str] = []
        for src in content.locator("img").evaluate_all("(nodes) => nodes.map((node) => node.currentSrc || node.getAttribute('data-src') || node.getAttribute('src') || '')"):
            if isinstance(src, str):
                if src.startswith("//"):
                    src = "https:" + src
                if src.startswith("http") and src not in image_urls:
                    image_urls.append(src)
        browser.close()

    validate_extracted_content(source="微信公众号", title=title, text=text)
    return ExtractedContent(
        original_url=original,
        canonical_url=canonical,
        source="微信公众号",
        title=_clean(title) or "未命名微信文章",
        author=_clean(author),
        published_at=published_at,
        text=text,
        image_urls=image_urls[:20],
        metadata={"extractor": "wechat_browser"},
    )


def validate_extracted_content(*, source: str, title: str, text: str) -> None:
    cleaned = text.strip()
    lowered = cleaned.lower()
    if source == "微信公众号":
        badjs_markers = ["badjs", "wx_bj_report", "badjswindowerror", "window.logs"]
        if any(marker in lowered for marker in badjs_markers):
            raise ValueError("微信公众号正文未成功加载：抓取结果是错误监控脚本而不是文章正文")
        if len(cleaned) < 30:
            raise ValueError("微信公众号正文未成功加载：有效正文过短")


def _extract_xhs(original: str, canonical: str, html_text: str) -> ExtractedContent:
    state = _extract_json_state(html_text)
    note = _find_xhs_note(state)
    if note:
        title = str(note.get("title") or note.get("displayTitle") or "")
        text = str(note.get("desc") or note.get("text") or "")
        user = note.get("user") if isinstance(note.get("user"), dict) else {}
        images = []
        for item in note.get("imageList") or note.get("images") or []:
            if isinstance(item, dict):
                candidate = item.get("urlDefault") or item.get("url") or item.get("traceId")
                if isinstance(candidate, str) and candidate.startswith("http"):
                    images.append(candidate)
        return ExtractedContent(
            original_url=original,
            canonical_url=canonical,
            source="小红书",
            title=title or "未命名小红书内容",
            author=str(user.get("nickname") or ""),
            text=text,
            image_urls=images,
            metadata={"extractor": "xhs_state"},
        )
    generic = _extract_generic(original, canonical, "小红书", html_text)
    generic.metadata["extractor"] = "xhs_generic"
    return generic


def _extract_generic(original: str, canonical: str, source: str, html_text: str) -> ExtractedContent:
    title = _first_match(
        html_text,
        [
            r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)',
            r"<title[^>]*>(.*?)</title>",
        ],
    )
    main = _first_match(html_text, [r"<article[^>]*>(.*?)</article>", r"<main[^>]*>(.*?)</main>"]) or html_text
    main = re.sub(r"<script.*?</script>", " ", main, flags=re.S | re.I)
    main = re.sub(r"<style.*?</style>", " ", main, flags=re.S | re.I)
    return ExtractedContent(
        original_url=original,
        canonical_url=canonical,
        source=source,
        title=_clean(title) or "未命名网页",
        text=_html_to_text(main),
        image_urls=_extract_images(main),
        metadata={"extractor": "generic"},
    )


def _first_match(text: str, patterns: List[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.S | re.I)
        if match:
            return match.group(1)
    return ""


def _clean(text: str) -> str:
    return _html_to_text(text).strip()


def _html_to_text(raw: str) -> str:
    raw = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
    raw = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    raw = re.sub(r"<li\b[^>]*>", "\n- ", raw, flags=re.I)
    raw = re.sub(r"</li\s*>", "\n", raw, flags=re.I)
    raw = re.sub(
        r"</?(?:article|aside|blockquote|div|figcaption|figure|footer|h[1-6]|header|main|nav|ol|p|pre|section|table|tbody|td|th|thead|tr|ul)\b[^>]*>",
        "\n\n",
        raw,
        flags=re.I,
    )
    raw = re.sub(r"<[^>]+>", "", raw)
    raw = html.unescape(raw)
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")

    normalized_lines: List[str] = []
    last_blank = False
    for line in raw.split("\n"):
        cleaned = re.sub(r"[^\S\n]+", " ", line).strip()
        if not cleaned:
            if not last_blank and normalized_lines:
                normalized_lines.append("")
            last_blank = True
            continue
        normalized_lines.append(cleaned)
        last_blank = False

    text = "\n".join(normalized_lines).strip()
    return re.sub(r"(?m)(^- .+)\n\n(?=- )", r"\1\n", text)


def _extract_images(raw: str) -> List[str]:
    urls = re.findall(r'<img[^>]+(?:data-src|src)=["\']([^"\']+)["\']', raw, flags=re.I)
    cleaned: List[str] = []
    for url in urls:
        if url.startswith("//"):
            url = "https:" + url
        if url.startswith("http") and url not in cleaned:
            cleaned.append(url)
    return cleaned[:20]


def _extract_json_state(html_text: str) -> Dict[str, Any]:
    match = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*</script>", html_text, re.S)
    if not match:
        return {}
    raw = match.group(1).replace("undefined", "null")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {}


def _find_xhs_note(state: Dict[str, Any]) -> Dict[str, Any]:
    note = state.get("noteData", {}).get("data", {}).get("noteData") if isinstance(state, dict) else None
    if isinstance(note, dict):
        return note
    detail_map = state.get("note", {}).get("noteDetailMap", {}) if isinstance(state, dict) else {}
    if isinstance(detail_map, dict):
        for value in detail_map.values():
            if isinstance(value, dict) and isinstance(value.get("note"), dict):
                return value["note"]
    return {}
