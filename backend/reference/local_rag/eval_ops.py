from __future__ import annotations

import csv
import json
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


RUN_LAYERS = {"retrieval", "generation", "e2e"}
GENERATION_MODES = {"high_frequency", "edge", "multi_card", "mixed"}


def _utc_now() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _guess_dataset_layer(path: Path) -> str:
    name = path.name.lower()
    if "retrieval" in name:
        return "retrieval"
    if "generation" in name:
        return "generation"
    if "e2e" in name or "end_to_end" in name:
        return "e2e"
    return "unknown"


def _safe_relative(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


@dataclass
class EvalTask:
    task_id: str
    kind: str
    status: str = "queued"
    layer: str = ""
    run_id: str = ""
    command: list[str] = field(default_factory=list)
    created_at: str = field(default_factory=_utc_now)
    started_at: str = ""
    finished_at: str = ""
    output_dir: str = ""
    log_path: str = ""
    pid: int | None = None
    error: str = ""


class EvalOpsService:
    def __init__(self, *, project_root: Path | None = None):
        self.project_root = (project_root or Path(__file__).resolve().parents[1]).resolve()
        self.evaluation_dir = self.project_root / "docs" / "evaluation"
        self.runs_dir = self.evaluation_dir / "runs"
        self.badcases_path = self.evaluation_dir / "badcases.json"
        self.judge_reviews_path = self.evaluation_dir / "judge_reviews.json"
        self.judge_badcases_path = self.evaluation_dir / "judge_badcases.json"
        self._tasks: dict[str, EvalTask] = {}
        self._lock = threading.Lock()
        self.runner_scripts = {
            "retrieval": self.project_root / "scripts" / "run_retrieval_eval.py",
            "generation": self.project_root / "scripts" / "run_generation_eval.py",
            "e2e": self.project_root / "scripts" / "run_e2e_eval.py",
        }
        self.judge_script = self.project_root / "scripts" / "run_generation_judge.py"
        self.dataset_generator_script = self.project_root / "scripts" / "build_e2e_eval_from_cards.py"

    def list_datasets(self) -> list[dict[str, Any]]:
        datasets: list[dict[str, Any]] = []
        paths = [
            path
            for path in self.evaluation_dir.glob("golden_*.json")
            if _guess_dataset_layer(path) in RUN_LAYERS
        ]
        for layer in sorted(RUN_LAYERS):
            layer_dataset_dir = self.runs_dir / layer
            if layer_dataset_dir.exists():
                paths.extend(layer_dataset_dir.glob("golden_*.json"))
        for path in sorted(paths):
            if path.name.endswith(".summary.json"):
                continue
            payload = _read_json(path, [])
            sample_count = len(payload) if isinstance(payload, list) else 0
            is_generated = self.runs_dir in path.parents
            datasets.append(
                {
                    "name": path.name,
                    "path": _safe_relative(path, self.project_root),
                    "layer": _guess_dataset_layer(path),
                    "sample_count": sample_count,
                    "generated": is_generated,
                    "updated_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
                }
            )
        return datasets

    def list_runs(self) -> list[dict[str, Any]]:
        runs: list[dict[str, Any]] = []
        if not self.runs_dir.exists():
            return runs
        for layer_dir in sorted(self.runs_dir.iterdir()):
            if not layer_dir.is_dir():
                continue
            for run_dir in sorted(layer_dir.iterdir(), reverse=True):
                if run_dir.is_dir():
                    runs.append(self._build_run_record(layer_dir.name, run_dir))
        return runs

    def get_run(self, run_id: str) -> dict[str, Any]:
        layer, run_name = self._split_run_id(run_id)
        run_dir = self.runs_dir / layer / run_name
        if not run_dir.exists():
            raise FileNotFoundError(f"run not found: {run_id}")
        return self._build_run_record(layer, run_dir)

    def get_run_results(self, run_id: str) -> dict[str, Any]:
        layer, run_name = self._split_run_id(run_id)
        return _read_json(self.runs_dir / layer / run_name / "results.json", {"results": []})

    def get_judge_results(self, run_id: str) -> dict[str, Any]:
        layer, run_name = self._split_run_id(run_id)
        if layer != "generation":
            raise ValueError("judge results only exist for generation runs")
        return _read_json(self.runs_dir / layer / run_name / "judge_results.json", {"summary": {}, "results": []})

    def start_eval_run(self, *, layer: str, dataset_path: str, base_url: str = "http://127.0.0.1:8000") -> dict[str, Any]:
        if layer not in RUN_LAYERS:
            raise ValueError(f"unsupported eval layer: {layer}")
        output_root = self.runs_dir / layer
        command = [
            sys.executable,
            str(self.runner_scripts[layer]),
            "--samples-path",
            dataset_path,
            "--base-url",
            base_url,
            "--output-root",
            str(output_root),
        ]
        return self._start_background_task(kind="eval", layer=layer, command=command, output_root=output_root)

    def start_judge(self, *, run_id: str) -> dict[str, Any]:
        layer, run_name = self._split_run_id(run_id)
        if layer != "generation":
            raise ValueError("AI Judge can only run against generation runs")
        run_dir = self.runs_dir / layer / run_name
        if not run_dir.exists():
            raise FileNotFoundError(f"run not found: {run_id}")
        command = [sys.executable, str(self.judge_script), "--run-dir", str(run_dir)]
        return self._start_background_task(
            kind="judge",
            layer=layer,
            command=command,
            output_root=run_dir.parent,
            initial_run_id=run_id,
        )

    def start_dataset_generation(
        self,
        *,
        layer: str,
        count: int,
        mode: str = "mixed",
        seed: int = 42,
        requirements: str = "",
        dry_run: bool = False,
    ) -> dict[str, Any]:
        if layer not in RUN_LAYERS:
            raise ValueError(f"unsupported dataset layer: {layer}")
        if mode not in GENERATION_MODES:
            raise ValueError(f"unsupported generation mode: {mode}")
        if count < 1 or count > 200:
            raise ValueError("count must be between 1 and 200")
        output_root = self.runs_dir / layer
        command = [
            sys.executable,
            str(self.dataset_generator_script),
            "--task",
            layer,
            "--count",
            str(count),
            "--mode",
            mode,
            "--seed",
            str(seed),
            "--output-dir",
            str(output_root),
        ]
        requirements = requirements.strip()
        if requirements:
            command.extend(["--requirements", requirements])
        if dry_run:
            command.append("--dry-run")
        return self._start_background_task(kind="dataset-generation", layer=layer, command=command, output_root=output_root)

    def list_tasks(self) -> list[dict[str, Any]]:
        with self._lock:
            return [self._task_to_dict(task) for task in self._tasks.values()]

    def get_task(self, task_id: str) -> dict[str, Any]:
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None:
                raise KeyError(f"task not found: {task_id}")
            return self._task_to_dict(task)

    def wait_for_task(self, task_id: str, *, timeout_seconds: float) -> dict[str, Any]:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            task = self.get_task(task_id)
            if task["status"] in {"succeeded", "failed", "cancelled"}:
                return task
            time.sleep(0.05)
        return self.get_task(task_id)

    def get_task_logs(self, task_id: str) -> str:
        task = self.get_task(task_id)
        log_path = Path(task["log_path"])
        if not log_path.exists():
            return ""
        return log_path.read_text(encoding="utf-8", errors="replace")

    def update_annotation(self, *, run_id: str, sample_id: str, fields: dict[str, str]) -> dict[str, str]:
        layer, run_name = self._split_run_id(run_id)
        annotation_path = self.runs_dir / layer / run_name / "annotation.csv"
        if not annotation_path.exists():
            raise FileNotFoundError(f"annotation.csv not found for {run_id}")
        with annotation_path.open(encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
            fieldnames = list(reader.fieldnames or [])
        for key in fields:
            if key not in fieldnames:
                fieldnames.append(key)
        updated_row: dict[str, str] | None = None
        for row in rows:
            if row.get("sample_id") == sample_id:
                for key, value in fields.items():
                    row[key] = str(value)
                updated_row = row
                break
        if updated_row is None:
            raise KeyError(f"sample not found in annotation.csv: {sample_id}")
        with annotation_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        return updated_row

    def list_badcases(self) -> list[dict[str, Any]]:
        payload = _read_json(self.badcases_path, [])
        return payload if isinstance(payload, list) else []

    def create_badcase(self, payload: dict[str, Any]) -> dict[str, Any]:
        records = self.list_badcases()
        record = {
            "badcase_id": uuid4().hex,
            "sample_id": str(payload.get("sample_id", "")),
            "run_id": str(payload.get("run_id", "")),
            "layer": str(payload.get("layer", "")),
            "reason": str(payload.get("reason", "")),
            "severity": str(payload.get("severity", "medium")),
            "status": str(payload.get("status", "open")),
            "owner": str(payload.get("owner", "")),
            "related_module": str(payload.get("related_module", "")),
            "notes": str(payload.get("notes", "")),
            "fix_note": str(payload.get("fix_note", "")),
            "created_at": _utc_now(),
            "updated_at": _utc_now(),
            "last_retested_at": "",
            "retest_result": "",
        }
        records.append(record)
        _write_json(self.badcases_path, records)
        return record

    def update_badcase(self, badcase_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        records = self.list_badcases()
        for record in records:
            if record.get("badcase_id") == badcase_id:
                for key, value in fields.items():
                    if key not in {"badcase_id", "created_at"}:
                        record[key] = value
                record["updated_at"] = _utc_now()
                _write_json(self.badcases_path, records)
                return record
        raise KeyError(f"badcase not found: {badcase_id}")

    def list_judge_reviews(self) -> list[dict[str, Any]]:
        payload = _read_json(self.judge_reviews_path, [])
        return payload if isinstance(payload, list) else []

    def upsert_judge_review(self, *, run_id: str, sample_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        records = self.list_judge_reviews()
        now = _utc_now()
        for record in records:
            if record.get("run_id") == run_id and record.get("sample_id") == sample_id:
                for key, value in fields.items():
                    record[key] = value
                record["updated_at"] = now
                _write_json(self.judge_reviews_path, records)
                return record
        record = {
            "review_id": uuid4().hex,
            "run_id": run_id,
            "sample_id": sample_id,
            "judge_fairness": str(fields.get("judge_fairness", "")),
            "judge_error_type": str(fields.get("judge_error_type", "")),
            "judge_review_notes": str(fields.get("judge_review_notes", "")),
            "is_judge_badcase": str(fields.get("is_judge_badcase", "false")),
            "created_at": now,
            "updated_at": now,
        }
        for key, value in fields.items():
            record[key] = value
        records.append(record)
        _write_json(self.judge_reviews_path, records)
        return record

    def list_judge_badcases(self) -> list[dict[str, Any]]:
        payload = _read_json(self.judge_badcases_path, [])
        return payload if isinstance(payload, list) else []

    def create_judge_badcase(self, payload: dict[str, Any]) -> dict[str, Any]:
        records = self.list_judge_badcases()
        record = {
            "judge_badcase_id": uuid4().hex,
            "sample_id": str(payload.get("sample_id", "")),
            "run_id": str(payload.get("run_id", "")),
            "reason": str(payload.get("reason", "")),
            "severity": str(payload.get("severity", "medium")),
            "status": str(payload.get("status", "open")),
            "notes": str(payload.get("notes", "")),
            "fix_note": str(payload.get("fix_note", "")),
            "created_at": _utc_now(),
            "updated_at": _utc_now(),
        }
        records.append(record)
        _write_json(self.judge_badcases_path, records)
        return record

    def update_judge_badcase(self, judge_badcase_id: str, fields: dict[str, Any]) -> dict[str, Any]:
        records = self.list_judge_badcases()
        for record in records:
            if record.get("judge_badcase_id") == judge_badcase_id:
                for key, value in fields.items():
                    if key not in {"judge_badcase_id", "created_at"}:
                        record[key] = value
                record["updated_at"] = _utc_now()
                _write_json(self.judge_badcases_path, records)
                return record
        raise KeyError(f"judge badcase not found: {judge_badcase_id}")

    def _start_background_task(
        self,
        *,
        kind: str,
        layer: str,
        command: list[str],
        output_root: Path,
        initial_run_id: str = "",
    ) -> dict[str, Any]:
        task_id = uuid4().hex
        log_dir = self.evaluation_dir / "task_logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        task = EvalTask(
            task_id=task_id,
            kind=kind,
            layer=layer,
            run_id=initial_run_id,
            command=command,
            output_dir=_safe_relative(output_root, self.project_root),
            log_path=str(log_dir / f"{task_id}.log"),
        )
        with self._lock:
            self._tasks[task_id] = task
        thread = threading.Thread(target=self._run_task, args=(task,), daemon=True)
        thread.start()
        return self._task_to_dict(task)

    def _run_task(self, task: EvalTask) -> None:
        with self._lock:
            task.status = "running"
            task.started_at = _utc_now()
        output_root = self.project_root / task.output_dir
        before = {path.name for path in output_root.iterdir()} if output_root.exists() and output_root.is_dir() else set()
        try:
            with Path(task.log_path).open("w", encoding="utf-8", errors="replace") as log_handle:
                process = subprocess.Popen(
                    task.command,
                    cwd=self.project_root,
                    stdout=log_handle,
                    stderr=subprocess.STDOUT,
                    text=True,
                )
                with self._lock:
                    task.pid = process.pid
                return_code = process.wait()
            after = {path.name for path in output_root.iterdir()} if output_root.exists() and output_root.is_dir() else set()
            new_names = sorted(after - before)
            if task.kind == "eval" and new_names:
                task.run_id = f"{task.layer}/{new_names[-1]}"
            if task.kind == "dataset-generation" and new_names:
                generated_jsons = [
                    output_root / name
                    for name in new_names
                    if name.endswith(".json") and not name.endswith(".summary.json")
                ]
                if generated_jsons:
                    task.run_id = _safe_relative(sorted(generated_jsons)[-1], self.project_root)
            with self._lock:
                task.status = "succeeded" if return_code == 0 else "failed"
                task.error = "" if return_code == 0 else f"command exited with code {return_code}"
                task.finished_at = _utc_now()
        except Exception as exc:
            with self._lock:
                task.status = "failed"
                task.error = str(exc)
                task.finished_at = _utc_now()

    def _build_run_record(self, layer: str, run_dir: Path) -> dict[str, Any]:
        summary = _read_json(run_dir / "summary.json", {})
        artifacts = {
            "summary_path": self._artifact_path(run_dir / "summary.json"),
            "results_path": self._artifact_path(run_dir / "results.json"),
            "annotation_path": self._artifact_path(run_dir / "annotation.csv"),
            "judge_results_path": self._artifact_path(run_dir / "judge_results.json"),
            "badcase_csv_path": self._artifact_path(run_dir / "badcase.csv"),
            "badcase_md_path": self._artifact_path(run_dir / "badcase.md"),
            "generation_metrics_json_path": self._artifact_path(run_dir / "generation_metrics.json"),
            "generation_metrics_csv_path": self._artifact_path(run_dir / "generation_metrics.csv"),
        }
        status = "succeeded" if (run_dir / "summary.json").exists() else "failed"
        return {
            "run_id": f"{layer}/{run_dir.name}",
            "layer": layer,
            "name": run_dir.name,
            "status": status,
            "created_at": datetime.fromtimestamp(run_dir.stat().st_ctime).isoformat(timespec="seconds"),
            "updated_at": datetime.fromtimestamp(run_dir.stat().st_mtime).isoformat(timespec="seconds"),
            "output_dir": _safe_relative(run_dir, self.project_root),
            "summary": summary,
            "generation_metrics": _read_json(run_dir / "generation_metrics.json", {}),
            "artifacts": artifacts,
        }

    def _artifact_path(self, path: Path) -> str:
        return _safe_relative(path, self.project_root) if path.exists() else ""

    def _split_run_id(self, run_id: str) -> tuple[str, str]:
        parts = run_id.replace("\\", "/").split("/", 1)
        if len(parts) != 2 or parts[0] not in RUN_LAYERS:
            raise ValueError(f"invalid run_id: {run_id}")
        return parts[0], parts[1]

    def _task_to_dict(self, task: EvalTask) -> dict[str, Any]:
        return {
            "task_id": task.task_id,
            "kind": task.kind,
            "status": task.status,
            "layer": task.layer,
            "run_id": task.run_id,
            "command": task.command,
            "created_at": task.created_at,
            "started_at": task.started_at,
            "finished_at": task.finished_at,
            "output_dir": task.output_dir,
            "log_path": task.log_path,
            "pid": task.pid,
            "error": task.error,
        }
