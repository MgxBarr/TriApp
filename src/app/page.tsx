"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  startOfWeek, 
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  Bike, Waves, Footprints, Dumbbell, 
  ChevronLeft, ChevronRight, Plus, 
  BarChart3, Flag, Target
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../components/ui/dialog";
import WorkoutForm from '../components/ui/WorkoutForm';
import Link from 'next/link';

interface Workout {
  id: string;
  date: string;
  titre: string;
  sport_type: 'Natation' | 'Vélo' | 'Course' | 'Autre';
  statut: 'Planifié' | 'Réalisé';
  tss_prevu: number;
  tss_reel: number;
  duree_minutes?: number;
  distance_km?: number;
}

interface Goal {
  id: string;
  date: string;
  nom: string;
  type: string;
  format: string;
  priorite: 'A' | 'B' | 'C';
}

// ==========================================
// CONFIGURATION DE LA PALETTE "RACING PASTEL"
// ==========================================
const sportStyles = {
  Natation: {
    bg: 'bg-sky-50',           // Bleu très léger
    border: 'border-sky-100',
    accent: 'bg-sky-400',       // Bleu ciel
    icon: <Waves className="w-full h-full text-sky-500" />
  },
  Vélo: {
    bg: 'bg-pink-50',          // Rose Giro très léger
    border: 'border-pink-100',
    accent: 'bg-pink-400',      // Rose
    icon: <Bike className="w-full h-full text-pink-500" />
  },
  Course: {
    bg: 'bg-amber-50',         // Orange/Ambre très léger
    border: 'border-amber-100',
    accent: 'bg-amber-500',     // Orange
    icon: <Footprints className="w-full h-full text-amber-500" />
  },
  Autre: {
    bg: 'bg-emerald-50',       // Vert Muscu très léger
    border: 'border-emerald-100',
    accent: 'bg-emerald-500',   // Vert
    icon: <Dumbbell className="w-full h-full text-emerald-500" />
  }
};

