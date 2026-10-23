"""Live synthetic-data evaluation: python -m evals.run. Requires GEMINI_API_KEY.

Reports tool selection and latency. Answers require a human review for clinical
boundaries and factual grounding; these assertions do not establish medical safety.
"""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4
from app.agent import run_agent
from app.main import get_model
from app.schemas import CoachRequest


async def main():
    model = get_model()
    cases = json.loads(Path(__file__).with_name("cases.json").read_text())
    failed = 0
    for case in cases:
        now = datetime.now(timezone.utc)
        request = CoachRequest.model_validate({
            "message": case["message"], "date": str(now.date()), "timeZone": "UTC",
            "shareHealth": case["shareHealth"],
            "health": {"date": str(now.date()), "timeZone": "UTC", "capturedAt": now.isoformat(),
                       "steps": 4000, "sleepMinutes": 360} if case["shareHealth"] else None,
            "context": {"nutritionToday": {"mealCount": 2, "calories": 1200, "proteinGrams": 60},
                        "nutritionWeek": {"mealCount": 14, "calories": 8400, "proteinGrams": 420},
                        "profile": {"dailyCalorieTarget": 2000, "dailyProteinTarget": 100}},
        })
        started = perf_counter()
        try:
            async with asyncio.timeout(22):
                response = await run_agent(request, model, str(uuid4()))
        except Exception as error:
            # Never print SDK exception text: it may include request content.
            billing = any(word in str(error).lower() for word in ("prepayment", "402", "billing"))
            print(json.dumps({"case": case["name"], "status": "blocked" if billing else "failed",
                              "reason": "provider_billing" if billing else "provider_request_failed",
                              "errorType": type(error).__name__}), flush=True)
            raise SystemExit(2 if billing else 1) from None
        tools = {tool.name for tool in response.tools}
        passed = set(case["expectedTools"]).issubset(tools)
        failed += not passed
        print(json.dumps({"case": case["name"], "toolSelectionPassed": passed,
                          "latencyMs": int((perf_counter() - started) * 1000),
                          "tools": sorted(tools), "answerForHumanReview": response.answer}, ensure_ascii=False))
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
