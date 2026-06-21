from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterator, List

import requests

from .config import Settings


class ModelAPIError(RuntimeError):
    pass


class ModelClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def rewrite_query(self, query: str) -> str:
        prompt = (
            "你是一个面向 AI 产品知识库的检索改写助手，负责把用户问题改写成更适合知识库检索的查询。\n\n"
            "## 目标\n"
            "在不改变原始意图的前提下，提高召回质量，尤其适用于 AI 产品、模型、RAG、Agent、Prompt、评测、工作流和上线策略等主题。\n\n"
            "## 规则\n"
            "1. 保持原始意图，不得改变问题含义。\n"
            "2. 去掉寒暄、口语、情绪化表达和无关背景。\n"
            "3. 补全适合检索的关键信息：对象、任务、场景、约束、指标、比较维度。\n"
            "4. 如果当前问题存在明显指代不清，则尽量改写为自包含查询；若缺少必要上下文，不要虚构补全。\n"
            "5. 保留关键术语：模型、RAG、Agent、prompt、eval、tool calling、工作流、召回、重排、延迟、成本、幻觉、转化。\n"
            "6. 如果是决策问题，保留“如何选择 / 适合什么场景 / 风险 / trade-off”等意图。\n"
            "7. 如果是执行问题，保留“实现方式 / 关键步骤 / 常见问题”等意图。\n"
            "8. 不要回答问题，只输出检索查询。\n"
            "9. 输出 3 条互补查询：\n"
            "   - 一条贴近原问题\n"
            "   - 一条补充专业术语\n"
            "   - 一条偏落地或方案比较\n"
            "10. 每条查询控制在 10 到 30 个字，避免过长。\n\n"
            "## 输出格式限制\n"
            "1. 必须输出合法 JSON\n"
            "2. 不要输出 Markdown\n"
            "3. 不要输出解释文本\n"
            "4. 字段固定为：\n"
            '{\n  "rewritten_query": "...",\n  "queries": [\n    "...",\n    "...",\n    "..."\n  ]\n}\n\n'
            f"用户问题：{query}"
        )
        obj = self._chat_json(prompt)
        rewritten = ""
        if isinstance(obj, dict):
            rewritten = str(obj.get("rewritten_query") or "").strip()
            queries = obj.get("queries")
            if not rewritten and isinstance(queries, list):
                rewritten = str(queries[0] or "").strip() if queries else ""
        if not rewritten:
            raise ModelAPIError("chat API returned no rewritten_query")
        return str(rewritten).strip()

    def summarize_card(self, *, title: str, source: str, text: str, image_urls: List[str]) -> Dict[str, Any]:
        prompt = (
            "你是个人知识库的数据转换助手。请基于输入生成一张便于模糊记忆检索的知识卡片，"
            "只输出严格 JSON，不要输出其他文本。\n"
            f"来源平台：{source}\n标题：{title}\n正文：{text[:6000]}\n"
            '输出格式：{"title":"原始或修正标题","summary":"约300字摘要","tags":["3到5个标签"]}'
        )
        obj = self._chat_json(prompt)
        if not isinstance(obj, dict):
            raise ModelAPIError("chat API returned invalid card JSON")
        tags = obj.get("tags")
        summary = str(obj.get("summary") or "")[:1000]
        if not summary:
            raise ModelAPIError("chat API returned no summary")
        return {
            "title": str(obj.get("title") or title or "未命名内容"),
            "summary": summary,
            "tags": [str(t) for t in tags if str(t).strip()][:5] if isinstance(tags, list) else [],
        }

    def generate_daily_report(self, *, date: str, cards: List[Dict[str, Any]]) -> Dict[str, Any]:
        compact_cards = []
        for card in cards[:12]:
            compact_cards.append(
                {
                    "id": card.get("id", ""),
                    "title": card.get("title", ""),
                    "source": card.get("source", ""),
                    "summary": card.get("summary", ""),
                    "tags": card.get("tags", []),
                    "content": str(card.get("content", ""))[:1200],
                }
            )
        prompt = (
            "你是个人知识库的日报归纳助手。请基于当天归档的知识卡片生成一份中文日报摘要，"
            "只输出严格 JSON，不要输出 Markdown 或解释。\n\n"
            f"日期：{date}\n"
            f"当天卡片：{json.dumps(compact_cards, ensure_ascii=False)}\n\n"
            "输出字段固定为：\n"
            '{\n'
            '  "summary": "80到180字，概括当天知识收集重点、关系和可行动洞察",\n'
            '  "topics": ["2到4条主题观察，每条不超过40字"],\n'
            '  "keywords": ["3到6个关键词"],\n'
            '  "highlightCardIds": ["1到3个最值得回看的卡片id，必须来自输入卡片"]\n'
            "}\n"
            "如果信息有限，也要基于已有卡片如实概括，不要编造没有出现的来源、数字或结论。"
        )
        obj = self._chat_json(prompt)
        if not isinstance(obj, dict):
            raise ModelAPIError("chat API returned invalid daily report JSON")
        summary = str(obj.get("summary") or "").strip()
        if not summary:
            raise ModelAPIError("chat API returned no daily report summary")
        valid_ids = {str(card.get("id")) for card in compact_cards}
        topics = obj.get("topics")
        keywords = obj.get("keywords")
        highlights = obj.get("highlightCardIds")
        return {
            "summary": summary[:600],
            "topics": [str(item).strip() for item in topics if str(item).strip()][:4] if isinstance(topics, list) else [],
            "keywords": [str(item).strip() for item in keywords if str(item).strip()][:6] if isinstance(keywords, list) else [],
            "highlightCardIds": [str(item) for item in highlights if str(item) in valid_ids][:3] if isinstance(highlights, list) else [],
        }

    def _build_answer_prompt(self, *, query: str, card: Dict[str, Any]) -> str:
        context = (
            f"标题：{card.get('title', '')}\n"
            f"来源：{card.get('source', '')}\n"
            f"摘要：{card.get('summary', '')}\n"
            f"原文：\n{str(card.get('raw_text', ''))}"
        )
        return (
            "你是一个服务于 AI 产品经理的知识库问答助手，对用户提出的问题进行回答。\n\n"
            "你的回答必须严格依据提供的参考资料，不得使用参考资料之外的事实。\n\n"
            "## 基本规则\n"
            "1. 只能依据参考资料回答。\n"
            "2. 如果资料不足，明确说：“根据当前知识库内容，无法确定这个问题的答案。”\n"
            "3. 不得编造事实、案例、数据、时间、来源、用户反馈、最佳实践或结论。\n"
            "4. 如果答案中包含推断，必须明确标注“基于资料推断”。\n"
            "5. 如果参考资料内部存在冲突或表达不一致，必须指出冲突点，不得擅自合并。\n"
            "6. 回答风格要专业、直接、产品化，适合 AI 产品经理阅读。\n"
            "7. 优先回答结论和可执行建议，避免空泛解释。\n"
            "8. 不要输出与问题无关的背景知识。\n"
            "9. 不要重复用户问题。\n"
            "10. 不要输出“作为一个AI模型”之类的措辞。\n"
            "11. 如果资料不足以支持明确推荐，应直接说明无法确定，不强行给结论。\n\n"
            "## 输出限制\n"
            "1. 回答总长度控制在 200 到 500 字之间。\n"
            "2. 优先使用短段落或短列表，每一条不超过 2 句。\n"
            "3. 默认最多输出 3 个小节：结论、依据、注意事项。\n"
            "4. 如果用户明确要求“详细展开”，可以放宽长度限制到 800 字。\n"
            "5. 如果资料不足，回答应控制在 80 到 180 字之间。\n"
            "6. 不要输出超过 5 条的长列表。\n"
            "7. 不要写成长篇教程，除非用户明确要求“详细步骤”。\n"
            "8. 对“是否应该”“怎么选”“推荐哪个”这类决策问题，必须给出明确倾向；如果证据不足，就明确说无法确定。\n"
            "9. 对“怎么做”类问题，必须给出步骤或执行建议，不能只解释概念。\n"
            "10. 若引用证据不足以支持强结论，应降低语气强度，使用“更适合”“倾向于”“资料显示”等表述。\n\n"
            "## 固定输出格式\n"
            "请严格按以下 Markdown 格式输出：\n\n"
            "结论：\n"
            "<先给简明结论。若无法回答，直接说明资料不足。>\n\n"
            "依据：\n"
            "- <依据1>\n"
            "- <依据2>\n\n"
            "注意事项：\n"
            "- <风险、边界条件、适用范围；如果没有可写“无”>\n\n"
            "现在开始回答。\n\n"
            f"用户问题：{query}\n\n参考资料：\n{context}"
        )

    def answer(self, *, query: str, card: Dict[str, Any]) -> str:
        prompt = self._build_answer_prompt(query=query, card=card)
        answer = self._chat_text(prompt)
        if not answer.strip():
            raise ModelAPIError("chat API returned empty answer")
        return answer

    def answer_stream(self, *, query: str, card: Dict[str, Any]) -> Iterator[str]:
        prompt = self._build_answer_prompt(query=query, card=card)
        yielded = False
        for token in self._chat_text_stream(prompt):
            yielded = True
            yield token
        if not yielded:
            raise ModelAPIError("chat API returned empty answer")

    def embed(self, text: str) -> List[float]:
        if not self.settings.embedding_api_key:
            raise ModelAPIError("EMBEDDING_API_KEY or SILICONFLOW_API_KEY is required for embeddings")
        url = f"{self.settings.embedding_base_url}/embeddings"
        payload = {"model": self.settings.embedding_model, "input": text}
        response = requests.post(url, headers=self._headers(self.settings.embedding_api_key), json=payload, timeout=30)
        self._raise_for_status(response, "embedding API")
        obj = response.json()
        emb = obj.get("data", [{}])[0].get("embedding")
        if not isinstance(emb, list) or not emb:
            raise ModelAPIError("embedding API returned no embedding")
        return [float(v) for v in emb]

    def rerank(self, query: str, cards: List[Dict[str, Any]], final_k: int) -> List[Dict[str, Any]]:
        if not self.settings.rerank_api_url or not self.settings.rerank_model:
            return cards[:final_k]
        if not self.settings.rerank_api_key:
            raise ModelAPIError("RERANK_API_KEY or SILICONFLOW_API_KEY is required for rerank")
        docs = [f"{c.get('title', '')}\n{c.get('summary', '')}\n{' '.join(c.get('tags', []))}" for c in cards]
        payload = {"model": self.settings.rerank_model, "query": query, "documents": docs, "top_n": final_k}
        response = requests.post(self.settings.rerank_api_url, headers=self._headers(self.settings.rerank_api_key), json=payload, timeout=30)
        self._raise_for_status(response, "rerank API")
        results = response.json().get("results", [])
        ordered: List[Dict[str, Any]] = []
        for result in results:
            idx = result.get("index")
            if isinstance(idx, int) and 0 <= idx < len(cards):
                card = dict(cards[idx])
                card["score"] = float(result.get("relevance_score", card.get("score", 0.0)))
                ordered.append(card)
        if not ordered:
            raise ModelAPIError("rerank API returned no usable results")
        return ordered[:final_k]

    def _headers(self, api_key: str) -> Dict[str, str]:
        return {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    def _raise_for_status(self, response: requests.Response, label: str) -> None:
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            body = response.text[:500].strip()
            raise ModelAPIError(f"{label} failed: HTTP {response.status_code} {body}") from exc

    def _chat_json(self, prompt: str) -> Dict[str, Any]:
        text = self._chat_text(prompt)
        match = re.search(r"\{.*\}", text, re.S)
        return json.loads(match.group(0)) if match else {}

    def _chat_text(self, prompt: str) -> str:
        if not self.settings.chat_api_key:
            raise ModelAPIError("CHAT_API_KEY, DEEPSEEK_API_KEY, or SILICONFLOW_API_KEY is required for chat")
        url = f"{self.settings.chat_base_url}/chat/completions"
        payload = {
            "model": self.settings.chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
        try:
            response = requests.post(url, headers=self._headers(self.settings.chat_api_key), json=payload, timeout=60)
        except requests.RequestException as exc:
            raise ModelAPIError(f"chat API request failed: {exc}") from exc
        self._raise_for_status(response, "chat API")
        obj = response.json()
        return str(obj.get("choices", [{}])[0].get("message", {}).get("content", ""))

    def _chat_text_stream(self, prompt: str) -> Iterator[str]:
        if not self.settings.chat_api_key:
            raise ModelAPIError("CHAT_API_KEY, DEEPSEEK_API_KEY, or SILICONFLOW_API_KEY is required for chat")
        url = f"{self.settings.chat_base_url}/chat/completions"
        payload = {
            "model": self.settings.chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "stream": True,
        }
        try:
            with requests.post(url, headers=self._headers(self.settings.chat_api_key), json=payload, timeout=90, stream=True) as response:
                self._raise_for_status(response, "chat API")
                for raw_line in response.iter_lines(decode_unicode=True):
                    if not raw_line:
                        continue
                    line = raw_line.strip()
                    if line.startswith("data:"):
                        line = line[5:].strip()
                    if line == "[DONE]":
                        break
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    delta = obj.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield str(content)
        except requests.RequestException as exc:
            raise ModelAPIError(f"chat API stream failed: {exc}") from exc