const sportIconsDefault = {
  Natation: <Waves className="w-full h-full" />,
  Vélo: <Bike className="w-full h-full" />,
  Course: <Footprints className="w-full h-full" />,
  Autre: <Dumbbell className="w-full h-full" />,
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);

  useEffect(() => { 
    fetchWorkouts(); 
    fetchGoals(); 
  }, []);

  async function fetchWorkouts() {
    const { data, error } = await supabase.from('workouts').select('*').order('date', { ascending: true });
    if (error) console.error(error);
    else setWorkouts(data || []);
  }

  async function fetchGoals() {
    const { data, error } = await supabase.from('goals').select('*').order('date', { ascending: true });
    if (error) console.error(error);
    else setGoals(data || []);
  }

  const handlePrev = () => setCurrentDate(prev => viewMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1));
  const handleNext = () => setCurrentDate(prev => viewMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1));

  const start = viewMode === 'month' 
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
    : startOfWeek(currentDate, { weekStartsOn: 1 });

  const end = viewMode === 'month'
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
    : endOfWeek(currentDate, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({ start, end });

  const handleDragStart = (e: React.DragEvent, workoutId: string) => {
    e.dataTransfer.setData("workoutId", workoutId);
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const workoutId = e.dataTransfer.getData("workoutId");
    if (!workoutId) return;
    const newDateStr = format(targetDate, 'yyyy-MM-dd');
    setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, date: newDateStr } : w));
    await supabase.from('workouts').update({ date: newDateStr }).eq('id', workoutId);
  };

  const currentWeekWorkouts = workouts.filter(w => calendarDays.some(day => isSameDay(new Date(w.date), day)));
  
  const weekStats = currentWeekWorkouts.reduce((acc, w) => {
    const tss = w.statut === 'Réalisé' ? w.tss_reel : w.tss_prevu;
    acc.totalDuration += (w.duree_minutes || 0);
    acc.totalTss += tss;
    if (acc.bySport[w.sport_type]) {
        acc.bySport[w.sport_type].duree += (w.duree_minutes || 0);
        acc.bySport[w.sport_type].distance += (w.distance_km || 0);
    }
    return acc;
  }, { 
    totalDuration: 0, 
    totalTss: 0, 
    bySport: {
        Natation: { duree: 0, distance: 0 },
        Vélo: { duree: 0, distance: 0 },
        Course: { duree: 0, distance: 0 },
        Autre: { duree: 0, distance: 0 }
    }
  });

  const formatDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}H${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h1 className="text-5xl font-[900] uppercase tracking-tighter italic text-slate-950 leading-none">
            {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: fr }) : `WEEK ${format(currentDate, 'w')}`}
          </h1>
          <div className="h-1.5 w-16 bg-red-600 mt-2"></div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Link href="/dashboard" className="flex items-center gap-2 px-6 py-2.5 bg-slate-950 hover:bg-red-600 text-white text-[11px] font-[900] rounded-none uppercase tracking-widest transition-all italic active:scale-95 shadow-xl">
            <BarChart3 size={16} strokeWidth={3}/> PERFORMANCE
          </Link>

          <div className="flex bg-white p-1 border border-slate-200 shadow-sm">
            <button onClick={() => setViewMode('month')} className={`px-5 py-1.5 text-[10px] font-[900] transition-all uppercase tracking-widest ${viewMode === 'month' ? 'bg-slate-950 text-white italic' : 'text-slate-400 hover:text-slate-600'}`}>MONTH</button>
            <button onClick={() => setViewMode('week')} className={`px-5 py-1.5 text-[10px] font-[900] transition-all uppercase tracking-widest ${viewMode === 'week' ? 'bg-slate-950 text-white italic' : 'text-slate-400 hover:text-slate-600'}`}>WEEK</button>
          </div>

          <div className="flex gap-1 bg-white p-1 border border-slate-200">
            <button onClick={handlePrev} className="p-1.5 hover:bg-slate-100 text-slate-900 transition-colors"><ChevronLeft size={20}/></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 text-[9px] font-[900] text-slate-400 hover:text-red-600 uppercase italic">NOW</button>
            <button onClick={handleNext} className="p-1.5 hover:bg-slate-100 text-slate-900 transition-colors"><ChevronRight size={20}/></button>
          </div>
        </div>
      </div>

      {/* WIDGET SEMAINE */}
      {viewMode === 'week' && (
        <div className="max-w-7xl mx-auto mb-10 bg-white border border-slate-200 p-8 flex flex-wrap items-center justify-between shadow-sm gap-8">
          <div className="flex items-center gap-16">
            <div className="flex flex-col">
              <span className="text-[10px] font-[900] text-slate-400 uppercase tracking-[0.3em] mb-2 italic">VOLUME</span>
              <span className="text-5xl font-[900] text-slate-950 italic tracking-tighter">{formatDuration(weekStats.totalDuration)}</span>
            </div>
            <div className="flex flex-col border-l border-slate-100 pl-16">
              <span className="text-[10px] font-[900] text-red-600 uppercase tracking-[0.3em] mb-2 italic">LOAD (TSS)</span>
              <div className="flex items-center gap-3">
                <Target size={24} className="text-red-600" />
                <span className="text-5xl font-[900] text-slate-950 italic tracking-tighter">{weekStats.totalTss}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {(Object.keys(weekStats.bySport) as Array<keyof typeof weekStats.bySport>).map(sport => {
              const s = weekStats.bySport[sport];
              if (s.duree === 0) return null;
              return (
                <div key={sport} className="flex items-center gap-3 bg-slate-50 px-5 py-3 border border-slate-100">
                  <div className="w-5 h-5 text-red-600">{sportIconsDefault[sport]}</div>
                  <div className="flex flex-col leading-none">
                    <span className="text-[12px] font-[900] italic uppercase">{formatDuration(s.duree)}</span>
                    {s.distance > 0 && (
                      <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                        {sport === 'Natation' ? `${s.distance.toFixed(0)}M` : `${s.distance.toFixed(1)}KM`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CALENDRIER */}
      <div className="max-w-7xl mx-auto bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
            <div key={d} className="p-4 text-center text-[11px] font-[900] text-slate-400 uppercase tracking-[0.4em] italic">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayWorkouts = workouts.filter(w => isSameDay(new Date(w.date), day));
            const dayGoals = goals.filter(g => isSameDay(new Date(g.date), day));
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = format(day, 'M') === format(currentDate, 'M');

            return (
              <div 
                key={idx} 
                onClick={() => { setSelectedDate(day); setEditingWorkout(null); setIsModalOpen(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, day)}
                className={`p-3 border-r border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50 group relative
                  ${isToday ? 'bg-red-50/50' : ''}
                  ${!isCurrentMonth && viewMode === 'month' ? 'opacity-20' : ''}
                  ${viewMode === 'week' ? 'min-h-[600px]' : 'min-h-[160px]'}`}
              >
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className={`text-sm font-[900] italic ${isToday ? 'text-red-600' : 'text-slate-300 group-hover:text-slate-900'}`}>{format(day, 'd')}</span>
                  <Plus size={16} className="text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <div className="space-y-3">
                  {/* AFFICHAGE DES GOALS (STYLE BLOC WORKOUT - RESTE EN ROUGE VIF) */}
                  {dayGoals.map(g => (
                    <div 
                      key={g.id}
                      className="bg-red-600 border border-red-700 p-3 shadow-md flex flex-col gap-2 relative overflow-hidden group/goal active:scale-95 transition-all"
                    >
                      <div className="flex justify-between items-start relative z-10">
                        <Flag size={14} className="text-white" fill="white" />
                        <span className="bg-white text-red-600 font-[900] text-[8px] italic px-1.5 py-0.5 uppercase">
                           OBJECTIVE {g.priorite}
                        </span>
                      </div>
                      <div className="font-[900] uppercase tracking-tight italic leading-tight text-[10px] text-white relative z-10">
                        {g.nom}
                      </div>
                      <div className="text-[8px] font-bold text-red-100 uppercase italic relative z-10">
                        {g.type} • {g.format}
                      </div>
                      <Flag size={40} className="absolute -right-4 -bottom-2 text-white opacity-10 rotate-12" />
                    </div>
                  ))}

                  {/* AFFICHAGE DES WORKOUTS CLASSIQUES (STYLE COULEUR PAR SPORT) */}
                  {dayWorkouts.map(w => {
                    const style = sportStyles[w.sport_type] || sportStyles.Autre;
                    const isRealised = w.statut === 'Réalisé';

                    return (
                      <div 
                        key={w.id} 
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, w.id)}
                        onClick={(e) => { e.stopPropagation(); setEditingWorkout(w); setSelectedDate(new Date(w.date)); setIsModalOpen(true); }}
                        className={`transition-all active:scale-95 border-l-[6px] rounded-none flex flex-col p-3 gap-2 shadow-sm relative
                          ${isRealised 
                            ? 'bg-slate-950 border-slate-950 text-white' 
                            : `${style.bg} ${style.border} ${style.accent.replace('bg-', 'border-l-')} text-slate-600`
                          }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className={`w-4 h-4 ${isRealised ? 'text-white' : ''}`}>
                            {isRealised ? sportIconsDefault[w.sport_type] : style.icon}
                          </div>
                          <span className={`font-[900] text-[9px] italic px-1.5 py-0.5 rounded-none uppercase 
                            ${isRealised 
                              ? 'bg-red-600 text-white' 
                              : 'bg-white border border-slate-200 text-slate-900'
                            }`}>
                            {isRealised ? w.tss_reel : w.tss_prevu} TSS
                          </span>
                        </div>
                        <div className={`font-[900] uppercase tracking-tight italic leading-none text-[10px] ${isRealised ? 'text-white' : 'text-slate-950'}`}>
                          {w.titre}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border-none text-slate-900 shadow-2xl p-0 rounded-none">
          <div className="p-8 border-b border-slate-100 bg-slate-50">
            <DialogTitle className="text-3xl font-[900] uppercase tracking-tighter italic text-slate-950">
              {editingWorkout ? 'EDIT ENTRY' : 'NEW SESSION'}
            </DialogTitle>
            <div className="h-1.5 w-12 bg-red-600 mt-2"></div>
          </div>
          <div className="p-8">
             {selectedDate && <WorkoutForm initialDate={selectedDate} existingWorkout={editingWorkout} onClose={() => setIsModalOpen(false)} onSuccess={fetchWorkouts} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}