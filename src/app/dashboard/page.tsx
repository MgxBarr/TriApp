"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  format, subDays, eachDayOfInterval, isSameDay, 
  startOfWeek, endOfWeek, subWeeks, isWithinInterval, differenceInDays 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, ReferenceLine, 
  BarChart, Bar, Legend 
} from 'recharts';
import { ArrowLeft, Zap, TrendingUp, Activity, Flag, Settings } from 'lucide-react';
import Link from 'next/link';

// Import des composants UI
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import GoalForm from '@/components/ui/GoalForm';

interface WeeklyStats {
  name: string;
  Course: number;
  Vélo: number;
  Natation: number;
  Autre: number;
  [key: string]: string | number;
}

export default function DashboardPage() {
  // --- ÉTATS (HOOKS) ---
  const [data, setData] = useState<any[]>([]);
  const [volumeData, setVolumeData] = useState<WeeklyStats[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState(90);
  const [volumeUnit, setVolumeUnit] = useState<'duration' | 'distance'>('duration');
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  // --- RÉCUPÉRATION DES DONNÉES ---
  async function fetchData() {
    setLoading(true);
    const bufferDays = 42;
    const fetchStartDate = subDays(new Date(), daysRange + bufferDays);
    const displayStartDate = subDays(new Date(), daysRange);

    const { data: workouts } = await supabase
      .from('workouts')
      .select('*')
      .gte('date', fetchStartDate.toISOString().split('T')[0]);
    
    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .order('date', { ascending: true });

    if (!workouts) {
      setLoading(false);
      return;
    }
    
    setGoals(goalsData || []);

    // 1. CALCUL PMC (CTL, ATL, TSB)
    const allDays = eachDayOfInterval({ start: fetchStartDate, end: new Date() });
    let ctl = 0; 
    let atl = 0; 
    const pmcPoints: any[] = [];

    allDays.forEach((day) => {
      const dayWorkouts = workouts.filter(w => isSameDay(new Date(w.date), day));
      const dayTss = dayWorkouts.reduce((acc, w) => acc + (w.statut === 'Réalisé' ? (w.tss_reel || 0) : 0), 0);
      
      ctl = ctl + (dayTss - ctl) / 42;
      atl = atl + (dayTss - atl) / 7;
      const tsb = ctl - atl;
      
      if (day >= displayStartDate) {
        pmcPoints.push({ 
          date: format(day, 'dd MMM', { locale: fr }), 
          fitness: Math.round(ctl), 
          fatigue: Math.round(atl), 
          forme: Math.round(tsb),
          isGoal: goalsData?.some(g => isSameDay(new Date(g.date), day))
        });
      }
    });

    // 2. CALCUL VOLUME HEBDOMADAIRE
    const numWeeks = Math.ceil(daysRange / 7);
    const weeklyPoints: WeeklyStats[] = [];
    for (let i = numWeeks - 1; i >= 0; i--) {
      const targetDate = subWeeks(new Date(), i);
      const start = startOfWeek(targetDate, { weekStartsOn: 1 });
      const end = endOfWeek(targetDate, { weekStartsOn: 1 });
      
      const weekWorkouts = workouts.filter(w => isWithinInterval(new Date(w.date), { start, end }));
      const weekStats: WeeklyStats = { name: format(start, 'dd/MM'), Course: 0, Vélo: 0, Natation: 0, Autre: 0 };
      
      weekWorkouts.forEach(w => {
        const val = volumeUnit === 'duration' 
          ? (w.duree_minutes / 60) 
          : (w.sport_type === 'Natation' ? (w.distance_km * 1000) : (w.distance_km || 0));
        
        if (Object.keys(weekStats).includes(w.sport_type)) {
          weekStats[w.sport_type] = (weekStats[w.sport_type] as number) + val;
        } else {
          weekStats['Autre'] = (weekStats['Autre'] as number) + val;
        }
      });
      weeklyPoints.push(weekStats);
    }

    setData(pmcPoints);
    setVolumeData(weeklyPoints);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [daysRange, volumeUnit]);

  const nextGoal = goals.find(g => new Date(g.date) >= new Date() && g.priorite === 'A');
  const daysToGoal = nextGoal ? differenceInDays(new Date(nextGoal.date), new Date()) : null;
  const currentMetrics = data[data.length - 1] || { fitness: 0, fatigue: 0, forme: 0 };

  if (loading && data.length === 0) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-[900] italic text-slate-400 uppercase tracking-widest">Loading Stream...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* NAV & HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
          <div>
            <Link href="/" className="group flex items-center gap-2 text-slate-400 hover:text-red-600 mb-4 text-[10px] font-[900] uppercase tracking-widest italic transition-colors">
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> BACK TO CALENDAR
            </Link>
            <h1 className="text-6xl font-[900] uppercase tracking-tighter italic text-slate-950 leading-none">PERFORMANCE</h1>
            <div className="h-2 w-24 bg-red-600 mt-4"></div>
          </div>
          <div className="flex bg-white p-1 border border-slate-200 shadow-sm">
            {[30, 90, 180].map(r => (
              <button key={r} onClick={() => setDaysRange(r)} className={`px-6 py-2 text-[10px] font-[900] uppercase tracking-widest transition-all ${daysRange === r ? 'bg-slate-950 text-white italic' : 'text-slate-400 hover:text-slate-950'}`}>{r}D</button>
            ))}
          </div>
        </div>

        {/* RACE COUNTDOWN WIDGET */}
        {nextGoal ? (
          <div className="mb-8 bg-slate-950 text-white p-8 flex items-center justify-between shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
              <span className="text-[10px] font-[900] text-red-600 uppercase tracking-[0.4em] italic block mb-2">NEXT MAJOR OBJECTIVE</span>
              <div className="flex items-center gap-4">
                <h2 className="text-4xl font-[900] uppercase italic tracking-tighter">{nextGoal.nom}</h2>
                <button 
                  onClick={() => setIsGoalModalOpen(true)}
                  className="p-2 hover:bg-white/10 text-slate-500 hover:text-white transition-all"
                >
                  <Settings size={16} />
                </button>
              </div>
              <p className="text-slate-400 text-xs font-bold mt-1 uppercase italic">
                {nextGoal.type} {nextGoal.format ? `• ${nextGoal.format}` : ''} • {format(new Date(nextGoal.date), 'dd MMMM yyyy', { locale: fr })}
              </p>
            </div>
            <div className="text-right relative z-10">
              <span className="text-6xl font-[900] italic tracking-tighter text-white">T-{daysToGoal}</span>
              <span className="block text-[10px] font-[900] text-slate-500 uppercase tracking-widest italic">DAYS REMAINING</span>
            </div>
            <Flag className="absolute -right-10 -bottom-10 text-white opacity-5 w-64 h-64 rotate-12" />
          </div>
        ) : (
          <button 
            onClick={() => setIsGoalModalOpen(true)}
            className="mb-8 w-full border-2 border-dashed border-slate-200 p-8 text-slate-400 font-[900] uppercase italic hover:border-red-600 hover:text-red-600 transition-all"
          >
            + ADD YOUR NEXT SEASON GOAL
          </button>
        )}

        {/* WIDGETS CTL/ATL/TSB */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'CONDITION (CTL)', val: currentMetrics.fitness, color: 'text-slate-950', icon: <TrendingUp size={20}/>, bgIcon: <TrendingUp size={160}/> },
            { label: 'FATIGUE (ATL)', val: currentMetrics.fatigue, color: 'text-red-600', icon: <Zap size={20}/>, bgIcon: <Zap size={160}/> },
            { label: 'BALANCE (TSB)', val: currentMetrics.forme, color: 'text-slate-950', icon: <Activity size={20}/>, bgIcon: <Activity size={160}/> }
          ].map(m => (
            <div key={m.label} className="bg-white border border-slate-200 p-10 shadow-sm relative overflow-hidden group transition-all duration-300 hover:border-slate-300">
              <div className="flex justify-between items-start mb-2 relative z-10">
                <span className={`text-[11px] font-[900] uppercase tracking-[0.3em] ${m.color} italic transition-colors group-hover:text-red-600`}>{m.label}</span>
                <div className={`${m.color} transition-colors group-hover:text-red-600`}>{m.icon}</div>
              </div>
              <div className="text-7xl font-[900] text-slate-950 italic tracking-tighter mt-4 relative z-10">
                {m.val > 0 && m.label.includes('BALANCE') ? `+${m.val}` : m.val}
              </div>
              <div className={`absolute -right-8 -bottom-10 transition-all duration-500 ease-out transform group-hover:scale-110 group-hover:rotate-6
                ${m.label.includes('FATIGUE') ? 'text-red-600 opacity-[0.08] group-hover:opacity-[0.18]' : 'text-slate-300 opacity-[0.06] group-hover:opacity-[0.15] group-hover:text-red-600'}
              `}>
                {m.bgIcon}
              </div>
            </div>
          ))}
        </div>

        {/* PMC CHART */}
        <div className="bg-white border border-slate-200 p-10 h-[580px] shadow-xl relative overflow-hidden mb-8">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-[11px] font-[900] text-slate-300 uppercase tracking-[0.5em] italic">PMC DATA STREAM</h2>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" stroke="#cbd5e1" fontSize={10} fontStyle="italic" fontWeight="900" dy={10} />
              <YAxis stroke="#cbd5e1" fontSize={10} fontStyle="italic" fontWeight="900" dx={-10} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '900' }} />
              <ReferenceLine y={-30} stroke="#dc2626" strokeDasharray="5 5" opacity={0.5} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
              {data.filter(d => d.isGoal).map((g, i) => (
                <ReferenceLine key={i} x={g.date} stroke="#dc2626" strokeWidth={2} label={{ value: 'RACE', position: 'top', fill: '#dc2626', fontSize: 10, fontWeight: 900 }} />
              ))}
              <Area type="monotone" dataKey="forme" stroke="#000" fill="transparent" strokeWidth={2} name="TSB" />
              <Line type="monotone" dataKey="fatigue" stroke="#dc2626" strokeWidth={2} dot={false} name="ATL" />
              <Area type="monotone" dataKey="fitness" stroke="#dc2626" fill="#dc2626" fillOpacity={0.05} strokeWidth={4} dot={false} name="CTL" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* VOLUME CHART */}
        <div className="bg-white border border-slate-200 p-10 h-[500px] shadow-xl relative overflow-hidden mb-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
            <h2 className="text-[11px] font-[900] text-slate-300 uppercase tracking-[0.5em] italic">VOLUME DISTRIBUTION</h2>
            <div className="flex bg-slate-100 p-1 border border-slate-200">
              <button onClick={() => setVolumeUnit('duration')} className={`px-4 py-1.5 text-[9px] font-[900] uppercase italic transition-all ${volumeUnit === 'duration' ? 'bg-slate-950 text-white' : 'text-slate-400'}`}>Time (H)</button>
              <button onClick={() => setVolumeUnit('distance')} className={`px-4 py-1.5 text-[9px] font-[900] uppercase italic transition-all ${volumeUnit === 'distance' ? 'bg-slate-950 text-white' : 'text-slate-400'}`}>Distance (Km/m)</button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} fontStyle="italic" fontWeight="900" dy={10} />
              <YAxis stroke="#cbd5e1" fontSize={10} fontStyle="italic" fontWeight="900" dx={-10} />
              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: '900' }} />
              <Legend verticalAlign="top" align="right" iconType="rect" wrapperStyle={{ paddingBottom: '20px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase' }} />
              <Bar dataKey="Course" stackId="a" fill="#dc2626" />
              <Bar dataKey="Vélo" stackId="a" fill="#020617" />
              <Bar dataKey="Natation" stackId="a" fill="#94a3b8" />
              <Bar dataKey="Autre" stackId="a" fill="#e2e8f0" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* MODAL POUR AJOUTER/MODIFIER UN OBJECTIF */}
        <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
          <DialogContent className="sm:max-w-[500px] bg-white border-none text-slate-900 shadow-2xl p-0 rounded-none overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50">
              <DialogTitle className="text-3xl font-[900] uppercase tracking-tighter italic text-slate-950">
                SEASON GOAL
              </DialogTitle>
              <div className="h-1.5 w-12 bg-red-600 mt-2"></div>
            </div>
            <div className="p-8">
              <GoalForm 
                onClose={() => setIsGoalModalOpen(false)} 
                onSuccess={() => {
                  fetchData(); // Rafraîchit les données sans recharger la page
                  setIsGoalModalOpen(false);
                }} 
              />
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}