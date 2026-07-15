"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Dumbbell,
  Flame,
  ImageUp,
  LoaderCircle,
  Target,
  Upload,
  Utensils
} from "lucide-react";
import type { Analysis, Profile } from "@/lib/types";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, roundMeasurement } from "@/lib/measurements";
import { apiFetch, readApiError } from "@/lib/api";

export default function WorkoutAnalyzer({ profile, setProfile, accessToken, onPersisted }: { profile: Profile; setProfile: React.Dispatch<React.SetStateAction<Profile>>; accessToken?: string; onPersisted?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [sleep, setSleep] = useState("7.5");
  const [soreness, setSoreness] = useState("4");
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ageInput, setAgeInput] = useState(String(profile.age));
  const [weightInput, setWeightInput] = useState("");
  const [heightFeetInput, setHeightFeetInput] = useState("");
  const [heightInchesInput, setHeightInchesInput] = useState("");
  const [heightCmInput, setHeightCmInput] = useState("");

  const imperialHeight = useMemo(() => cmToFeetInches(profile.height_cm), [profile.height_cm]);

  useEffect(() => {
    setAgeInput(String(profile.age));
    if (profile.unit_system === "imperial") {
      setWeightInput(String(roundMeasurement(kgToLb(profile.weight_kg))));
      const height = cmToFeetInches(profile.height_cm);
      setHeightFeetInput(String(height.feet));
      setHeightInchesInput(String(height.inches));
    } else {
      setWeightInput(String(roundMeasurement(profile.weight_kg)));
      setHeightCmInput(String(roundMeasurement(profile.height_cm)));
    }
  }, [profile.unit_system]);

  function parseRequiredNumber(value: string, label: string, min: number, max: number): number {
    if (value.trim() === "") throw new Error(`${label} is required.`);
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      throw new Error(`${label} must be between ${min} and ${max}.`);
    }
    return parsed;
  }

  function buildProfileFromInputs(): Profile {
    const age = parseRequiredNumber(ageInput, "Age", 13, 100);
    const weight = profile.unit_system === "imperial"
      ? lbToKg(parseRequiredNumber(weightInput, "Weight", 66, 772))
      : parseRequiredNumber(weightInput, "Weight", 30, 350);
    const height = profile.unit_system === "imperial"
      ? feetInchesToCm(
          parseRequiredNumber(heightFeetInput, "Height in feet", 3, 8),
          parseRequiredNumber(heightInchesInput, "Height in inches", 0, 11)
        )
      : parseRequiredNumber(heightCmInput, "Height", 100, 250);
    return { ...profile, age, weight_kg: roundMeasurement(weight, 2), height_cm: roundMeasurement(height, 1) };
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setAnalysis(null);
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a workout screenshot first.");
      return;
    }

    setLoading(true);
    setError("");
    let validatedProfile: Profile;
    try {
      validatedProfile = buildProfileFromInputs();
      setProfile(validatedProfile);
    } catch (validationError) {
      setLoading(false);
      setError(validationError instanceof Error ? validationError.message : "Check your profile values.");
      return;
    }
    const form = new FormData();
    form.append("image", file);
    form.append("profile_json", JSON.stringify(validatedProfile));
    form.append("sleep_hours", sleep);
    form.append("soreness", soreness);
    form.append("notes", notes);

    try {
      const response = await apiFetch("/v1/analyze-workout", {
        method: "POST",
        body: form,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
      });
      if (!response.ok) throw new Error(await readApiError(response, "Analysis failed"));
      const body = await response.json();
      setAnalysis(body);
      if (body.persisted) onPersisted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="layout">
        <form className="panel formPanel" onSubmit={submit}>
          <div className="sectionTitle">
            <ImageUp size={20} />
            <div><h2>Workout analyzer</h2><p>JPEG, PNG, or WebP up to 10 MB</p></div>
          </div>

          <label className="dropZone">
            {preview ? <img src={preview} alt="Workout preview" /> : (
              <div className="dropCopy">
                <Upload size={34} />
                <strong>Choose a workout screenshot</strong>
                <span>AI reads movements, reps, intervals, and training demand.</span>
              </div>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFileChange} />
          </label>

          <h3>Your profile</h3>
          <div className="grid">
            <Field label="Age">
              <input type="number" min="13" max="100" value={ageInput} onChange={(e) => setAgeInput(e.target.value)} />
            </Field>
            {profile.unit_system === "imperial" ? <>
              <Field label="Weight (lb)">
                <input type="number" min="66" max="772" step="0.1" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
              </Field>
              <Field label="Height (feet)">
                <input type="number" min="3" max="8" value={heightFeetInput} onChange={(e) => setHeightFeetInput(e.target.value)} />
              </Field>
              <Field label="Height (inches)">
                <input type="number" min="0" max="11" value={heightInchesInput} onChange={(e) => setHeightInchesInput(e.target.value)} />
              </Field>
            </> : <>
              <Field label="Weight (kg)">
                <input type="number" min="30" max="350" step="0.1" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} />
              </Field>
              <Field label="Height (cm)">
                <input type="number" min="100" max="250" step="0.1" value={heightCmInput} onChange={(e) => setHeightCmInput(e.target.value)} />
              </Field>
            </>}
            <Field label="Sex used for BMR estimate">
              <select value={profile.sex} onChange={(e) => update("sex", e.target.value as Profile["sex"])}>
                <option value="male">Male</option><option value="female">Female</option><option value="other">Other / midpoint</option>
              </select>
            </Field>
            <Field label="Goal">
              <select value={profile.goal} onChange={(e) => update("goal", e.target.value as Profile["goal"])}>
                <option value="fat_loss">Fat loss</option><option value="maintenance">Maintenance</option><option value="muscle_gain">Muscle gain</option>
              </select>
            </Field>
            <Field label="Daily activity">
              <select value={profile.activity_level} onChange={(e) => update("activity_level", e.target.value as Profile["activity_level"])}>
                <option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="very_active">Very active</option><option value="athlete">Athlete</option>
              </select>
            </Field>
            <Field label="Sleep last night">
              <input type="number" step="0.5" min="0" max="14" value={sleep} onChange={(e) => setSleep(e.target.value)} />
            </Field>
            <Field label="Soreness (1–10)">
              <input type="number" min="1" max="10" value={soreness} onChange={(e) => setSoreness(e.target.value)} />
            </Field>
          </div>

          <Field label="Context for the coach">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Example: Bench felt heavy; training at 6 PM." />
          </Field>

          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={20} /> : <BrainCircuit size={20} />}
            {loading ? "Analyzing workout…" : "Analyze and build my plan"}
          </button>
          <p className="finePrint">Estimates are for general fitness planning, not medical nutrition therapy.</p>
        </form>

        <section className="results">
          {!analysis ? <EmptyState /> : <Results analysis={analysis} />}
        </section>
      </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function EmptyState() {
  return (
    <div className="panel empty">
      <BrainCircuit size={44} />
      <h2>Your personalized plan appears here</h2>
      <p>The nutrition engine combines your profile with the training demand extracted from the image.</p>
      <div className="miniFeatures">
        <span><Target size={16} /> Goal-aware calories</span>
        <span><Utensils size={16} /> Protein and carbs</span>
        <span><Activity size={16} /> Recovery score</span>
      </div>
    </div>
  );
}

