"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Plus, X, Repeat } from 'lucide-react';
import { format } from 'date-fns';

interface Step {
  id: string;
  type: 'Warmup' | 'Work' | 'Rest' | 'Cooldown';
  duration: number;
  distance: number; 
  target_val: string;
  isRepeat?: boolean;
  repeatCount?: number;
  repeatSteps?: Step[];
}

interface WorkoutFormProps {
  initialDate: Date;
  existingWorkout: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WorkoutForm({ initialDate, existingWorkout, onClose, onSuccess }: WorkoutFormProps) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const [formData, setFormData] = useState({
    titre: '',
    sport_type: 'Course',
    statut: 'Planifié',
    time_str: '00:00:00',
    distance_val: '',
    rpe: '5',
    tss_prevu: '0',
    tss_reel: '0'
  });

  useEffect(() => {
    async function fetchProfile() {
      const { data } = await supabase.from('profiles').select('*').limit(1).single();
      if (data) setProfile(data);
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    if (existingWorkout) {
      const mins = existingWorkout.duree_minutes || 0;
      setFormData({
        titre: existingWorkout.titre || '',
        sport_type: existingWorkout.sport_type || 'Course',
        statut: existingWorkout.statut || 'Planifié',
        time_str: `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}:00`,
        distance_val: (existingWorkout.sport_type === 'Natation' ? (existingWorkout.distance_km * 1000) : existingWorkout.distance_km)?.toString() || '',
        rpe: existingWorkout.rpe?.toString() || '5',
        tss_prevu: existingWorkout.tss_prevu?.toString() || '0',
        tss_reel: existingWorkout.tss_reel?.toString() || '0'
      });
      if (existingWorkout.structure) setSteps(existingWorkout.structure);
    }
  }, [existingWorkout]);

  // --- MOTEUR DE CALCUL GLOBAL ---
  useEffect(() => {
    if (!profile) return;

    let totalTss = 0;
    let totalMins = 0;
    let totalDist = 0;

    const paceToSec = (str: string) => {
      if (!str || str === "00:00" || str === "--:--") return 0;
      const p = str.split(':');
      return p.length === 2 ? parseInt(p[0]) * 60 + parseInt(p[1]) : 0;
    };

    // LOGIQUE : PRIORITÉ AU BUILDER SI DES ÉTAPES EXISTENT
    if (steps.length > 0) {
      const processStep = (s: Step, multiplier = 1) => {
        let stepMins = s.duration || 0;
        let stepDist = s.distance || 0;
        let IF = 0.5; 
        const pace = paceToSec(s.target_val);

        if (formData.sport_type === 'Course' && profile.allure_seuil_course_sec) {
          if (pace > 0) {
            IF = profile.allure_seuil_course_sec / pace;
            if (stepMins > 0 && stepDist === 0) stepDist = (stepMins * 60) / pace;
            else if (stepDist > 0 && stepMins === 0) stepMins = (stepDist * pace) / 60;
          }
        } else if (formData.sport_type === 'Vélo' && profile.ftp_velo) {
          const watts = parseFloat(s.target_val);
          if (watts > 0) IF = watts / profile.ftp_velo;
        } else if (formData.sport_type === 'Natation' && profile.css_natation_sec) {
          if (pace > 0) {
            IF = profile.css_natation_sec / pace;
            if (stepDist > 0) stepMins = (stepDist / 100) * pace / 60;
          }
        }
        const power = formData.sport_type === 'Natation' ? 3 : 2;
        totalTss += (stepMins / 60) * Math.pow(IF, power) * 100 * multiplier;
        totalMins += stepMins * multiplier;
        totalDist += stepDist * multiplier;
      };

      steps.forEach(s => {
        if (s.isRepeat && s.repeatSteps) {
          s.repeatSteps.forEach(rs => processStep(rs, s.repeatCount || 1));
        } else {
          processStep(s);
        }
      });

      // Synchronisation du temps et de la distance vers les champs principaux
      setFormData(prev => ({
        ...prev,
        time_str: `${Math.floor(totalMins / 60).toString().padStart(2, '0')}:${Math.floor(totalMins % 60).toString().padStart(2, '0')}:00`,
        distance_val: totalDist > 0 ? (formData.sport_type === 'Natation' ? Math.round(totalDist) : totalDist.toFixed(2)).toString() : prev.distance_val,
        [prev.statut === 'Planifié' ? 'tss_prevu' : 'tss_reel']: Math.round(totalTss).toString()
      }));

    } else {
      // MODE QUICK ENTRY : PAS D'ÉTAPES DANS LE BUILDER
      const parts = formData.time_str.split(':').map(v => parseInt(v) || 0);
      const qMins = (parts[0] * 60) + (parts[1] || 0);
      const qDist = parseFloat(formData.distance_val.toString().replace(',', '.')) || 0;

      if (qMins > 0) {
        let IF = 0.70;
        if (formData.sport_type === 'Course' && qDist > 0 && profile.allure_seuil_course_sec) {
          const paceSec = (qMins * 60) / qDist;
          IF = profile.allure_seuil_course_sec / paceSec;
        } else {
          const rpeMap: { [key: string]: number } = {
            '1': 0.35, '2': 0.45, '3': 0.55, '4': 0.65, '5': 0.75,
            '6': 0.82, '7': 0.88, '8': 0.95, '9': 1.05, '10': 1.15
          };
          IF = rpeMap[formData.rpe] || 0.70;
        }
        const power = formData.sport_type === 'Natation' ? 3 : 2;
        const qTss = (qMins / 60) * Math.pow(IF, power) * 100;

        setFormData(prev => ({
          ...prev,
          [prev.statut === 'Planifié' ? 'tss_prevu' : 'tss_reel']: Math.round(qTss).toString()
        }));
      }
    }
  }, [steps, formData.time_str, formData.distance_val, formData.rpe, formData.sport_type, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titre) { alert("Veuillez donner un titre à la séance"); return; }
    setLoading(true);

    const parts = formData.time_str.split(':').map(v => parseInt(v) || 0);
    const mins = (parts[0] * 60) + (parts[1] || 0);
    const rawDist = formData.distance_val.toString().replace(',', '.');
    const distKm = formData.sport_type === 'Natation' ? (parseFloat(rawDist) || 0) / 1000 : (parseFloat(rawDist) || 0);
    
    const payload: any = {
      date: existingWorkout?.date || format(initialDate, 'yyyy-MM-dd'),
      titre: formData.titre,
      sport_type: formData.sport_type,
      statut: formData.statut,
      duree_minutes: Math.max(0, mins),
      distance_km: Math.max(0, distKm),
      rpe: parseInt(formData.rpe) || 5,
      tss_prevu: parseInt(formData.tss_prevu) || 0,
      tss_reel: parseInt(formData.tss_reel) || 0,
      structure: steps || []
    };

    if (profile?.id) payload.user_id = profile.id;

    const { error } = await (existingWorkout 
      ? supabase.from('workouts').update(payload).eq('id', existingWorkout.id) 
      : supabase.from('workouts').insert([payload]));

    if (error) { alert(`Erreur : ${error.message}`); setLoading(false); }
    else { setLoading(false); onSuccess(); onClose(); }
  };

  const addStep = (type: 'Warmup' | 'Work' | 'Rest' | 'Cooldown') => {
    const defTarget = formData.sport_type === 'Vélo' ? '200' : (formData.sport_type === 'Natation' ? '01:45' : '04:30');
    setSteps([...steps, { id: Math.random().toString(36).substr(2, 9), type, duration: 10, distance: 0, target_val: defTarget }]);
    setShowBuilder(true);
  };

  const addRepeat = () => {
    const pace = formData.sport_type === 'Vélo' ? '200' : (formData.sport_type === 'Natation' ? '01:45' : '04:30');
    setSteps([...steps, {
      id: Math.random().toString(36).substr(2, 9), type: 'Work', duration: 0, distance: 0, target_val: '', isRepeat: true, repeatCount: 5,
      repeatSteps: [
        { id: Math.random().toString(36).substr(2, 9), type: 'Work', duration: 1, distance: 0, target_val: pace },
        { id: Math.random().toString(36).substr(2, 9), type: 'Rest', duration: 1, distance: 0, target_val: '06:00' }
      ]
    }]);
    setShowBuilder(true);
  };

  const updateStepField = (id: string, field: keyof Step, val: any) => setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  const updateRepeatStepField = (parentId: string, stepId: string, field: keyof Step, val: any) => 
    setSteps(prev => prev.map(s => s.id === parentId && s.repeatSteps ? { ...s, repeatSteps: s.repeatSteps.map(rs => rs.id === stepId ? { ...rs, [field]: val } : rs) } : s));

  const inputClass = "w-full bg-white border border-slate-200 rounded-none p-3 text-sm text-slate-950 font-[900] outline-none focus:border-red-600 transition-all";
  const labelClass = "text-[10px] font-[900] text-slate-400 uppercase tracking-widest block mb-2 italic";

  const renderStepRow = (s: Step, isInsideRepeat = false, parentId = "") => (
    <div className="grid grid-cols-4 gap-2 flex-1 items-end">
      <div>
        <label className="text-[7px] font-black text-slate-400 uppercase italic">TYPE</label>
        <select value={s.type} onChange={e => isInsideRepeat ? updateRepeatStepField(parentId, s.id, 'type', e.target.value) : updateStepField(s.id, 'type', e.target.value)} className="text-[10px] font-black uppercase italic w-full">
          <option value="Warmup">Warmup</option><option value="Work">Work</option><option value="Rest">Rest</option><option value="Cooldown">Cool</option>
        </select>
      </div>
      <div>
        <label className="text-[7px] font-black text-slate-400 uppercase italic">MINS</label>
        <input type="number" value={s.duration || ''} onChange={e => {
            const val = parseFloat(e.target.value) || 0;
            if (isInsideRepeat) { updateRepeatStepField(parentId, s.id, 'duration', val); updateRepeatStepField(parentId, s.id, 'distance', 0); }
            else { updateStepField(s.id, 'duration', val); updateStepField(s.id, 'distance', 0); }
          }} className="font-[900] italic text-xs w-full outline-none" />
      </div>
      <div>
        <label className="text-[7px] font-black text-slate-400 uppercase italic">DIST</label>
        <input type="number" step="0.1" value={s.distance || ''} onChange={e => {
            const val = parseFloat(e.target.value) || 0;
            if (isInsideRepeat) { updateRepeatStepField(parentId, s.id, 'distance', val); updateRepeatStepField(parentId, s.id, 'duration', 0); }
            else { updateStepField(s.id, 'distance', val); updateStepField(s.id, 'duration', 0); }
          }} className="font-[900] italic text-xs w-full outline-none" />
      </div>
      <div>
        <label className="text-[7px] font-black text-red-600 uppercase italic">PACE/W</label>
        <input type="text" value={s.target_val || ''} onChange={e => isInsideRepeat ? updateRepeatStepField(parentId, s.id, 'target_val', e.target.value) : updateStepField(s.id, 'target_val', e.target.value)} className="font-[900] italic text-xs w-full text-red-600 placeholder:opacity-30 outline-none" placeholder="--:--" />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      {existingWorkout && (
        <button type="button" onClick={async () => { if(window.confirm("DELETE?")) { await supabase.from('workouts').delete().eq('id', existingWorkout.id); onSuccess(); onClose(); } }} className="absolute -top-[105px] right-0 p-2 text-slate-300 hover:text-red-600 transition-colors">
          <Trash2 size={20} />
        </button>
      )}

      <div className="flex border-b border-slate-100 mb-4 -mt-4">
        <button type="button" onClick={() => setShowBuilder(false)} className={`px-6 py-3 text-[10px] font-[900] uppercase italic tracking-widest transition-all ${!showBuilder ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-400'}`}>Quick Entry</button>
        {formData.sport_type !== 'Autre' && (
          <button type="button" onClick={() => setShowBuilder(true)} className={`px-6 py-3 text-[10px] font-[900] uppercase italic tracking-widest transition-all ${showBuilder ? 'text-red-600 border-b-2 border-red-600' : 'text-slate-400'}`}>Workout Builder</button>
        )}
      </div>

      <div className="min-h-[450px] flex flex-col justify-between">
        <div className="space-y-6">
          {!showBuilder ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <label className={labelClass}>SESSION TITLE</label>
                <input required type="text" value={formData.titre} onChange={e => setFormData({...formData, titre: e.target.value})} className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>DISCIPLINE</label>
                  <select value={formData.sport_type} onChange={e => setFormData({...formData, sport_type: e.target.value})} className={inputClass}>
                    <option value="Course">RUNNING</option>
                    <option value="Vélo">CYCLING</option>
                    <option value="Natation">SWIMMING</option>
                    <option value="Autre">STRENGTH</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>STATUS</label>
                  <select value={formData.statut} onChange={e => setFormData({...formData, statut: e.target.value})} className={inputClass}>
                    <option value="Planifié">PLANNED</option>
                    <option value="Réalisé">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 border border-slate-100">
                <div>
                  <label className={labelClass}>TIME</label>
                  <input type="text" value={formData.time_str} onChange={e => setFormData({...formData, time_str: e.target.value})} className={inputClass} placeholder="00:00:00" />
                </div>
                <div>
                  <label className={labelClass}>{formData.sport_type === 'Natation' ? 'METERS' : 'KM'}</label>
                  <input type="text" value={formData.distance_val} onChange={e => setFormData({...formData, distance_val: e.target.value})} className={inputClass} placeholder="0" />
                </div>
                <div>
                  <label className={labelClass}>RPE (1-10)</label>
                  <input type="number" value={formData.rpe} onChange={e => setFormData({...formData, rpe: e.target.value})} className={inputClass} />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right duration-200">
              <div className="max-h-[350px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {steps.map((step) => (
                  <div key={step.id} className={`bg-white border p-4 shadow-sm relative ${step.isRepeat ? 'border-slate-950 border-2' : 'border-slate-200'}`}>
                    {step.isRepeat ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2 text-[10px] font-black italic uppercase tracking-widest">
                            <Repeat size={14} className="text-red-600" />
                            REPEAT <input type="number" value={step.repeatCount} onChange={e => updateStepField(step.id, 'repeatCount', parseInt(e.target.value) || 1)} className="w-10 border-b border-slate-950 text-center outline-none bg-transparent font-black" /> TIMES
                          </div>
                          <button type="button" onClick={() => setSteps(steps.filter(s => s.id !== step.id))} className="text-slate-300 hover:text-red-600"><X size={16}/></button>
                        </div>
                        <div className="space-y-3 pl-4 border-l-2 border-red-600">
                          {step.repeatSteps?.map(rs => (
                            <div key={rs.id} className="flex items-center gap-3">
                              {renderStepRow(rs, true, step.id)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <div className={`w-1.5 h-12 flex-shrink-0 ${step.type === 'Work' ? 'bg-red-600' : 'bg-slate-200'}`} />
                        {renderStepRow(step)}
                        <button type="button" onClick={() => setSteps(steps.filter(s => s.id !== step.id))} className="text-slate-300 hover:text-red-600"><X size={16}/></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => addStep('Work')} className="py-3 border-2 border-slate-200 text-slate-950 text-[10px] font-black uppercase italic hover:border-red-600 hover:text-red-600 transition-all flex items-center justify-center gap-2">
                  <Plus size={14} /> ADD STEP
                </button>
                <button type="button" onClick={addRepeat} className="py-3 border-2 border-slate-200 text-slate-950 text-[10px] font-black uppercase italic hover:border-red-600 hover:text-red-600 transition-all flex items-center justify-center gap-2">
                  <Repeat size={14} /> ADD REPEAT
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-slate-100 flex items-center justify-between mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-[900] text-red-600 uppercase tracking-widest italic mb-1">TOTAL LOAD</span>
            <span className="text-4xl font-[900] italic text-slate-950">{formData.statut === 'Planifié' ? formData.tss_prevu : formData.tss_reel} <span className="text-sm opacity-30">TSS</span></span>
          </div>
          <div className="flex gap-4 items-center">
            <button type="button" onClick={onClose} className="text-[11px] font-[900] text-slate-400 uppercase tracking-widest">CANCEL</button>
            <button type="submit" disabled={loading} className="px-10 py-3 bg-slate-950 text-white text-[11px] font-[900] uppercase tracking-widest hover:bg-red-600 transition-all italic shadow-xl">
              {loading ? '...' : 'SAVE'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}