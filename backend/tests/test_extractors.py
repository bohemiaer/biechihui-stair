from backend.reference.local_rag.extractors import (
    _extract_generic,
    _has_x_longform_signal,
    _html_to_text,
    _pick_richer_x_longform_snapshot,
    _select_x_text_content,
)


def test_html_to_text_preserves_headings_paragraphs_and_lists():
    raw = """
    <article>
      <h1>主标题</h1>
      <p>第一段第一句。</p>
      <p>第一段第二句。</p>
      <h2>小节标题</h2>
      <ul>
        <li>要点一</li>
        <li>要点二</li>
      </ul>
    </article>
    """

    assert _html_to_text(raw) == "\n".join(
        [
            "主标题",
            "",
            "第一段第一句。",
            "",
            "第一段第二句。",
            "",
            "小节标题",
            "",
            "- 要点一",
            "- 要点二",
        ]
    )


def test_extract_generic_keeps_readable_structure_in_text():
    html = """
    <html>
      <head>
        <title>示例文章</title>
      </head>
      <body>
        <article>
          <h1>示例文章</h1>
          <p>这是第一段。</p>
          <p>这是第二段。</p>
        </article>
      </body>
    </html>
    """

    extracted = _extract_generic(
        "https://example.com/article",
        "https://example.com/article",
        "example.com",
        html,
    )

    assert extracted.title == "示例文章"
    assert extracted.text == "示例文章\n\n这是第一段。\n\n这是第二段。"


def test_select_x_text_content_prefers_longform_when_present():
    title, text, mode = _select_x_text_content(
        tweet_blocks=["这是长文在卡片里的摘要部分。"],
        longform_title="完整长文标题",
        longform_blocks=["第一段完整正文。", "第二段完整正文。"],
    )

    assert mode == "longform"
    assert title == "完整长文标题"
    assert text == "完整长文标题\n\n第一段完整正文。\n\n第二段完整正文。"


def test_select_x_text_content_falls_back_to_tweet_text_when_no_longform():
    title, text, mode = _select_x_text_content(
        tweet_blocks=["第一条推文", "第二条推文"],
        longform_title="",
        longform_blocks=[],
    )

    assert mode == "tweet"
    assert title == "第一条推文"
    assert text == "第一条推文\n第二条推文"


def test_has_x_longform_signal_detects_title_or_blocks():
    assert _has_x_longform_signal("长文标题", []) is True
    assert _has_x_longform_signal("", ["第一段"]) is True
    assert _has_x_longform_signal("", []) is False


def test_pick_richer_x_longform_snapshot_prefers_more_complete_retry_result():
    title, blocks = _pick_richer_x_longform_snapshot(
        initial_title="长文标题",
        initial_blocks=["第一段"],
        retried_title="长文标题",
        retried_blocks=["第一段", "第二段", "第三段"],
    )

    assert title == "长文标题"
    assert blocks == ["第一段", "第二段", "第三段"]
