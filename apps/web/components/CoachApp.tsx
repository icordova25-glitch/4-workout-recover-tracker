"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Dumbbell, History, LogIn, LogOut, Settings, Sparkles } from "lucide-react";
import WorkoutAnalyzer from "./WorkoutAnalyzer";
import type { Profile, WorkoutHistoryItem } from "@/lib/types";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import { cmToFeetInches, feetInchesToCm, kgToLb, lbToKg, roundMeasurement } from "@/lib/measurements";
import { apiFetch, readApiError } from "@/lib/api";

export const defaultProfile: Profile = { age:30, sex:"male", height_cm:178, weight_kg:99.8, goal:"fat_loss", activity_level:"moderate", training_days_per_week:4, target_rate_percent_per_week:0.5, display_name:"", timezone:"America/Chicago", unit_system:"imperial" };

export default function CoachApp() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<"analyze"|"history"|"settings">("analyze");
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const token = session?.access_token;
  useEffect(() => {
    if (!token) { setProfile(defaultProfile); setHistory([]); return; }
    Promise.all([
      apiFetch("/v1/profile", { headers: { Authorization: `Bearer ${token}` } }),
      apiFetch("/v1/workouts", { headers: { Authorization: `Bearer ${token}` } })
    ]).then(async ([p, h]) => {
      if (p.ok) { const body = await p.json(); if (body) setProfile({ ...defaultProfile, ...body }); }
      if (h.ok) setHistory(await h.json());
    }).catch(() => setMessage("Could not load saved account data."));
  }, [token]);

  async function refreshHistory() {
    if (!token) return;
    const response = await apiFetch("/v1/workouts", { headers: { Authorization: `Bearer ${token}` } });
    if (response.ok) setHistory(await response.json());
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="hero compactHero"><div className="brandMark"><Dumbbell size={26}/></div><div><p className="eyebrow">CORDOVA ATHLETIC PERFORMANCE</p><h1>Coach AI</h1></div></div>
        <div className="accountArea">
          {session ? <><span className="userEmail">{session.user.email}</span><button className="ghost" onClick={() => supabase?.auth.signOut()}><LogOut size={16}/>Sign out</button></> : <span className="demoBadge">{isSupabaseConfigured ? "Sign in to save" : "Demo mode"}</span>}
        </div>
      </header>

      {!session && isSupabaseConfigured && <AuthPanel supabase={supabase!} />}
      {message && <p className="notice">{message}</p>}

      <nav className="tabs">
        <button className={tab==="analyze"?"active":""} onClick={()=>setTab("analyze")}><Sparkles size={17}/>Analyze</button>
        <button className={tab==="history"?"active":""} onClick={()=>setTab("history")}><History size={17}/>History</button>
        <button className={tab==="settings"?"active":""} onClick={()=>setTab("settings")}><Settings size={17}/>Profile</button>
      </nav>

      {tab === "analyze" && <WorkoutAnalyzer profile={profile} setProfile={setProfile} accessToken={token} onPersisted={refreshHistory} />}
      {tab === "history" && <HistoryView history={history} authenticated={Boolean(session)} />}
      {tab === "settings" && <SettingsView profile={profile} setProfile={setProfile} token={token} />}
    </main>
  );
}

function AuthPanel({ supabase }: { supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>> }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [mode,setMode]=useState<"signin"|"signup">("signin"); const [status,setStatus]=useState("");
  async function submit(e:FormEvent){ e.preventDefault(); setStatus(""); const result = mode==="signin" ? await supabase.auth.signInWithPassword({email,password}) : await supabase.auth.signUp({email,password}); if(result.error) setStatus(result.error.message); else if(mode==="signup"&&!result.data.session) setStatus("Check your email to confirm your account."); }
  return <section className="panel authPanel"><div><p className="eyebrow">ACCOUNT</p><h2>{mode==="signin"?"Sign in to sync your training":"Create your Coach AI account"}</h2><p>Authenticated workouts and profile settings are saved privately in Supabase.</p></div><form onSubmit={submit}><input type="email" placeholder="Email" required value={email} onChange={e=>setEmail(e.target.value)}/><input type="password" placeholder="Password (6+ characters)" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary compact" type="submit"><LogIn size={17}/>{mode==="signin"?"Sign in":"Create account"}</button><button className="linkButton" type="button" onClick={()=>setMode(mode==="signin"?"signup":"signin")}>{mode==="signin"?"Need an account? Sign up":"Already registered? Sign in"}</button>{status&&<p className="authStatus">{status}</p>}</form></section>
}

