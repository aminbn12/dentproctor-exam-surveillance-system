
import React, { useState, useRef, useMemo } from 'react';
import { Professor, Resident, Room, Exam, Promo } from '../types';
import { ICONS, PROMOS, PROMO_COLORS } from '../constants';
import { exportToJSON, importFromJSON } from '../utils/storage';

interface ConfigTabProps {
  profs: Professor[];
  setProfs: (p: Professor[]) => void;
  residents: Resident[];
  setResidents: (r: Resident[]) => void;
  rooms: Room[];
  setRooms: (rm: Room[]) => void;
  exams: Exam[];
  setExams: (e: Exam[]) => void;
}

const ConfigTab: React.FC<ConfigTabProps> = ({ 
  profs, setProfs, 
  residents, setResidents, 
  rooms, setRooms, 
  exams, setExams 
}) => {
  const [subTab, setSubTab] = useState<'profs' | 'residents' | 'rooms' | 'exams'>('profs');
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportToJSON(profs, residents, rooms, exams, []);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJSON(file);
      if (data.profs) setProfs(data.profs);
      if (data.residents) setResidents(data.residents);
      if (data.rooms) setRooms(data.rooms);
      if (data.exams) setExams(data.exams);
      alert('✅ Données importées avec succès !');
    } catch (error) {
      alert(`❌ Erreur: ${error}`);
    }
    if (importJsonRef.current) importJsonRef.current.value = '';
  };

  const deleteItem = (id: string, list: any[], setter: (val: any[]) => void, itemName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${itemName || 'cet élément'}" ?`)) {
      setter(list.filter(item => item.id !== id));
    }
  };

  const updateProf = (id: string, field: keyof Professor, value: any) => {
    setProfs(profs.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const updateResident = (id: string, field: keyof Resident, value: any) => {
    setResidents(residents.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const updateRoom = (id: string, field: keyof Room, value: any) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const updateExam = (id: string, field: keyof Exam, value: any) => {
    setExams(exams.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const calculateMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const updateDurationByEndTime = (examId: string, startTime: string, endTime: string) => {
    if (!startTime || !endTime) return;
    const startMins = calculateMinutes(startTime);
    const endMins = calculateMinutes(endTime);
    let diff = endMins - startMins;
    if (diff < 0) diff = 0; 
    updateExam(examId, 'duration', diff);
  };

  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return "";
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);
    date.setMinutes(date.getMinutes() + durationMinutes);
    return date.toTimeString().slice(0, 5);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split(/\r?\n/);
      const newItems: any[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('sep=') || line.toLowerCase().startsWith('nom')) continue;
        
        const separator = line.includes(';') ? ';' : ',';
        const columns = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        
        if (subTab === 'profs') {
          const [name, rank, promo, ...subjects] = columns;
          if (name) {
            newItems.push({
              id: `prof-${Date.now()}-${i}`,
              name,
              rank: (rank === 'Pr' || rank === 'Dr') ? rank : 'Dr',
              subjects: subjects.filter(s => s && s.trim() !== ''),
              responsiblePromo: PROMOS.includes(promo as any) ? promo : undefined,
              absences: []
            });
          }
        } else if (subTab === 'residents') {
          const [name, level, specialty] = columns;
          if (name) {
            newItems.push({
              id: `res-${Date.now()}-${i}`,
              name,
              level: [1, 2, 3, 4].includes(parseInt(level)) ? parseInt(level) : 1,
              specialty: specialty || '',
              absences: []
            });
          }
        }
      }

      if (subTab === 'profs') setProfs([...profs, ...newItems]);
      else if (subTab === 'residents') setResidents([...residents, ...newItems]);
      
      alert(`Importation réussie : ${newItems.length} profils ajoutés.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    let csv = '';
    let filename = '';
    
    if (subTab === 'profs') {
      csv = 'sep=;\n' +
            'Nom;Grade;Promo_Responsable;Matiere_1;Matiere_2;Matiere_3;Matiere_4\n' +
            'Alami Ahmed;Pr;FM6MD1;Anatomie;Biologie;Histologie;\n' +
            'Berrada Sarah;Dr;;Pathologie;Microbiologie;;';
      filename = 'modele_enseignants.csv';
    } else {
      csv = 'sep=;\n' +
            'Nom;Niveau;Specialite\n' +
            'Zahidi Anas;4;Orthodontie\n' +
            'Moussaoui Layla;1;Endodontie';
      filename = 'modele_residents.csv';
    }
    
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addAbsence = (personId: string, date: string) => {
    if (!date) return;
    if (subTab === 'profs') {
      const prof = profs.find(p => p.id === personId);
      if (prof && !prof.absences.includes(date)) {
        updateProf(personId, 'absences', [...prof.absences, date]);
      }
    } else {
      const res = residents.find(r => r.id === personId);
      if (res && !res.absences.includes(date)) {
        updateResident(personId, 'absences', [...res.absences, date]);
      }
    }
  };

  const removeAbsence = (personId: string, date: string) => {
    if (window.confirm("Supprimer cette date d'indisponibilité ?")) {
      if (subTab === 'profs') {
        const prof = profs.find(p => p.id === personId);
        if (prof) {
          updateProf(personId, 'absences', prof.absences.filter(d => d !== date));
        }
      } else {
        const res = residents.find(r => r.id === personId);
        if (res) {
          updateResident(personId, 'absences', res.absences.filter(d => d !== date));
        }
      }
    }
  };

  const conflicts = useMemo(() => {
    const map: Record<string, string[]> = {}; 
    exams.forEach(e1 => {
      if (!e1.date || !e1.time || !e1.subject) return;
      exams.forEach(e2 => {
        if (e1.id === e2.id) return;
        if (!e2.date || !e2.time || !e2.subject) return;
        if (e1.date === e2.date && e1.promo === e2.promo) {
          const start1 = calculateMinutes(e1.time);
          const end1 = start1 + e1.duration;
          const start2 = calculateMinutes(e2.time);
          const end2 = start2 + e2.duration;
          if (start1 < end2 && end1 > start2) {
            if (!map[e1.id]) map[e1.id] = [];
            if (!map[e1.id].includes(e2.subject)) map[e1.id].push(e2.subject);
          }
        }
      });
    });
    return map;
  }, [exams]);

  const toggleRoomInExam = (examId: string, roomId: string) => {
    setExams(exams.map(e => {
      if (e.id !== examId) return e;
      const currentRooms = e.roomIds || [];
      const isAlreadyIncluded = currentRooms.includes(roomId);
      
      // Confirmation si on retire une salle
      if (isAlreadyIncluded && !window.confirm("Retirer cette salle de l'épreuve ? Les affectations liées seront perdues.")) {
        return e;
      }

      const newRooms = isAlreadyIncluded
        ? currentRooms.filter(id => id !== roomId)
        : [...currentRooms, roomId];
      return { ...e, roomIds: newRooms };
    }));
  };

  const AbsenceModal = () => {
    const person = subTab === 'profs' 
      ? profs.find(p => p.id === editingAbsenceId)
      : residents.find(r => r.id === editingAbsenceId);

    if (!person) return null;

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
            <div>
              <h3 className="font-black text-indigo-950 uppercase tracking-tight">Exceptions & Congés</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{person.name}</p>
            </div>
            <button onClick={() => setEditingAbsenceId(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <ICONS.Plus className="w-5 h-5 rotate-45 text-slate-400" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Ajouter une date d'indisponibilité</label>
              <div className="flex gap-2">
                <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none" id="new-absence-date" />
                <button onClick={() => { const input = document.getElementById('new-absence-date') as HTMLInputElement; addAbsence(person.id, input.value); input.value = ''; }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-black hover:bg-indigo-700 transition-all active:scale-95">AJOUTER</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Dates configurées</label>
              <div className="max-h-48 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                {person.absences.length === 0 ? <div className="text-center py-6 text-slate-300 italic text-xs">Aucune absence enregistrée</div> : 
                  person.absences.sort().map(date => (
                    <div key={date} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-lg group">
                      <div className="flex items-center gap-2"><ICONS.Calendar className="w-3.5 h-3.5 text-indigo-400" /><span className="text-xs font-bold text-slate-700">{new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
                      <button onClick={() => removeAbsence(person.id, date)} className="text-slate-300 hover:text-red-500 p-1 rounded-md transition-colors"><ICONS.Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button onClick={() => setEditingAbsenceId(null)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Terminer la gestion</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {editingAbsenceId && <AbsenceModal />}
      <div className="flex border-b border-slate-200 gap-6">
        <button onClick={() => setSubTab('profs')} className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === 'profs' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Enseignants</button>
        <button onClick={() => setSubTab('residents')} className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === 'residents' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Résidents</button>
        <button onClick={() => setSubTab('rooms')} className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === 'rooms' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Salles</button>
        <button onClick={() => setSubTab('exams')} className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === 'exams' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Examens</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
          <h2 className="font-semibold text-slate-800 italic">{subTab === 'profs' ? 'Gestion des Enseignants' : subTab === 'residents' ? 'Gestion des Résidents' : subTab === 'rooms' ? 'Gestion des Salles' : 'Programmation des Épreuves'}</h2>
          
          <div className="flex items-center gap-2">
            {(subTab === 'profs' || subTab === 'residents') && (
              <>
                <button 
                  onClick={downloadTemplate}
                  title="Télécharger le modèle avec colonnes forcées"
                  className="flex items-center gap-1.5 text-[10px] border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
                >
                  <ICONS.FileSpreadsheet className="w-3.5 h-3.5" /> Modèle Excel
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-[10px] border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all"
                >
                  <ICONS.Upload className="w-3.5 h-3.5" /> Importer
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
              </>
            )}

            <button 
              onClick={handleExport}
              title="Exporter toutes les données en JSON"
              className="flex items-center gap-1.5 text-[10px] border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
            >
              <ICONS.Download className="w-3.5 h-3.5" /> Exporter
            </button>
            <button 
              onClick={() => importJsonRef.current?.click()}
              title="Importer une sauvegarde JSON"
              className="flex items-center gap-1.5 text-[10px] border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
            >
              <ICONS.Upload className="w-3.5 h-3.5" /> Restaurer
            </button>
            <input type="file" ref={importJsonRef} className="hidden" accept=".json" onChange={handleImportJSON} />

            <button onClick={() => {
              const id = Date.now().toString();
              if (subTab === 'profs') setProfs([...profs, { id, name: '', rank: 'Dr', subjects: [], absences: [] }]);
              else if (subTab === 'residents') setResidents([...residents, { id, name: '', level: 1, specialty: '', absences: [] }]);
              else if (subTab === 'rooms') setRooms([...rooms, { id, name: `Salle ${rooms.length + 1}`, profCapacity: 1, residentCapacity: 2 }]);
              else setExams([...exams, { id, date: '', time: '', duration: 120, promo: 'FM6MD1', subject: '', roomIds: [] }]);
            }} className="flex items-center gap-1.5 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-black tracking-widest uppercase shadow-md transition-all active:scale-95"><ICONS.Plus className="w-3.5 h-3.5" /> Ajouter</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] tracking-wider font-black border-b border-slate-100">
              <tr>
                {subTab === 'profs' && <><th className="px-6 py-3">Nom</th><th className="px-6 py-3">Grade</th><th className="px-6 py-3">Responsable</th><th className="px-6 py-3">Matières</th><th className="px-6 py-3">Exceptions</th><th className="px-6 py-3 text-right">Actions</th></>}
                {subTab === 'residents' && <><th className="px-6 py-3">Nom</th><th className="px-6 py-3">Niveau</th><th className="px-6 py-3">Spécialité</th><th className="px-6 py-3">Exceptions</th><th className="px-6 py-3 text-right">Actions</th></>}
                {subTab === 'rooms' && <><th className="px-6 py-3">Salle</th><th className="px-6 py-3">P. Cap</th><th className="px-6 py-3">R. Cap</th><th className="px-6 py-3 text-right">Actions</th></>}
                {subTab === 'exams' && <><th className="px-6 py-3">Épreuve / Promo</th><th className="px-6 py-3 min-w-[320px]">Planification (Date & Heures)</th><th className="px-6 py-3">Salles</th><th className="px-6 py-3 text-right">Actions</th></>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subTab === 'profs' && profs.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3">
                    <div className="flex flex-col">
                      <input className="bg-transparent font-semibold outline-none w-full" value={p.name} onChange={(e) => updateProf(p.id, 'name', e.target.value)} placeholder="Nom..." />
                      {p.responsiblePromo && (
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded w-fit mt-1 border ${PROMO_COLORS[p.responsiblePromo]}`}>
                          Responsable {p.responsiblePromo}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3"><select className="bg-transparent font-bold text-xs" value={p.rank} onChange={(e) => updateProf(p.id, 'rank', e.target.value as any)}><option value="Pr">Pr</option><option value="Dr">Dr</option></select></td>
                  <td className="px-6 py-3">
                    <select 
                      className="bg-transparent text-[10px] font-black uppercase tracking-wider outline-none border border-slate-200 rounded px-1.5 py-0.5" 
                      value={p.responsiblePromo || ''} 
                      onChange={(e) => updateProf(p.id, 'responsiblePromo', e.target.value || undefined)}
                    >
                      <option value="">Aucune</option>
                      {PROMOS.map(pr => <option key={pr} value={pr}>{pr}</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {p.subjects.map((s, idx) => (
                        <span key={idx} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100">{s}</span>
                      ))}
                      {p.subjects.length === 0 && <span className="text-slate-300 text-[10px]">Aucune matière</span>}
                    </div>
                  </td>
                  <td className="px-6 py-3"><button onClick={() => setEditingAbsenceId(p.id)} className="flex items-center gap-1.5 text-[10px] font-black bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 px-2 py-1 rounded transition-all"><ICONS.Calendar className="w-3 h-3" /> {p.absences.length} DATE(S)</button></td>
                  <td className="px-6 py-3 text-right"><button onClick={() => deleteItem(p.id, profs, setProfs, `${p.rank}. ${p.name}`)} className="text-slate-300 hover:text-red-500 p-1"><ICONS.Trash2 className="w-4 h-4"/></button></td>
                </tr>
              ))}
              {subTab === 'residents' && residents.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3"><input className="bg-transparent font-semibold outline-none w-full" value={r.name} onChange={(e) => updateResident(r.id, 'name', e.target.value)} placeholder="Nom..." /></td>
                  <td className="px-6 py-3"><select className="bg-transparent font-black text-indigo-600 text-xs" value={r.level} onChange={(e) => updateResident(r.id, 'level', parseInt(e.target.value) as any)}>{[1, 2, 3, 4].map(l => <option key={l} value={l}>A{l}</option>)}</select></td>
                  <td className="px-6 py-3">
                    <input 
                      className="bg-transparent text-xs text-slate-600 italic outline-none w-full" 
                      value={r.specialty} 
                      onChange={(e) => updateResident(r.id, 'specialty', e.target.value)} 
                      placeholder="Spécialité..." 
                    />
                  </td>
                  <td className="px-6 py-3"><button onClick={() => setEditingAbsenceId(r.id)} className="flex items-center gap-1.5 text-[10px] font-black bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 px-2 py-1 rounded transition-all"><ICONS.Calendar className="w-3 h-3" /> {r.absences.length} DATE(S)</button></td>
                  <td className="px-6 py-3 text-right"><button onClick={() => deleteItem(r.id, residents, setResidents, `Résident ${r.name}`)} className="text-slate-300 hover:text-red-500 p-1"><ICONS.Trash2 className="w-4 h-4"/></button></td>
                </tr>
              ))}
              {subTab === 'rooms' && rooms.map(rm => (
                <tr key={rm.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3"><input className="bg-transparent font-bold outline-none w-full" value={rm.name} onChange={(e) => updateRoom(rm.id, 'name', e.target.value)} placeholder="Salle..." /></td>
                  <td className="px-6 py-3"><input type="number" className="w-12 bg-slate-50 border rounded px-1" value={rm.profCapacity} onChange={(e) => updateRoom(rm.id, 'profCapacity', parseInt(e.target.value))} /></td>
                  <td className="px-6 py-3"><input type="number" className="w-12 bg-slate-50 border rounded px-1" value={rm.residentCapacity} onChange={(e) => updateRoom(rm.id, 'residentCapacity', parseInt(e.target.value))} /></td>
                  <td className="px-6 py-3 text-right"><button onClick={() => deleteItem(rm.id, rooms, setRooms, `Salle ${rm.name}`)} className="text-slate-300 hover:text-red-500 p-1"><ICONS.Trash2 className="w-4 h-4"/></button></td>
                </tr>
              ))}
              {subTab === 'exams' && exams.map(e => {
                const hasConflict = !!conflicts[e.id];
                return (
                  <tr key={e.id} className={`hover:bg-slate-50/50 ${hasConflict ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <select className={`text-[10px] font-black border rounded px-1.5 py-0.5 mb-1 block ${PROMO_COLORS[e.promo]}`} value={e.promo} onChange={(val) => updateExam(e.id, 'promo', val.target.value as any)}>
                        {PROMOS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input className="bg-transparent font-black outline-none w-full text-indigo-950" value={e.subject} onChange={(ev) => updateExam(e.id, 'subject', ev.target.value)} placeholder="Épreuve..." />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</label>
                          <input type="date" value={e.date} onChange={(v) => updateExam(e.id, 'date', v.target.value)} className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Début</label>
                          <input type="time" value={e.time} onChange={(v) => updateExam(e.id, 'time', v.target.value)} className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold" />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fin</label>
                          <input type="time" value={calculateEndTime(e.time, e.duration)} onChange={(v) => updateDurationByEndTime(e.id, e.time, v.target.value)} className="bg-indigo-50 border border-indigo-100 rounded px-1 py-0.5 text-[10px] font-bold text-indigo-700" />
                        </div>
                        <div className="flex flex-col ml-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Durée</label>
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{Math.floor(e.duration / 60)}h{e.duration % 60}m</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {rooms.map(room => (
                          <button key={room.id} onClick={() => toggleRoomInExam(e.id, room.id)} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${e.roomIds?.includes(room.id) ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-300 border-slate-200'}`}>{room.name}</button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right"><button onClick={() => deleteItem(e.id, exams, setExams, `Épreuve ${e.subject}`)} className="text-slate-300 hover:text-red-500 p-1"><ICONS.Trash2 className="w-4 h-4"/></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
        <ICONS.CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <p className="font-bold uppercase tracking-wider mb-1">Optimisation Excel (Colonnes A, B, C...)</p>
          <p className="mb-2">Le modèle téléchargé utilise désormais une instruction technique (sep=;) qui garantit que chaque donnée s'ouvre dans une **cellule Excel séparée**.</p>
          <ul className="list-disc list-inside space-y-1 opacity-90 font-medium">
            {subTab === 'profs' ? (
              <>
                <li><strong>Cellule A</strong> : Nom | <strong>Cellule B</strong> : Grade | <strong>Cellule C</strong> : Promo | <strong>D, E, F...</strong> : Matières</li>
              </>
            ) : (
              <>
                <li><strong>Cellule A</strong> : Nom | <strong>Cellule B</strong> : Niveau (1-4) | <strong>Cellule C</strong> : Spécialité</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ConfigTab;
