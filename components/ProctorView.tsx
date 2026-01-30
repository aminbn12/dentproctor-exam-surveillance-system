
import React, { useState, useMemo, useEffect } from 'react';
import { UserSession, Exam, Assignment, Room, Professor, Resident } from '../types';
import { ICONS, PROMO_COLORS } from '../constants';

interface ProctorViewProps {
  user: UserSession;
  exams: Exam[];
  assignments: Assignment[];
  rooms: Room[];
  profs: Professor[];
  residents: Resident[];
}

const ProctorView: React.FC<ProctorViewProps> = ({ user, exams, assignments, rooms, profs, residents }) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 1. Calculer les examens affectés à cet utilisateur
  const myExams = useMemo(() => {
    const userAssignments = assignments.filter(a => 
      user.type === 'prof' ? a.profIds.includes(user.id) : a.residentIds.includes(user.id)
    );

    return userAssignments.map(a => {
      const exam = exams.find(e => e.id === a.examId);
      const room = rooms.find(r => r.id === a.roomId);
      if (!exam) return null;
      return { ...exam, room, assignment: a };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  }, [assignments, exams, rooms, user]);

  // 2. Sauter au mois du premier examen lors du premier chargement
  useEffect(() => {
    if (myExams.length > 0) {
      const firstExamDate = new Date(myExams[0].date);
      // On ne change le mois que si on est sur le mois par défaut (aujourd'hui)
      // et que le premier examen est différent
      const today = new Date();
      if (today.getMonth() === currentMonth.getMonth() && today.getFullYear() === currentMonth.getFullYear()) {
         setCurrentMonth(new Date(firstExamDate.getFullYear(), firstExamDate.getMonth(), 1));
      }
    }
  }, [myExams]);

  // 3. Logique de génération de la grille du calendrier
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Premier jour du mois
    const firstDayDate = new Date(year, month, 1);
    // Jour de la semaine (0=Dim, 1=Lun...)
    const firstDayOfWeek = firstDayDate.getDay();
    
    // Ajustement pour Lundi comme premier jour (Lundi=0, Dimanche=6)
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    // Nombre de jours dans le mois
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Remplissage des jours vides au début
    for (let i = 0; i < offset; i++) {
      days.push(null);
    }
    
    // Remplissage des jours du mois
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        dateStr,
        exams: myExams.filter(e => e.date === dateStr)
      });
    }
    
    return days;
  }, [currentMonth, myExams]);

  const changeMonth = (offset: number) => {
    // Utilisation d'une nouvelle date pour éviter la mutation
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const nextExam = myExams.find(e => new Date(`${e.date}T${e.time}`).getTime() > Date.now());

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header Statistique */}
      <div className="bg-indigo-700 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl">
            <ICONS.GraduationCap className="w-8 h-8 text-indigo-200" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight uppercase leading-none">{user.name}</h2>
            <p className="text-indigo-200 text-[10px] font-black uppercase tracking-[0.2em] mt-2">
              {myExams.length} surveillances programmées
            </p>
          </div>
        </div>
        <div className="flex bg-indigo-800/50 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setViewMode('calendar')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-700 shadow-lg' : 'text-indigo-300 hover:text-white'}`}
          >
            Vue Calendrier
          </button>
          <button 
            onClick={() => setViewMode('agenda')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'agenda' ? 'bg-white text-indigo-700 shadow-lg' : 'text-indigo-300 hover:text-white'}`}
          >
            Vue Liste
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
          {/* Navigation Calendrier */}
          <div className="p-8 flex justify-between items-center border-b border-slate-50">
            <div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Planification mensuelle</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => changeMonth(-1)} 
                className="p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl border border-slate-100 transition-all active:scale-90"
              >
                <ICONS.Plus className="w-5 h-5 rotate-[225deg]" />
              </button>
              <button 
                onClick={() => setCurrentMonth(new Date())} 
                className="px-6 py-2 bg-slate-50 hover:bg-indigo-600 hover:text-white text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-slate-100 transition-all"
              >
                Aujourd'hui
              </button>
              <button 
                onClick={() => changeMonth(1)} 
                className="p-3 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl border border-slate-100 transition-all active:scale-90"
              >
                <ICONS.Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
          </div>

          {/* Grille Jours Semaine */}
          <div className="grid grid-cols-7 border-b border-slate-50">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
              <div key={d} className="py-4 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">{d}</div>
            ))}
          </div>
          
          {/* Grille des Jours */}
          <div className="grid grid-cols-7 auto-rows-[140px]">
            {calendarDays.map((dayData, idx) => (
              <div 
                key={idx} 
                className={`p-3 border-r border-b border-slate-50 transition-colors ${!dayData ? 'bg-slate-50/20' : 'hover:bg-slate-50/50'}`}
              >
                {dayData && (
                  <>
                    <div className={`text-[11px] font-black mb-2 ${dayData.exams.length > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                      {dayData.day}
                    </div>
                    <div className="space-y-1.5 overflow-y-auto max-h-[90px] custom-scrollbar pr-1">
                      {dayData.exams.map((e, eIdx) => (
                        <div 
                          key={eIdx} 
                          className={`p-2 rounded-xl border-l-4 shadow-sm text-[9px] font-black leading-none ${PROMO_COLORS[e.promo!]}`}
                          title={`${e.subject} - ${e.room?.name}`}
                        >
                          <div className="flex justify-between gap-1 mb-1">
                            <span className="truncate">{e.subject}</span>
                          </div>
                          <div className="flex items-center gap-1 opacity-70">
                            <ICONS.Clock className="w-2.5 h-2.5" /> {e.time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myExams.length === 0 ? (
            <div className="md:col-span-2 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] p-20 text-center">
              <ICONS.Calendar className="w-16 h-16 text-slate-200 mx-auto mb-6" />
              <h3 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Aucune surveillance</h3>
              <p className="text-slate-300 text-sm mt-2">Votre planning est vide pour le moment.</p>
            </div>
          ) : (
            myExams.map((exam, idx) => (
              <div key={idx} className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-2 ${PROMO_COLORS[exam.promo!]?.split(' ')[0]}`}></div>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-4 rounded-2xl text-center min-w-[70px]">
                      <div className="text-2xl font-black text-indigo-600">{new Date(exam.date!).getDate()}</div>
                      <div className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">
                        {new Date(exam.date!).toLocaleDateString('fr-FR', { month: 'short' })}
                      </div>
                    </div>
                    <div>
                      <div className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase mb-1 border ${PROMO_COLORS[exam.promo!]}`}>
                        {exam.promo}
                      </div>
                      <h4 className="font-black text-slate-800 uppercase text-sm leading-tight group-hover:text-indigo-600 transition-colors">
                        {exam.subject}
                      </h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-indigo-700">{exam.time}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Salle: {exam.room?.name}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-50">
                  <div>
                    <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-2">👨‍🏫 Enseignants ({exam.assignment.profIds.length})</label>
                    <div className="flex flex-col gap-1.5">
                      {exam.assignment.profIds.map(pid => {
                        const prof = profs.find(p => p.id === pid);
                        const isMe = pid === user.id;
                        return (
                          <span key={pid} className={`px-3 py-1.5 text-[9px] font-bold rounded-lg border flex items-center gap-2 ${isMe ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                            {isMe ? '📍' : '👤'} {prof?.name || 'Inconnu'} <span className="text-[7px]">({prof?.rank})</span>
                          </span>
                        );
                      })}
                      {exam.assignment.profIds.length === 0 && <span className="text-[9px] text-slate-400 italic">-</span>}
                    </div>
                  </div>

                  <div>
                    <label className="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-2">👥 Résidents ({exam.assignment.residentIds.length})</label>
                    <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                      {exam.assignment.residentIds.map(rid => {
                        const resident = residents.find(r => r.id === rid);
                        const isMe = rid === user.id;
                        return (
                          <span key={rid} className={`px-3 py-1.5 text-[9px] font-bold rounded-lg border flex items-center gap-2 whitespace-nowrap ${isMe ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            {isMe ? '📍' : '👤'} {resident?.name || 'Inconnu'} <span className="text-[7px]">A{resident?.level}</span>
                          </span>
                        );
                      })}
                      {exam.assignment.residentIds.length === 0 && <span className="text-[9px] text-slate-400 italic">-</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Widget Flottant : Prochaine Échéance */}
      {nextExam && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-50">
          <div className="bg-slate-900/95 backdrop-blur-xl text-white rounded-3xl p-5 shadow-2xl flex items-center justify-between border border-white/10 ring-1 ring-white/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20">
                <ICONS.Clock className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Rendez-vous Prochain</div>
                <div className="text-sm font-bold truncate">{nextExam.subject}</div>
              </div>
            </div>
            <div className="text-right shrink-0 ml-4 border-l border-white/10 pl-4">
              <div className="text-sm font-black text-white">{nextExam.date}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{nextExam.time}</div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default ProctorView;
