"""AI-powered metric analysis using OpenAI when configured, else heuristic fallback."""

from typing import Any

from app.config import settings


def _mock_analyze(data: dict[str, Any]) -> dict[str, str]:
    """Deterministic analysis without external APIs."""
    cpu = float(data.get("cpu", 0))
    mem = float(data.get("memory", 0))
    issues = []
    if cpu > 85:
        issues.append("high CPU")
    if mem > 80:
        issues.append("high memory")
    if not issues:
        return {
            "issue": "No critical resource pressure detected.",
            "explanation": "CPU and memory are within normal operating ranges.",
            "solution": "Continue monitoring; consider defining baselines for peak hours.",
        }
    return {
        "issue": f"Elevated resources: {', '.join(issues)}.",
        "explanation": (
            "Sustained high utilization can increase latency and reduce headroom for spikes."
        ),
        "solution": (
            "Identify top processes, scale workloads horizontally or vertically, "
            "and review scheduled jobs or noisy neighbors."
        ),
    }


async def analyze_metrics(data: dict[str, Any]) -> dict[str, str]:
    """
    Produce structured diagnosis for the given metric snapshot or aggregate.

    Uses OpenAI when OPENAI_API_KEY is set; otherwise returns mock/heuristic output.
    """
    if not settings.openai_api_key:
        return _mock_analyze(data)

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = (
        "You are an SRE incident triage assistant.\n"
        "Given a single device metric snapshot, provide practical operational guidance.\n"
        "Return JSON ONLY with keys: issue, explanation, solution.\n"
        "Quality requirements:\n"
        "- issue: one-line diagnosis with severity wording when applicable\n"
        "- explanation: include concrete evidence from provided values\n"
        "- solution: 3 short, prioritized actions as one compact sentence separated by '; '\n"
        "- avoid generic advice, avoid markdown, no extra keys\n\n"
        f"Metric snapshot:\n{data}"
    )
    response = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Return strict JSON only. "
                    "Use actionable SRE language grounded in the provided metrics."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    text = response.choices[0].message.content or "{}"
    # Minimal parsing — assume model returns JSON
    import json

    try:
        parsed = json.loads(text)
        return {
            "issue": str(parsed.get("issue", "")),
            "explanation": str(parsed.get("explanation", "")),
            "solution": str(parsed.get("solution", "")),
        }
    except json.JSONDecodeError:
        return {
            "issue": "Analysis parsing failed",
            "explanation": text[:500],
            "solution": "Retry analysis or check API response format.",
        }
