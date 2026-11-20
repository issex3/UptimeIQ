"""AI-assisted metric analysis."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.deps import get_current_user
from app.schemas import AnalyzeRequest, AnalyzeResponse
from app.services.ai_service import analyze_metrics

router = APIRouter(tags=["analyze"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    body: AnalyzeRequest,
    _: Annotated[str, Depends(get_current_user)],
) -> dict[str, Any]:
    """Run AI (or heuristic) analysis on the provided metric snapshot."""
    data = body.model_dump(exclude_none=True)
    result = await analyze_metrics(data)
    return result
