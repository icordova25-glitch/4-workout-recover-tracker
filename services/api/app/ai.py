from __future__ import annotations
import base64
import json
import re
from openai import OpenAI
from .config import Settings
from .prompts import WORKOUT_EXTRACTION_PROMPT, COACH_PROMPT
from .schemas import WorkoutExtraction, UserProfile, MacroTarget, CoachResponse


def _json_from_text(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            raise ValueError("AI response did not contain a JSON object")
        return json.loads(match.group(0))


class AIService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def extract_workout(self, image_bytes: bytes, content_type: str) -> WorkoutExtraction:
        if not self.client:
            return self.demo_extraction()

        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        response = self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {"type": "input_text", "text": WORKOUT_EXTRACTION_PROMPT},
                        {
                            "type": "input_image",
                            "image_url": f"data:{content_type};base64,{image_b64}",
                        },
                    ],
                }
            ],
        )
        return WorkoutExtraction.model_validate(_json_from_text(response.output_text))

    def coach(
        self,
        profile: UserProfile,
        workout: WorkoutExtraction,
        target: MacroTarget,
        sleep_hours: float | None,
        soreness: int | None,
        notes: str | None,
    ) -> CoachResponse:
        payload = {
            "profile": profile.model_dump(mode="json"),
            "workout": workout.model_dump(mode="json"),
            "target": target.model_dump(mode="json"),
            "sleep_hours": sleep_hours,
            "soreness": soreness,
            "notes": notes,
        }

        if not self.client:
            return self.demo_coach(target, workout)

        response = self.client.responses.create(
            model=self.settings.openai_model,
            input=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": COACH_PROMPT + "\n\nDATA:\n" + json.dumps(payload),
                        }
                    ],
                }
            ],
        )
        return CoachResponse.model_validate(_json_from_text(response.output_text))

    @staticmethod
    def demo_extraction() -> WorkoutExtraction:
        return WorkoutExtraction(
            title="Mixed rowing, kettlebell, and bench session",
            source_text="3 rounds: row, KB sumo deadlift high pull, goblet box step overs. Bench press every 2:00.",
            workout_type="mixed",
            format="Strength intervals plus 3-round conditioning piece",
            estimated_duration_minutes=50,
            intensity="high",
            strength_score=72,
            conditioning_score=78,
            muscle_groups=["chest", "triceps", "back", "glutes", "hamstrings", "quads"],
            exercises=[
                {"name": "Bench press", "reps": "10-8-5-5-3-3", "duration": "Every 2:00 for 12:00"},
                {"name": "Row", "calories": "24/18", "sets": 3},
                {"name": "Kettlebell sumo deadlift high pull", "reps": "18", "sets": 3},
                {"name": "Single-kettlebell goblet box step overs", "reps": "12", "sets": 3},
            ],
            uncertainties=["Some text at the bottom of the screenshot is obscured."],
        )

    @staticmethod
    def demo_coach(target: MacroTarget, workout: WorkoutExtraction) -> CoachResponse:
        return CoachResponse(
            summary=(
                f"This is a demanding mixed session, so keep protein at {target.protein_g} g "
                f"and use the {target.carbs_g} g carbohydrate target to support rowing and lifting. "
                f"The {target.calories}-calorie target keeps the plan aligned with your selected goal."
            ),
            actions=[
                "Eat 30–45 g protein in a meal within a few hours after training.",
                "Place roughly one quarter of today’s carbohydrates before training and one quarter afterward.",
                f"Aim for about {target.water_ml / 1000:.1f} L of fluid across the day, adding sodium when sweating heavily.",
            ],
            uncertainty="The screenshot describes the workout, but actual calorie expenditure depends on pace, load, rest, and individual physiology.",
        )
