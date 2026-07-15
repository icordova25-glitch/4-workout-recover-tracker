from app.nutrition import calculate_targets
from app.schemas import UserProfile, WorkoutExtraction


def test_targets_are_internally_consistent():
    profile = UserProfile(
        age=30,
        sex="male",
        height_cm=178,
        weight_kg=99.8,
        goal="fat_loss",
        activity_level="moderate",
        training_days_per_week=4,
    )
    workout = WorkoutExtraction(
        estimated_duration_minutes=50,
        intensity="high",
        strength_score=70,
        conditioning_score=80,
    )
    result = calculate_targets(profile, workout, sleep_hours=7.5, soreness=4)
    assert result.calories == result.protein_g * 4 + result.carbs_g * 4 + result.fat_g * 9
    assert result.protein_g >= 190
    assert result.estimated_workout_calories_high > result.estimated_workout_calories_low
