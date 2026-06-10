from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from .eval_ops import EvalOpsService
from .models import (
    AnswerRequest,
    AnswerResponse,
    CardListResponse,
    IngestRequest,
    IngestResponse,
    KnowledgeCard,
    SearchRequest,
    SearchResponse,
)
from .service import KnowledgeService

app = FastAPI(title="Local Dify RAG Migration", version="0.1.0")
service = KnowledgeService()
eval_ops = EvalOpsService()
STATIC_DIR = Path(__file__).resolve().parent / "static"


class EvalRunRequest(BaseModel):
    layer: str
    dataset_path: str
    base_url: str = "http://127.0.0.1:8000"


class DatasetGenerationRequest(BaseModel):
    layer: str = "e2e"
    count: int = Field(default=50, ge=1, le=200)
    mode: str = "mixed"
    seed: int = 42
    requirements: str = ""
    dry_run: bool = False


class AnnotationUpdateRequest(BaseModel):
    run_id: str
    sample_id: str
    fields: dict[str, str] = Field(default_factory=dict)


class BadcaseCreateRequest(BaseModel):
    sample_id: str
    run_id: str
    layer: str
    reason: str
    severity: str = "medium"
    status: str = "open"
    owner: str = ""
    related_module: str = ""
    notes: str = ""


class BadcaseUpdateRequest(BaseModel):
    fields: dict[str, str] = Field(default_factory=dict)


class JudgeReviewRequest(BaseModel):
    run_id: str
    sample_id: str
    fields: dict[str, str] = Field(default_factory=dict)


class JudgeBadcaseCreateRequest(BaseModel):
    sample_id: str
    run_id: str
    reason: str
    severity: str = "medium"
    status: str = "open"
    notes: str = ""


class JudgeBadcaseUpdateRequest(BaseModel):
    fields: dict[str, str] = Field(default_factory=dict)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
def dashboard() -> HTMLResponse:
    return HTMLResponse((STATIC_DIR / "dashboard.html").read_text(encoding="utf-8"))


@app.get("/eval-dashboard", response_class=HTMLResponse)
def eval_dashboard() -> HTMLResponse:
    return HTMLResponse((STATIC_DIR / "eval_ops" / "index.html").read_text(encoding="utf-8"))


@app.get("/api/eval/datasets")
def eval_datasets() -> list[dict]:
    return eval_ops.list_datasets()


@app.post("/api/eval/datasets/generate")
def start_dataset_generation(request: DatasetGenerationRequest) -> dict:
    try:
        return eval_ops.start_dataset_generation(
            layer=request.layer,
            count=request.count,
            mode=request.mode,
            seed=request.seed,
            requirements=request.requirements,
            dry_run=request.dry_run,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/eval/runs")
def eval_runs() -> list[dict]:
    return eval_ops.list_runs()


@app.post("/api/eval/runs")
def start_eval_run(request: EvalRunRequest) -> dict:
    try:
        return eval_ops.start_eval_run(
            layer=request.layer,
            dataset_path=request.dataset_path,
            base_url=request.base_url,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/eval/runs/{layer}/{run_name}")
def eval_run(layer: str, run_name: str) -> dict:
    try:
        return eval_ops.get_run(f"{layer}/{run_name}")
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/eval/runs/{layer}/{run_name}/results")
def eval_run_results(layer: str, run_name: str) -> dict:
    try:
        return eval_ops.get_run_results(f"{layer}/{run_name}")
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/eval/runs/{layer}/{run_name}/judge-results")
def eval_judge_results(layer: str, run_name: str) -> dict:
    try:
        return eval_ops.get_judge_results(f"{layer}/{run_name}")
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/eval/runs/{layer}/{run_name}/judge")
def start_eval_judge(layer: str, run_name: str) -> dict:
    try:
        return eval_ops.start_judge(run_id=f"{layer}/{run_name}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/eval/tasks")
def eval_tasks() -> list[dict]:
    return eval_ops.list_tasks()


@app.get("/api/eval/tasks/{task_id}")
def eval_task(task_id: str) -> dict:
    try:
        return eval_ops.get_task(task_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/eval/tasks/{task_id}/logs")
def eval_task_logs(task_id: str) -> dict:
    try:
        return {"task_id": task_id, "logs": eval_ops.get_task_logs(task_id)}
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.patch("/api/eval/annotations")
def update_eval_annotation(request: AnnotationUpdateRequest) -> dict:
    try:
        return eval_ops.update_annotation(
            run_id=request.run_id,
            sample_id=request.sample_id,
            fields=request.fields,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/eval/badcases")
def eval_badcases() -> list[dict]:
    return eval_ops.list_badcases()


@app.post("/api/eval/badcases")
def create_eval_badcase(request: BadcaseCreateRequest) -> dict:
    try:
        return eval_ops.create_badcase(request.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/eval/badcases/{badcase_id}")
def update_eval_badcase(badcase_id: str, request: BadcaseUpdateRequest) -> dict:
    try:
        return eval_ops.update_badcase(badcase_id, request.fields)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/eval/judge-reviews")
def eval_judge_reviews() -> list[dict]:
    return eval_ops.list_judge_reviews()


@app.put("/api/eval/judge-reviews")
def upsert_eval_judge_review(request: JudgeReviewRequest) -> dict:
    try:
        return eval_ops.upsert_judge_review(
            run_id=request.run_id,
            sample_id=request.sample_id,
            fields=request.fields,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/eval/judge-badcases")
def eval_judge_badcases() -> list[dict]:
    return eval_ops.list_judge_badcases()


@app.post("/api/eval/judge-badcases")
def create_eval_judge_badcase(request: JudgeBadcaseCreateRequest) -> dict:
    try:
        return eval_ops.create_judge_badcase(request.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.patch("/api/eval/judge-badcases/{judge_badcase_id}")
def update_eval_judge_badcase(judge_badcase_id: str, request: JudgeBadcaseUpdateRequest) -> dict:
    try:
        return eval_ops.update_judge_badcase(judge_badcase_id, request.fields)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/cards", response_model=CardListResponse)
def list_cards(limit: int = 100) -> CardListResponse:
    try:
        return service.list_cards(limit=max(1, min(limit, 500)))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    try:
        return service.ingest(url=str(request.url), force_refresh=request.force_refresh)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/search", response_model=SearchResponse)
def search(request: SearchRequest) -> SearchResponse:
    try:
        return service.search(
            query=request.query,
            top_k=request.top_k,
            final_k=request.final_k,
            min_score=request.min_score,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/answer", response_model=AnswerResponse)
def answer(request: AnswerRequest) -> AnswerResponse:
    try:
        return service.answer(query=request.query, card_id=request.card_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/cards/{card_id}", response_model=KnowledgeCard)
def get_card(card_id: str) -> KnowledgeCard:
    try:
        return service.get_card(card_id=card_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
