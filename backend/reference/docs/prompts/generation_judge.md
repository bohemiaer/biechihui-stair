# generation_judge

## 节点信息

- 节点名：`generation_judge`
- 代码位置：`scripts/eval_runner_lib.py`
- 调用入口：`GenerationJudgeClient.judge_generation(payload: Dict[str, Any]) -> Dict[str, Any]`
- 作用：对生成层评测结果做自动打分和 badcase 判断

## 输入变量

- `{payload}`：完整评测输入 JSON，包含：
  - `sample_id`
  - `user_query`
  - `target_title`
  - `target_summary`
  - `expected_answer_points`
  - `forbidden_points`
  - `answer`
  - `citations`
  - `evidence_snippets`

## 当前 Prompt

```text
你是一个生成层评测 judge，负责严格评审知识库问答系统的回答质量。
你必须只依据给定输入评分，且只输出合法 JSON，不要输出 Markdown 或解释。
输出字段必须包含 correctness_score、completeness_score、groundedness_score、citation_valid_score、hallucination_score、judge_summary、hit_expected_points、missed_expected_points、hit_forbidden_points、badcase_reasons、fix_suggestion、needs_human_review、human_review_reason。

输入：
{json.dumps(payload, ensure_ascii=False, indent=2)}
```

## 返回要求

- 必须返回可解析的 JSON 对象
- 代码会从响应文本里用正则提取首个 JSON 块
- 后续流程会读取以下关键字段：
  - `correctness_score`
  - `completeness_score`
  - `groundedness_score`
  - `citation_valid_score`
  - `hallucination_score`
  - `judge_summary`
  - `badcase_reasons`
  - `fix_suggestion`
  - `needs_human_review`
  - `human_review_reason`

## Badcase 判定规则

- 只要以下任一分数字段 `<= 2`，就会被标记为 badcase：
  - `correctness_score`
  - `completeness_score`
  - `groundedness_score`
  - `citation_valid_score`
  - `hallucination_score`