function Results({ analysis }: { analysis: Analysis }) {
  const t = analysis.target;
  return (
    <>
      <div className="metricGrid">
        <Metric icon={<Flame />} label="Calories" value={t.calories.toLocaleString()} sub={`${t.calorie_range_low}–${t.calorie_range_high} kcal`} />
        <Metric icon={<Dumbbell />} label="Protein" value={`${t.protein_g}g`} sub="daily target" />
        <Metric icon={<Activity />} label="Carbs" value={`${t.carbs_g}g`} sub="training fuel" />
        <Metric icon={<Target />} label="Recovery" value={`${t.recovery_score}%`} sub={`${(t.water_ml / 1000).toFixed(1)} L water`} />
      </div>

      <article className="panel coach">
        <p className="eyebrow">AI COACH</p>
        <h2>{analysis.workout.title}</h2>
        <p>{analysis.coach.summary}</p>
        <ol>{analysis.coach.actions.map((action) => <li key={action}>{action}</li>)}</ol>
        <p className="uncertainty">{analysis.coach.uncertainty}</p>
      </article>

      <article className="panel">
        <div className="sectionTitle"><Dumbbell size={20} /><div><h2>Workout breakdown</h2><p>{analysis.workout.format}</p></div></div>
        <div className="scoreRow">
          <span>Strength <b>{analysis.workout.strength_score}</b></span>
          <span>Conditioning <b>{analysis.workout.conditioning_score}</b></span>
          <span>Estimated burn <b>{t.estimated_workout_calories_low}–{t.estimated_workout_calories_high}</b></span>
        </div>
        <div className="exerciseList">
          {analysis.workout.exercises.map((exercise, index) => (
            <div className="exercise" key={`${exercise.name}-${index}`}>
              <strong>{exercise.name}</strong>
              <span>{[exercise.sets && `${exercise.sets} sets`, exercise.reps && `${exercise.reps} reps`, exercise.load, exercise.duration].filter(Boolean).join(" · ") || "Details not visible"}</span>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}

function Metric({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return <div className="metric"><div className="metricIcon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
