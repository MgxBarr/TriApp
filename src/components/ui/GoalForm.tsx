"use client";

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

export default function GoalForm({ onSuccess, onClose }: { onSuccess: () => void, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState({
    nom: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'Course à pied',
    format: '10km',
    priorite: 'A'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // On récupère l'user session pour être certain du user_id
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('goals')
        .insert([{
          ...goal,
          user_id: user?.id // On s'assure que l'ID est bien envoyé
        }]);

      if (error) {
        console.error("Erreur Supabase lors de l'insertion :", error.message);
        alert("Erreur : " + error.message); // Pour voir l'erreur direct sur l'écran
      } else {
        onSuccess(); 
        onClose();
      }
    } catch (err) {
      console.error("Erreur inattendue :", err);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white border border-slate-200 p-3 text-sm font-[900] italic outline-none focus:border-red-600 transition-all";
  const labelClass = "text-[10px] font-[900] text-slate-400 uppercase tracking-widest block mb-2 italic";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className={labelClass}>EVENT NAME</label>
        <input required type="text" value={goal.nom} onChange={e => setGoal({...goal, nom: e.target.value})} className={inputClass} placeholder="EX: IRONMAN NICE" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>DATE</label>
          <input required type="date" value={goal.date} onChange={e => setGoal({...goal, date: e.target.value})} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>PRIORITY</label>
          <select value={goal.priorite} onChange={e => setGoal({...goal, priorite: e.target.value})} className={inputClass}>
            <option value="A">OBJECTIF A (MAIN)</option>
            <option value="B">OBJECTIF B (PREP)</option>
            <option value="C">OBJECTIF C (FUN)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>TYPE</label>
          <select value={goal.type} onChange={e => setGoal({...goal, type: e.target.value, format: ''})} className={inputClass}>
            <option value="Course à pied">RUNNING</option>
            <option value="Vélo">CYCLING</option>
            <option value="Triathlon">TRIATHLON</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>FORMAT / DISTANCE</label>
          {goal.type === 'Triathlon' ? (
            <select value={goal.format} onChange={e => setGoal({...goal, format: e.target.value})} className={inputClass}>
              <option value="S">S (SPRINT)</option>
              <option value="M">M (OLYMPIQUE)</option>
              <option value="L">L (HALF)</option>
              <option value="XL">XL (FULL)</option>
            </select>
          ) : goal.type === 'Course à pied' ? (
            <select value={goal.format} onChange={e => setGoal({...goal, format: e.target.value})} className={inputClass}>
              <option value="5km">5 KM</option>
              <option value="10km">10 KM</option>
              <option value="Semi">SEMI-MARATHON</option>
              <option value="Marathon">MARATHON</option>
              <option value="Trail">TRAIL</option>
            </select>
          ) : (
            <input type="text" value={goal.format} onChange={e => setGoal({...goal, format: e.target.value})} className={inputClass} placeholder="EX: 120KM" />
          )}
        </div>
      </div>

      <div className="pt-6 flex justify-end gap-4">
        <button type="button" onClick={onClose} className="text-[11px] font-[900] text-slate-400 uppercase italic">CANCEL</button>
        <button type="submit" disabled={loading} className="bg-slate-950 text-white px-8 py-3 text-[11px] font-[900] uppercase italic hover:bg-red-600 transition-all shadow-lg active:scale-95">
          {loading ? 'STORING...' : 'CONFIRM GOAL'}
        </button>
      </div>
    </form>
  );
}