function HistoryView({history,authenticated}:{history:WorkoutHistoryItem[];authenticated:boolean}){
  if(!authenticated) return <section className="panel empty"><History size={42}/><h2>Workout history requires an account</h2><p>Demo analysis still works, but only signed-in workouts are persisted.</p></section>;
  if(!history.length) return <section className="panel empty"><History size={42}/><h2>No saved workouts yet</h2><p>Analyze a workout while signed in and it will appear here.</p></section>;
  return <section className="historyGrid">{history.map(item=><article className="panel historyCard" key={item.id}><div><p className="eyebrow">{new Date(item.performed_at).toLocaleDateString()}</p><h2>{item.title||"Workout"}</h2></div><div className="scoreRow"><span>Strength <b>{item.strength_score??"—"}</b></span><span>Conditioning <b>{item.conditioning_score??"—"}</b></span><span>Burn <b>{item.estimated_calories_low??"—"}–{item.estimated_calories_high??"—"}</b></span></div><p className="muted">{item.workout_type||"Workout"}{item.duration_minutes?` · ${item.duration_minutes} min`:""}{item.intensity?` · ${item.intensity}`:""}</p>{item.muscle_groups?.length>0&&<div className="chips">{item.muscle_groups.map(x=><span key={x}>{x}</span>)}</div>}</article>)}</section>
}

