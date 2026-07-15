from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, model_validator


class Goal(str, Enum):
    fat_loss = "fat_loss"
    maintenance = "maintenance"
    muscle_gain = "muscle_gain"


class UnitSystem(str, Enum):
    imperial = "imperial"
    metric = "metric"


class ActivityLevel(str, Enum):
    sedentary = "sedentary"
    light = "light"
    moderate = "moderate"
    very_active = "very_active"
    athlete = "athlete"


class UserProfile(BaseModel):
    age: int = Field(ge=13, le=100)
    sex: str = Field(pattern="^(male|female|other)$")
    height_cm: float = Field(gt=100, lt=250)
    weight_kg: float = Field(gt=30, lt=350)
    goal: Goal = Goal.fat_loss
    activity_level: ActivityLevel = ActivityLevel.moderate
    training_days_per_week: int = Field(default=4, ge=0, le=14)
    target_rate_percent_per_week: float = Field(default=0.5, ge=0.1, le=1.0)


class Exercise(BaseModel):
    name: str
    sets: int | None = None
    reps: str | None = None
    load: str | None = None
    distance: str | None = None
    calories: str | None = None
    duration: str | None = None
    notes: str | None = None


class WorkoutExtraction(BaseModel):
    title: str = "Uploaded workout"
    source_text: str = ""
    workout_type: str = "unknown"
    format: str = ""
    estimated_duration_minutes: int | None = Field(default=None, ge=0, le=360)
    intensity: str = "unknown"
    strength_score: int = Field(default=50, ge=0, le=100)
    conditioning_score: int = Field(default=50, ge=0, le=100)
    muscle_groups: list[str] = []
    exercises: list[Exercise] = []
    uncertainties: list[str] = []


class MacroTarget(BaseModel):
    calories: int
    calorie_range_low: int
    calorie_range_high: int
    protein_g: int
    carbs_g: int
    fat_g: int
    water_ml: int
    estimated_workout_calories_low: int
    estimated_workout_calories_high: int
    recovery_score: int
    calculation_notes: list[str]


class CoachResponse(BaseModel):
    summary: str
    actions: list[str] = Field(min_length=1, max_length=3)
    uncertainty: str


class AnalysisResponse(BaseModel):
    workout: WorkoutExtraction
    target: MacroTarget
    coach: CoachResponse
    persisted: bool = False


class ProfileSettings(UserProfile):
    unit_system: UnitSystem = UnitSystem.imperial
    display_name: str | None = Field(default=None, max_length=80)
    timezone: str = Field(default="America/Chicago", max_length=80)


class WorkoutHistoryItem(BaseModel):
    id: str
    title: str | None = None
    performed_at: str
    workout_type: str | None = None
    duration_minutes: int | None = None
    intensity: str | None = None
    strength_score: int | None = None
    conditioning_score: int | None = None
    estimated_calories_low: int | None = None
    estimated_calories_high: int | None = None
    muscle_groups: list[str] = []
    extraction: dict[str, Any] | None = None
