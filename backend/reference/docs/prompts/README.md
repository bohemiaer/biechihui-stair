# Prompt Library

这个目录汇总项目代码中实际使用的 LLM 节点 prompt。

当前范围：

- 只收录项目代码中的 LLM 节点
- 不包含 `dify/` 目录里的工作流 YAML
- 每个 LLM 节点单独一个 `.md` 文件

## 节点清单

| 节点 | 代码位置 | Prompt 文档 |
| --- | --- | --- |
| 检索改写 `rewrite_query` | `local_rag/llm.py` | [rewrite_query.md](./rewrite_query.md) |
| 知识卡片总结 `summarize_card` | `local_rag/llm.py` | [summarize_card.md](./summarize_card.md) |
| 选卡问答 `answer` | `local_rag/llm.py` | [answer.md](./answer.md) |
| 生成评测 Judge `generation_judge` | `scripts/eval_runner_lib.py` | [generation_judge.md](./generation_judge.md) |

## 维护规则

1. 新增 LLM 节点时，在这里补一条索引。
2. 每次修改代码里的 prompt，同步更新对应 `.md` 文件。
3. 文档中的 prompt 以当前代码实现为准，保留变量占位说明，方便后续抽模板。