function SettingsView({profile,setProfile,token}:{profile:Profile;setProfile:React.Dispatch<React.SetStateAction<Profile>>;token?:string}){
  const [status,setStatus]=useState("");
  const [ageInput,setAgeInput]=useState(String(profile.age));
  const [weightInput,setWeightInput]=useState("");
  const [heightFeetInput,setHeightFeetInput]=useState("");
  const [heightInchesInput,setHeightInchesInput]=useState("");
  const [heightCmInput,setHeightCmInput]=useState("");
  const [trainingDaysInput,setTrainingDaysInput]=useState(String(profile.training_days_per_week));

  useEffect(()=>{
    setAgeInput(String(profile.age));
    setTrainingDaysInput(String(profile.training_days_per_week));
    if(profile.unit_system==="imperial"){
      const height=cmToFeetInches(profile.height_cm);
      setWeightInput(String(roundMeasurement(kgToLb(profile.weight_kg))));
      setHeightFeetInput(String(height.feet));
      setHeightInchesInput(String(height.inches));
    } else {
      setWeightInput(String(roundMeasurement(profile.weight_kg)));
      setHeightCmInput(String(roundMeasurement(profile.height_cm)));
    }
  },[profile.unit_system]);

  function update<K extends keyof Profile>(k:K,v:Profile[K]){setProfile(current=>({...current,[k]:v}));}
  function requiredNumber(value:string,label:string,min:number,max:number){
    if(value.trim()==="") throw new Error(`${label} is required.`);
    const parsed=Number(value);
    if(!Number.isFinite(parsed)||parsed<min||parsed>max) throw new Error(`${label} must be between ${min} and ${max}.`);
    return parsed;
  }
  function buildProfile():Profile{
    const age=requiredNumber(ageInput,"Age",13,100);
    const trainingDays=requiredNumber(trainingDaysInput,"Training days",0,14);
    const weight=profile.unit_system==="imperial"
      ? lbToKg(requiredNumber(weightInput,"Weight",66,772))
      : requiredNumber(weightInput,"Weight",30,350);
    const height=profile.unit_system==="imperial"
      ? feetInchesToCm(requiredNumber(heightFeetInput,"Height in feet",3,8),requiredNumber(heightInchesInput,"Height in inches",0,11))
      : requiredNumber(heightCmInput,"Height",100,250);
    return {...profile,age,training_days_per_week:trainingDays,weight_kg:roundMeasurement(weight,2),height_cm:roundMeasurement(height,1)};
  }
  async function save(e:FormEvent){
    e.preventDefault();
    setStatus("");
    let next:Profile;
    try{next=buildProfile(); setProfile(next);}catch(error){setStatus(error instanceof Error?error.message:"Check your profile values.");return;}
    if(!token){setStatus("Demo profile is stored only in this browser session.");return;}
    try{
      const response=await apiFetch("/v1/profile",{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify(next)});
      setStatus(response.ok?"Profile saved.":await readApiError(response,"Could not save profile."));
    }catch{setStatus("The Coach AI server could not be reached.");}
  }
  return <form className="panel settingsPanel" onSubmit={save}>
    <div className="sectionTitle"><Settings size={20}/><div><h2>Profile and settings</h2><p>Choose how measurements are displayed. Calculations remain normalized internally.</p></div></div>
    <div className="grid">
      <label className="field"><span>Units</span><select value={profile.unit_system} onChange={e=>update("unit_system",e.target.value as Profile["unit_system"])}><option value="imperial">Imperial (lb, ft/in)</option><option value="metric">Metric (kg, cm)</option></select></label>
      <label className="field"><span>Display name</span><input value={profile.display_name||""} onChange={e=>update("display_name",e.target.value)}/></label>
      <label className="field"><span>Age</span><input type="number" min="13" max="100" value={ageInput} onChange={e=>setAgeInput(e.target.value)}/></label>
      {profile.unit_system === "imperial" ? <>
        <label className="field"><span>Weight (lb)</span><input type="number" min="66" max="772" step="0.1" value={weightInput} onChange={e=>setWeightInput(e.target.value)}/></label>
        <label className="field"><span>Height (feet)</span><input type="number" min="3" max="8" value={heightFeetInput} onChange={e=>setHeightFeetInput(e.target.value)}/></label>
        <label className="field"><span>Height (inches)</span><input type="number" min="0" max="11" value={heightInchesInput} onChange={e=>setHeightInchesInput(e.target.value)}/></label>
      </> : <>
        <label className="field"><span>Weight (kg)</span><input type="number" min="30" max="350" step="0.1" value={weightInput} onChange={e=>setWeightInput(e.target.value)}/></label>
        <label className="field"><span>Height (cm)</span><input type="number" min="100" max="250" step="0.1" value={heightCmInput} onChange={e=>setHeightCmInput(e.target.value)}/></label>
      </>}
      <label className="field"><span>Goal</span><select value={profile.goal} onChange={e=>update("goal",e.target.value as Profile["goal"])}><option value="fat_loss">Fat loss</option><option value="maintenance">Maintenance</option><option value="muscle_gain">Muscle gain</option></select></label>
      <label className="field"><span>Daily activity</span><select value={profile.activity_level} onChange={e=>update("activity_level",e.target.value as Profile["activity_level"])}><option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="very_active">Very active</option><option value="athlete">Athlete</option></select></label>
      <label className="field"><span>Training days / week</span><input type="number" min="0" max="14" value={trainingDaysInput} onChange={e=>setTrainingDaysInput(e.target.value)}/></label>
      <label className="field"><span>Timezone</span><input value={profile.timezone||"America/Chicago"} onChange={e=>update("timezone",e.target.value)}/></label>
    </div>
    <button className="primary" type="submit">Save profile</button>{status&&<p className="notice">{status}</p>}
  </form>
}
