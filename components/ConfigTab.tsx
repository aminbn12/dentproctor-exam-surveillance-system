import React, { useState, useRef, useMemo, useEffect } from "react";
import { Sun, Moon, X, Sparkles, Check, CalendarDays, Clock3, Search, BookOpen } from "lucide-react";
import { Absence, Proctor } from "../types";
import { Professor, Resident, Room, Exam, Promo } from "../types";
import { ICONS, PROMOS, PROMO_COLORS } from "../constants";
import { exportToJSON, importFromJSON } from "../utils/storage";
import { syncWithBackend } from "../utils/apiIntegration";
import {
  createProfessor,
  updateProfessorApi,
  deleteProfessorApi,
  createResident,
  updateResidentApi,
  deleteResidentApi,
  createRoomApi,
  updateRoomApi,
  deleteRoomApi,
  createProctorApi,
  updateProctorApi,
  deleteProctorApi,
  createExamApi,
  updateExamApi,
  deleteExamApi,
} from "../utils/apiIntegration";
import {
  adaptProfessor,
  adaptResident,
  adaptRoom,
  adaptExam,
} from "../utils/apiAdapter";
import {
  downloadExamTemplate,
  exportExamsToExcel,
  parseExamsFromExcel,
} from "../utils/excelExamService";

export const formatFrenchDateShort = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    if (!y || !m || !d) return dateStr;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
};

export const getDatesInRange = (startStr: string, endStr: string): string[] => {
  const [y1, m1, d1] = startStr.split("-").map(Number);
  const [y2, m2, d2] = endStr.split("-").map(Number);
  const s = new Date(y1, m1 - 1, d1);
  const e = new Date(y2, m2 - 1, d2);
  if (s > e) return [];
  const list: string[] = [];
  const cur = new Date(s);
  while (cur <= e) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    list.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return list;
};

export const getExamEndStr = (startTime: string, durationMin: number) => {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMin;
  const eh = Math.floor(total / 60);
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
};

interface BulkResidentAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  exams: Exam[];
  initialSelectedIds?: string[];
}

const BulkResidentAbsenceModal: React.FC<BulkResidentAbsenceModalProps> = ({
  isOpen,
  onClose,
  residents,
  setResidents,
  exams,
  initialSelectedIds = [],
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchName, setSearchName] = useState("");
  const [levelFilter, setLevelFilter] = useState<"ALL" | 1 | 2 | 3 | 4>("ALL");
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [dateInput, setDateInput] = useState("");
  const [dateEndInput, setDateEndInput] = useState("");
  const [timePreset, setTimePreset] = useState<"full" | "morning" | "afternoon" | "custom">("full");
  const [isPartial, setIsPartial] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds || []);
      setSearchName("");
      setLevelFilter("ALL");
      setSuccessMsg(null);
    }
  }, [isOpen, initialSelectedIds]);

  // Dates uniques d'examens dans la session
  const sessionExamDates = useMemo(() => {
    return Array.from(
      new Set(exams.map((e) => e.date).filter(Boolean)),
    ).sort();
  }, [exams]);

  // 1. Filtrage instantané des résidents par nom, spécialité et niveau
  const filteredResidents = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return residents.filter((r) => {
      if (q) {
        const matchName = r.name.toLowerCase().includes(q);
        const matchSpec = (r.specialty || "").toLowerCase().includes(q);
        if (!matchName && !matchSpec) return false;
      }
      if (levelFilter !== "ALL" && r.level !== levelFilter) {
        return false;
      }
      return true;
    });
  }, [residents, searchName, levelFilter]);

  // Examens programmés à la date sélectionnée (mode date unique)
  const examsOnSelectedDate = useMemo(() => {
    if (!dateInput) return [];
    return exams
      .filter((e) => e.date === dateInput && e.time)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [dateInput, exams]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: "full" | "morning" | "afternoon" | "custom") => {
    setTimePreset(preset);
    if (preset === "full") {
      setIsPartial(false);
      setStartTime("");
      setEndTime("");
    } else if (preset === "morning") {
      setIsPartial(true);
      setStartTime("08:00");
      setEndTime("13:00");
    } else if (preset === "afternoon") {
      setIsPartial(true);
      setStartTime("13:00");
      setEndTime("18:00");
    } else {
      setIsPartial(true);
      if (!startTime) setStartTime("09:00");
      if (!endTime) setEndTime("11:00");
    }
  };

  const handleSelectExamSlot = (ex: Exam) => {
    setTimePreset("custom");
    setIsPartial(true);
    setStartTime(ex.time);
    setEndTime(getExamEndStr(ex.time, ex.duration));
  };

  const handleToggleResident = (resId: string) => {
    setSelectedIds((prev) =>
      prev.includes(resId) ? prev.filter((id) => id !== resId) : [...prev, resId]
    );
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredResidents.map((r) => r.id);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAllFiltered = () => {
    const idsToRemove = new Set(filteredResidents.map((r) => r.id));
    setSelectedIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const rangeDatesCount =
    dateMode === "range" && dateInput && dateEndInput
      ? getDatesInRange(dateInput, dateEndInput).length
      : 0;

  const handleApply = async () => {
    if (selectedIds.length === 0) {
      alert("Veuillez sélectionner au moins un résident.");
      return;
    }

    let dates: string[] = [];
    if (dateMode === "single") {
      if (!dateInput) {
        alert("Veuillez sélectionner une date.");
        return;
      }
      dates = [dateInput];
    } else {
      if (!dateInput || !dateEndInput) {
        alert("Veuillez renseigner la date de début et la date de fin.");
        return;
      }
      dates = getDatesInRange(dateInput, dateEndInput);
      if (dates.length === 0) {
        alert("La date de début doit être antérieure ou égale à la date de fin.");
        return;
      }
    }

    if (isPartial) {
      if (!startTime || !endTime) {
        alert("Veuillez renseigner l'heure de début et l'heure de fin.");
        return;
      }
      if (startTime >= endTime) {
        alert("L'heure de fin doit être après l'heure de début.");
        return;
      }
    }

    const newAbsences: Absence[] = dates.map((date) =>
      isPartial
        ? { date, startTime, endTime }
        : { date }
    );

    setIsApplying(true);
    try {
      const updatedMap = new Map<string, Absence[]>();
      for (const resId of selectedIds) {
        const res = residents.find((r) => r.id === resId);
        if (!res) continue;
        const existing = res.absences || [];
        const toAdd = newAbsences.filter(
          (na) =>
            !existing.some(
              (a) =>
                a.date === na.date &&
                (a.startTime || "") === (na.startTime || "") &&
                (a.endTime || "") === (na.endTime || "")
            )
        );
        if (toAdd.length > 0) {
          updatedMap.set(resId, [...existing, ...toAdd]);
        }
      }

      if (updatedMap.size === 0) {
        alert("Tous les résidents sélectionnés ont déjà ces indisponibilités enregistrées.");
        setIsApplying(false);
        return;
      }

      // 1. Mettre à jour l'état local React
      setResidents((prev) =>
        prev.map((r) =>
          updatedMap.has(r.id)
            ? { ...r, absences: updatedMap.get(r.id)! }
            : r
        )
      );

      // 2. Persister dans la BDD SQLite
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable) {
        for (const [resId, absList] of updatedMap.entries()) {
          try {
            await updateResidentApi(resId, { absences: absList } as any);
          } catch (err) {
            console.warn(`Erreur persistence absence résident ${resId}:`, err);
          }
        }
      }

      setSuccessMsg(
        `Indisponibilité enregistrée avec succès pour ${updatedMap.size} résident(s) !`
      );
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      alert("Erreur lors de l'enregistrement : " + err?.message);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header moderne avec dégradé Indigo/Slate */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start shrink-0 border-b border-indigo-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                <ICONS.Calendar className="w-3 h-3 text-amber-300" /> Action Groupée
              </span>
              <span className="text-[10px] font-black text-indigo-200 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                {selectedIds.length} résident(s) sélectionné(s)
              </span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Déclaration d'Indisponibilité en Masse — Résidents
            </h3>
            <p className="text-xs text-slate-300">
              Sélectionnez les résidents par recherche de nom ou par niveau, puis définissez leur période d'absence commune.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps en 2 colonnes */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm animate-in slide-in-from-top-2">
              <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Colonne Gauche (6 cols) : Sélection des résidents + Recherche par Nom */}
            <div className="lg:col-span-6 space-y-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ICONS.Users className="w-4 h-4 text-indigo-600" />
                    1. Choisir les Résidents
                  </label>
                  <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                    {selectedIds.length} / {residents.length} cochés
                  </span>
                </div>

                {/* Champ de RECHERCHE PAR NOM avec autoFocus permanent et stable */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Chercher un résident par son nom..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                  />
                  {searchName && (
                    <button
                      type="button"
                      onClick={() => setSearchName("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200"
                      title="Effacer la recherche"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtres par Niveau R1 - R4 */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setLevelFilter("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      levelFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Tous ({residents.length})
                  </button>
                  {[1, 2, 3, 4].map((lvl) => {
                    const count = residents.filter((r) => r.level === lvl).length;
                    const isSel = levelFilter === lvl;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLevelFilter(lvl as any)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                          isSel
                            ? lvl === 1
                              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                              : lvl === 2
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : lvl === 3
                                  ? "bg-purple-600 border-purple-600 text-white shadow-sm"
                                  : "bg-amber-600 border-amber-600 text-white shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        R{lvl} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Barre Tout Cocher / Tout Décocher */}
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Tout cocher ({filteredResidents.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllFiltered}
                      className="font-bold text-slate-500 hover:text-slate-700 hover:underline"
                    >
                      Tout décocher
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium italic">
                    {filteredResidents.length} affiché(s)
                  </span>
                </div>

                {/* Liste défilable des résidents */}
                <div className="max-h-72 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar border border-slate-100 rounded-xl p-1 bg-slate-50/50">
                  {filteredResidents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">
                      Aucun résident ne correspond à « {searchName} ».
                    </div>
                  ) : (
                    filteredResidents.map((r) => {
                      const isSelected = selectedIds.includes(r.id);
                      const absCount = (r.absences || []).length;
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleToggleResident(r.id)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-indigo-50/80 border-indigo-200 text-indigo-950 shadow-sm"
                              : "bg-white border-slate-200/70 hover:bg-slate-100/60 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // géré par clic sur la ligne
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-xs truncate block text-slate-900">
                                {r.name}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {r.specialty || "Général"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                r.level === 1
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : r.level === 2
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : r.level === 3
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              R{r.level}
                            </span>
                            {absCount > 0 ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                {absCount} indispo.
                              </span>
                            ) : (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                Dispo
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Colonne Droite (6 cols) : Configuration Date & Horaires */}
            <div className="lg:col-span-6 space-y-3">
              {/* 1. SECTION JOUR OU PÉRIODE */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-amber-600" />
                    2. Choisir la Date ou la Période
                  </label>
                  {/* Switch Date Unique vs Période */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setDateMode("single")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        dateMode === "single"
                          ? "bg-white text-indigo-700 shadow-sm font-black"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Date unique
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode("range")}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        dateMode === "range"
                          ? "bg-white text-indigo-700 shadow-sm font-black"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Période (Du... Au...)
                    </button>
                  </div>
                </div>

                {dateMode === "single" ? (
                  <div className="space-y-2">
                    {sessionExamDates.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                          Jours d'examens (1-clic) :
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                          {sessionExamDates.map((d) => {
                            const isSelected = dateInput === d;
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setDateInput(d)}
                                className={`text-xs px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                                  isSelected
                                    ? "bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-200"
                                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                <span>{formatFrenchDateShort(d)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {sessionExamDates.length > 0 ? "Ou autre date libre :" : "Sélectionner la date :"}
                      </span>
                      <input
                        type="date"
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Du (Date début)
                        </span>
                        <input
                          type="date"
                          value={dateInput}
                          onChange={(e) => setDateInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Au (Date fin incluse)
                        </span>
                        <input
                          type="date"
                          value={dateEndInput}
                          onChange={(e) => setDateEndInput(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                    </div>
                    {rangeDatesCount > 0 && (
                      <div className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                        ✨ {rangeDatesCount} jour(s) consécutif(s) seront configurés pour les résidents.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. SECTION CRÉNEAU HORAIRE */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock3 className="w-4 h-4 text-amber-600" />
                  3. Choisir le Créneau
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("full")}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      timePreset === "full"
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md font-black"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                    }`}
                  >
                    <span className="text-sm">🌕</span>
                    <span className="text-xs">Journée</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPreset("morning")}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      timePreset === "morning"
                        ? "bg-amber-500 border-amber-500 text-white shadow-md font-black"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                    }`}
                  >
                    <Sun className={`w-3.5 h-3.5 ${timePreset === "morning" ? "text-white" : "text-amber-500"}`} />
                    <span className="text-xs">Matin</span>
                    <span className={`text-[8px] ${timePreset === "morning" ? "text-amber-100" : "text-slate-400"}`}>08h-13h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPreset("afternoon")}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      timePreset === "afternoon"
                        ? "bg-blue-600 border-blue-600 text-white shadow-md font-black"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                    }`}
                  >
                    <Moon className={`w-3.5 h-3.5 ${timePreset === "afternoon" ? "text-white" : "text-blue-500"}`} />
                    <span className="text-xs">A.-midi</span>
                    <span className={`text-[8px] ${timePreset === "afternoon" ? "text-blue-100" : "text-slate-400"}`}>13h-18h</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectPreset("custom")}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 ${
                      timePreset === "custom"
                        ? "bg-purple-600 border-purple-600 text-white shadow-md font-black"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                    }`}
                  >
                    <span className="text-sm">⏱️</span>
                    <span className="text-xs">Libre</span>
                    <span className={`text-[8px] ${timePreset === "custom" ? "text-purple-100" : "text-slate-400"}`}>Heures</span>
                  </button>
                </div>

                {/* Épreuves du jour : 1-clic pour caler sur une épreuve précise */}
                {dateMode === "single" && examsOnSelectedDate.length > 0 && (
                  <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-1.5">
                    <span className="text-[9px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      Épreuves de ce jour (1-clic) :
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {examsOnSelectedDate.map((ex) => {
                        const endStr = getExamEndStr(ex.time, ex.duration);
                        const isMatching =
                          isPartial &&
                          startTime === ex.time &&
                          endTime === endStr;
                        return (
                          <button
                            key={ex.id}
                            type="button"
                            onClick={() => handleSelectExamSlot(ex)}
                            className={`text-[11px] px-2 py-1 rounded-lg border font-bold transition-all text-left ${
                              isMatching
                                ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                                : "bg-white border-amber-200 text-amber-950 hover:bg-amber-100/60"
                            }`}
                          >
                            <span className="font-black">{ex.time} → {endStr}</span>
                            <span className="ml-1 text-[9px] opacity-80">({ex.promo} {ex.subject})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {timePreset === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Début
                      </span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                        Fin
                      </span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Bouton d'application */}
                <button
                  type="button"
                  disabled={isApplying || selectedIds.length === 0}
                  onClick={handleApply}
                  className={`w-full mt-3 py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 ${
                    isApplying || selectedIds.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/25 active:scale-[0.98]"
                  }`}
                >
                  {isApplying ? (
                    <span>Enregistrement en cours...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>
                        Appliquer à {selectedIds.length} résident(s)
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-bold">
            {selectedIds.length} résident(s) sélectionné(s) sur {residents.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

interface ConfigTabProps {
  profs: Professor[];
  setProfs: React.Dispatch<React.SetStateAction<Professor[]>>;
  residents: Resident[];
  setResidents: React.Dispatch<React.SetStateAction<Resident[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  exams: Exam[];
  setExams: React.Dispatch<React.SetStateAction<Exam[]>>;
  proctors: Proctor[];
  setProctors: React.Dispatch<React.SetStateAction<Proctor[]>>;
}

const ConfigTab: React.FC<ConfigTabProps> = ({
  profs,
  setProfs,
  residents,
  setResidents,
  rooms,
  setRooms,
  exams,
  setExams,
  proctors,
  setProctors,
}) => {
  const [subTab, setSubTab] = useState<
    "profs" | "residents" | "rooms" | "exams" | "proctors"
  >("profs");
  const [proctorCategoryFilter, setProctorCategoryFilter] = useState<string>("ALL");
  const [proctorStatusFilter, setProctorStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [proctorSearch, setProctorSearch] = useState<string>("");

  const [profRankFilter, setProfRankFilter] = useState<"ALL" | "Pr" | "Dr" | "RESP">("ALL");
  const [profPromoFilter, setProfPromoFilter] = useState<string>("ALL");
  const [profSearch, setProfSearch] = useState<string>("");

  const [residentLevelFilter, setResidentLevelFilter] = useState<"ALL" | 1 | 2 | 3 | 4>("ALL");
  const [residentSpecialtyFilter, setResidentSpecialtyFilter] = useState<string>("ALL");
  const [residentSearch, setResidentSearch] = useState<string>("");

  const [roomSearch, setRoomSearch] = useState<string>("");
  const [roomStatusFilter, setRoomStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [examSearch, setExamSearch] = useState<string>("");

  const displayedProctors = useMemo(() => {
    return proctors.filter((p) => {
      const spec = p.specialty || "Administration";
      if (proctorCategoryFilter === "Administration") {
        if (spec !== "Administration") return false;
      } else if (proctorCategoryFilter === "IT") {
        if (!spec.includes("IT")) return false;
      } else if (proctorCategoryFilter === "Responsables de Zones") {
        if (!spec.includes("Zones")) return false;
      } else if (proctorCategoryFilter === "Administration & Resp. de Zones") {
        if (!spec.includes("Administration") || !spec.includes("Zones")) return false;
      }
      const isActive = p.is_active === 1 || (p.is_active as any) === true;
      if (proctorStatusFilter === "ACTIVE" && !isActive) return false;
      if (proctorStatusFilter === "INACTIVE" && isActive) return false;
      if (proctorSearch.trim()) {
        const q = proctorSearch.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          spec.toLowerCase().includes(q) ||
          (p.email || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [proctors, proctorCategoryFilter, proctorStatusFilter, proctorSearch]);

  const displayedProfs = useMemo(() => {
    return profs.filter((p) => {
      if (profRankFilter === "Pr" && p.rank !== "Pr") return false;
      if (profRankFilter === "Dr" && p.rank !== "Dr") return false;
      if (profRankFilter === "RESP" && !p.responsiblePromo) return false;
      if (profPromoFilter !== "ALL" && p.responsiblePromo !== profPromoFilter) return false;
      if (profSearch.trim()) {
        const q = profSearch.toLowerCase();
        const inSubjects = (p.subjects || []).some((s) => s.toLowerCase().includes(q));
        return (
          p.name.toLowerCase().includes(q) ||
          (p.responsiblePromo || "").toLowerCase().includes(q) ||
          inSubjects
        );
      }
      return true;
    });
  }, [profs, profRankFilter, profPromoFilter, profSearch]);

  const displayedResidents = useMemo(() => {
    return residents.filter((r) => {
      if (residentLevelFilter !== "ALL" && r.level !== residentLevelFilter) return false;
      if (residentSpecialtyFilter !== "ALL" && r.specialty !== residentSpecialtyFilter) return false;
      if (residentSearch.trim()) {
        const q = residentSearch.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.specialty.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [residents, residentLevelFilter, residentSpecialtyFilter, residentSearch]);

  const residentSpecialties = useMemo(() => {
    const set = new Set<string>();
    residents.forEach((r) => {
      if (r.specialty?.trim()) set.add(r.specialty.trim());
    });
    return Array.from(set).sort();
  }, [residents]);

  const displayedRooms = useMemo(() => {
    return rooms.filter((r) => {
      const isActive = r.isActive !== false;
      if (roomStatusFilter === "ACTIVE" && !isActive) return false;
      if (roomStatusFilter === "INACTIVE" && isActive) return false;
      if (roomSearch.trim()) {
        const q = roomSearch.toLowerCase();
        return r.name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [rooms, roomStatusFilter, roomSearch]);

  const displayedExams = useMemo(() => {
    return exams.filter((e) => {
      if (!e.date || !e.subject) return false;
      if (examSearch.trim()) {
        const q = examSearch.toLowerCase();
        return (
          e.subject.toLowerCase().includes(q) ||
          e.promo.toLowerCase().includes(q) ||
          e.date.includes(q)
        );
      }
      return true;
    });
  }, [exams, examSearch]);
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [absenceDateMode, setAbsenceDateMode] = useState<"single" | "range">("single");
  const [absenceDateInput, setAbsenceDateInput] = useState("");
  const [absenceDateEndInput, setAbsenceDateEndInput] = useState("");
  const [absenceTimePreset, setAbsenceTimePreset] = useState<"full" | "morning" | "afternoon" | "custom">("full");
  const [absenceIsPartial, setAbsenceIsPartial] = useState(false);
  const [absenceStartTime, setAbsenceStartTime] = useState("");
  const [absenceEndTime, setAbsenceEndTime] = useState("");

  // État pour l'ouverture de l'absence groupée des résidents
  const [isBulkResidentAbsenceOpen, setIsBulkResidentAbsenceOpen] = useState(false);
  const [bulkResidentInitialIds, setBulkResidentInitialIds] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingSubjectsId, setEditingSubjectsId] = useState<string | null>(
    null,
  );
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);
  const examFileInputRef = useRef<HTMLInputElement>(null);

  const downloadExamTemplateExcel = () => {
    downloadExamTemplate();
  };

  const handleExportExamsExcel = () => {
    exportExamsToExcel(exams, rooms);
  };

  const handleImportExamsExcel = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseExamsFromExcel(file, rooms);
      if (result.errors.length > 0) {
        alert("❌ Erreur d'importation :\n" + result.errors.join("\n"));
        return;
      }

      if (result.exams.length === 0) {
        alert("⚠️ Aucun examen valide trouvé dans le fichier.");
        return;
      }

      const replace = window.confirm(
        `✅ ${result.exams.length} examen(s) détecté(s) !\n\nVoulez-vous REMPLACER la liste actuelle ?\n(Cliquez 'Annuler' pour les AJOUTER à la suite des examens existants)`,
      );

      const updatedExams = replace ? result.exams : [...exams, ...result.exams];
      setExams(updatedExams);

      // Sauvegarde backend si disponible
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          for (const ex of result.exams) {
            await createExamApi(ex);
          }
        }
      } catch (err) {
        console.warn("Sync backend après import examens échoué", err);
      }

      let msg = `✅ ${result.exams.length} examens importés avec succès !`;
      if (result.warnings.length > 0) {
        msg += "\n\n⚠️ Avertissements :\n" + result.warnings.slice(0, 5).join("\n");
      }
      alert(msg);
    } catch (error: any) {
      alert("❌ Erreur lors de l'import : " + error.message);
    } finally {
      if (examFileInputRef.current) examFileInputRef.current.value = "";
    }
  };

  // Vider la sélection quand on change d'onglet
  const handleTabChange = (
    newTab: "profs" | "residents" | "rooms" | "exams" | "proctors",
  ) => {
    setSubTab(newTab);
    setSelectedIds([]);
  };

  const handleExport = () => {
    exportToJSON(profs, residents, rooms, exams, []);
  };

  // Synchroniser les données locales vers le backend
  const syncLocalDataToBackend = async () => {
    if (
      !confirm(
        "🔄 Synchroniser toutes les données locales vers le serveur ?\n\nCela enverra vos enseignants, résidents, salles et examens vers la base de données.",
      )
    ) {
      return;
    }

    try {
      const backend = await syncWithBackend();
      if (!backend?.isBackendAvailable) {
        alert("❌ Serveur indisponible. Vérifiez que le backend est démarré.");
        return;
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Synchroniser les professeurs
      for (const prof of profs) {
        try {
          await createProfessor({
            id: prof.id,
            name: prof.name,
            rank: prof.rank,
            responsiblePromo: prof.responsiblePromo,
            subjects: prof.subjects,
            absences: prof.absences,
          });
          successCount++;
        } catch (err: any) {
          if (
            err.message?.includes("409") ||
            err.message?.includes("existe déjà")
          ) {
            try {
              await updateProfessorApi(prof.id, {
                name: prof.name,
                rank: prof.rank,
                responsiblePromo: prof.responsiblePromo,
                subjects: prof.subjects,
                absences: prof.absences,
              });
              successCount++;
            } catch (updateErr: any) {
              errorCount++;
              errors.push(`Prof ${prof.name}: ${updateErr.message}`);
            }
          } else {
            errorCount++;
            errors.push(`Prof ${prof.name}: ${err.message}`);
          }
        }
      }

      // Synchroniser les résidents
      for (const resident of residents) {
        try {
          await createResident({
            id: resident.id,
            name: resident.name,
            level: resident.level,
            specialty: resident.specialty,
            absences: resident.absences,
          });
          successCount++;
        } catch (err: any) {
          if (
            err.message?.includes("409") ||
            err.message?.includes("existe déjà")
          ) {
            try {
              await updateResidentApi(resident.id, {
                name: resident.name,
                level: resident.level,
                specialty: resident.specialty,
                absences: resident.absences,
              });
              successCount++;
            } catch (updateErr: any) {
              errorCount++;
              errors.push(`Résident ${resident.name}: ${updateErr.message}`);
            }
          } else {
            errorCount++;
            errors.push(`Résident ${resident.name}: ${err.message}`);
          }
        }
      }

      // Synchroniser les salles
      for (const room of rooms) {
        try {
          await createRoomApi({
            id: room.id,
            name: room.name,
            profCapacity: room.profCapacity,
            residentCapacity: room.residentCapacity,
          });
          successCount++;
        } catch (err: any) {
          if (
            err.message?.includes("409") ||
            err.message?.includes("existe déjà")
          ) {
            try {
              await updateRoomApi(room.id, {
                name: room.name,
                profCapacity: room.profCapacity,
                residentCapacity: room.residentCapacity,
              });
              successCount++;
            } catch (updateErr: any) {
              errorCount++;
              errors.push(`Salle ${room.name}: ${updateErr.message}`);
            }
          } else {
            errorCount++;
            errors.push(`Salle ${room.name}: ${err.message}`);
          }
        }
      }

      // Afficher le résultat
      if (errorCount === 0) {
        alert(
          `✅ Synchronisation réussie !\n\n📝 ${successCount} éléments synchronisés avec le serveur.`,
        );
      } else {
        alert(
          `⚠️ Synchronisation partielle\n\n✅ ${successCount} succès\n❌ ${errorCount} erreurs\n\nVos données restent sauvegardées localement.`,
        );
        console.error("Erreurs de synchronisation:", errors);
      }
    } catch (error) {
      alert(`❌ Erreur de synchronisation: ${error}`);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importFromJSON(file);

      // Mettre à jour le state local d'abord
      if (data.profs) setProfs(data.profs);
      if (data.residents) setResidents(data.residents);
      if (data.rooms) setRooms(data.rooms);
      if (data.exams) setExams(data.exams);

      // Synchroniser avec le backend si disponible
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable) {
        try {
          let successCount = 0;
          let errorCount = 0;

          // Synchroniser les professeurs
          if (data.profs && data.profs.length > 0) {
            for (const prof of data.profs) {
              try {
                await createProfessor({
                  id: prof.id,
                  name: prof.name,
                  rank: prof.rank,
                  responsiblePromo: prof.responsiblePromo,
                  subjects: prof.subjects || [],
                  absences: prof.absences || [],
                });
                successCount++;
              } catch (err: any) {
                // Si le prof existe déjà (409), on tente une mise à jour
                if (
                  err.message?.includes("409") ||
                  err.message?.includes("existe déjà")
                ) {
                  try {
                    await updateProfessorApi(prof.id, {
                      name: prof.name,
                      rank: prof.rank,
                      responsiblePromo: prof.responsiblePromo,
                      subjects: prof.subjects || [],
                      absences: prof.absences || [],
                    });
                    successCount++;
                  } catch {
                    errorCount++;
                  }
                } else {
                  errorCount++;
                }
              }
            }
          }

          // Synchroniser les résidents
          if (data.residents && data.residents.length > 0) {
            for (const resident of data.residents) {
              try {
                await createResident({
                  id: resident.id,
                  name: resident.name,
                  level: resident.level,
                  specialty: resident.specialty,
                  absences: resident.absences || [],
                });
                successCount++;
              } catch (err: any) {
                // Si le résident existe déjà, on tente une mise à jour
                if (
                  err.message?.includes("409") ||
                  err.message?.includes("existe déjà")
                ) {
                  try {
                    await updateResidentApi(resident.id, {
                      name: resident.name,
                      level: resident.level,
                      specialty: resident.specialty,
                      absences: resident.absences || [],
                    });
                    successCount++;
                  } catch {
                    errorCount++;
                  }
                } else {
                  errorCount++;
                }
              }
            }
          }

          // Synchroniser les salles
          if (data.rooms && data.rooms.length > 0) {
            for (const room of data.rooms) {
              try {
                await createRoomApi({
                  id: room.id,
                  name: room.name,
                  profCapacity: room.profCapacity,
                  residentCapacity: room.residentCapacity,
                });
                successCount++;
              } catch (err: any) {
                if (
                  err.message?.includes("409") ||
                  err.message?.includes("existe déjà")
                ) {
                  try {
                    await updateRoomApi(room.id, {
                      name: room.name,
                      profCapacity: room.profCapacity,
                      residentCapacity: room.residentCapacity,
                    });
                    successCount++;
                  } catch {
                    errorCount++;
                  }
                } else {
                  errorCount++;
                }
              }
            }
          }

          if (errorCount > 0) {
            alert(
              `✅ Import local réussi !\n🔄 ${successCount} éléments synchronisés avec le serveur\n⚠️ ${errorCount} erreurs de synchronisation`,
            );
          } else {
            alert(
              `✅ Données importées et synchronisées avec succès !\n🔄 ${successCount} éléments enregistrés dans la base de données`,
            );
          }
        } catch (syncError) {
          alert(
            "✅ Données importées localement\n⚠️ Erreur de synchronisation avec le serveur - les données sont sauvegardées dans le navigateur",
          );
        }
      } else {
        alert(
          "✅ Données importées avec succès !\n⚠️ Serveur indisponible - les données seront synchronisées lors de la prochaine connexion",
        );
      }
    } catch (error) {
      alert(`❌ Erreur: ${error}`);
    }
    if (importJsonRef.current) importJsonRef.current.value = "";
  };

  const deleteItem = (
    id: string,
    list: any[],
    setter: (val: any[]) => void,
    itemName: string,
  ) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer "${itemName || "cet élément"}" ?`,
      )
    ) {
      (async () => {
        try {
          const backend = await syncWithBackend();
          if (backend?.isBackendAvailable) {
            // Détecter le type par la liste fournie
            if (list === profs) await deleteProfessorApi(id);
            else if (list === residents) await deleteResidentApi(id);
            else if (list === rooms) await deleteRoomApi(id);
            else if (list === exams) await deleteExamApi(id);
          }
        } catch (err) {
          console.warn("Suppression backend échouée, suppression locale", err);
        } finally {
          setter(list.filter((item) => item.id !== id));
          setSelectedIds((prev) =>
            prev.filter((selectedId) => selectedId !== id),
          ); // Retirer de la sélection s'il y était
        }
      })();
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const typeLabel = subTab === "profs" ? "enseignants" : "résidents";
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer les ${selectedIds.length} ${typeLabel} sélectionné(s) ?`,
      )
    ) {
      (async () => {
        try {
          const backend = await syncWithBackend();
          if (backend?.isBackendAvailable) {
            // Supprimer via API un par un
            for (const id of selectedIds) {
              if (subTab === "profs") await deleteProfessorApi(id);
              else if (subTab === "residents") await deleteResidentApi(id);
            }
          }
        } catch (err) {
          console.warn(
            "Suppression en masse backend a échoué (partiellement ou totalement).",
            err,
          );
        } finally {
          // Mise à jour locale
          if (subTab === "profs") {
            setProfs(profs.filter((p) => !selectedIds.includes(p.id)));
          } else if (subTab === "residents") {
            setResidents(residents.filter((r) => !selectedIds.includes(r.id)));
          }
          setSelectedIds([]);
        }
      })();
    }
  };

  const toggleSelection = (id: string, isChecked: boolean) => {
    if (isChecked) setSelectedIds([...selectedIds, id]);
    else setSelectedIds(selectedIds.filter((selId) => selId !== id));
  };

  const duplicateExam = (exam: Exam) => {
    // Create a duplicate of the exam with a new ID
    const duplicatedExam: Partial<Exam> = {
      date: exam.date,
      time: exam.time,
      duration: exam.duration,
      promo: exam.promo,
      subject: exam.subject + " (copie)",
      roomIds: exam.roomIds || [],
    };

    (async () => {
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          const created = await createExamApi(duplicatedExam);
          setExams([...exams, adaptExam(created)]);
        } else {
          // Fallback: create locally with generated ID
          const newExam: Exam = {
            ...duplicatedExam,
            id: `exam_${Date.now()}`,
          } as Exam;
          setExams([...exams, newExam]);
        }
      } catch (err) {
        console.warn("Création copie exam échouée", err);
        // Fallback: create locally
        const newExam: Exam = {
          ...duplicatedExam,
          id: `exam_${Date.now()}`,
        } as Exam;
        setExams([...exams, newExam]);
      }
    })();
  };

  const updateProf = (id: string, field: keyof Professor, value: any) => {
    (async () => {
      const newProfs = profs.map((p) =>
        p.id === id ? { ...p, [field]: value } : p,
      );
      setProfs(newProfs);
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          await updateProfessorApi(id, { [field]: value } as any);
        }
      } catch (err) {
        console.warn(
          "Mise à jour prof backend échouée, changement local appliqué",
          err,
        );
      }
    })();
  };

  const updateResident = (id: string, field: keyof Resident, value: any) => {
    (async () => {
      const newResidents = residents.map((r) =>
        r.id === id ? { ...r, [field]: value } : r,
      );
      setResidents(newResidents);
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          await updateResidentApi(id, { [field]: value } as any);
        }
      } catch (err) {
        console.warn(
          "Mise à jour resident backend échouée, changement local appliqué",
          err,
        );
      }
    })();
  };

  const updateRoom = (
    id: string,
    fieldOrUpdates: keyof Room | Partial<Room>,
    value?: any,
  ) => {
    const updates: Partial<Room> =
      typeof fieldOrUpdates === "string"
        ? { [fieldOrUpdates]: value }
        : fieldOrUpdates;

    // Mise à jour fonctionnelle de l'état local pour garantir l'atomicité absolue
    setRooms((prevRooms) =>
      prevRooms.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );

    // Envoi en une seule requête API atomique vers le backend
    (async () => {
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          await updateRoomApi(id, updates);
        }
      } catch (err) {
        console.warn(
          "Mise à jour room backend échouée, changement local appliqué",
          err,
        );
      }
    })();
  };

  const updateExam = (id: string, field: keyof Exam, value: any) => {
    (async () => {
      const newExams = exams.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      );
      setExams(newExams);
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          await updateExamApi(id, { [field]: value } as any);
        }
      } catch (err) {
        console.warn(
          "Mise à jour exam backend échouée, changement local appliqué",
          err,
        );
      }
    })();
  };

  // --- Fonctions pour les surveillants (Proctors) ---
  const updateProctorInBackend = async (id: string, data: Partial<Proctor>) => {
    try {
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable) {
        await updateProctorApi(id, data);
      }
    } catch (err) {
      console.warn("Mise à jour proctor backend échouée", err);
    }
  };

  const addNewProctor = async () => {
    const newProctor: Proctor = {
      id: `proctor_${Date.now()}`,
      name: "Nouveau surveillant",
      specialty: "",
      phone: "",
      email: "",
      is_active: 1,
    };

    try {
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable) {
        const created = await createProctorApi(newProctor);
        setProctors([...proctors, created]);
      } else {
        setProctors([...proctors, newProctor]);
      }
    } catch (err) {
      console.warn("Création proctor échouée", err);
      setProctors([...proctors, newProctor]);
    }
  };

  const deleteProctorItem = async (id: string, name: string) => {
    if (
      !confirm(`Êtes-vous sûr de vouloir supprimer le surveillant "${name}" ?`)
    ) {
      return;
    }

    try {
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable) {
        await deleteProctorApi(id);
        setProctors(proctors.filter((p) => p.id !== id));
      } else {
        setProctors(proctors.filter((p) => p.id !== id));
      }
    } catch (err) {
      console.warn("Suppression proctor échouée", err);
      setProctors(proctors.filter((p) => p.id !== id));
    }
  };

  const calculateMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  const updateDurationByEndTime = (
    examId: string,
    startTime: string,
    endTime: string,
  ) => {
    if (!startTime || !endTime) return;
    const startMins = calculateMinutes(startTime);
    const endMins = calculateMinutes(endTime);
    let diff = endMins - startMins;
    if (diff < 0) diff = 0;
    updateExam(examId, "duration", diff);
  };

  const calculateEndTime = (
    startTime: string,
    durationMinutes: number,
  ): string => {
    if (!startTime) return "";
    const [hours, minutes] = startTime.split(":").map(Number);
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

      const updatedProfs = [...profs];
      const updatedResidents = [...residents];
      let addedCount = 0;
      let updatedCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (
          !line ||
          line.startsWith("sep=") ||
          line.toLowerCase().startsWith("nom")
        )
          continue;

        const separator = line.includes(";") ? ";" : ",";
        const columns = line
          .split(separator)
          .map((c) => c.trim().replace(/^"|"$/g, ""));

        if (subTab === "profs") {
          const [name, rank, promo, ...subjects] = columns;
          if (name) {
            const cleanRank = rank?.toUpperCase() === "PR" ? "Pr" : "Dr";
            const existingProf = updatedProfs.find(
              (p) => p.name.toLowerCase() === name.toLowerCase(),
            );

            if (existingProf) {
              existingProf.rank = cleanRank;
              existingProf.subjects = subjects.filter(
                (s) => s && s.trim() !== "",
              );
              existingProf.responsiblePromo = PROMOS.includes(promo as any)
                ? (promo as Promo)
                : undefined;
              updatedCount++;
            } else {
              updatedProfs.push({
                id: `prof-${Date.now()}-${i}`,
                name,
                rank: cleanRank,
                subjects: subjects.filter((s) => s && s.trim() !== ""),
                responsiblePromo: PROMOS.includes(promo as any)
                  ? (promo as Promo)
                  : undefined,
                absences: [],
              });
              addedCount++;
            }
          }
        } else if (subTab === "residents") {
          const [name, level, specialty] = columns;
          if (name) {
            const parsedLevel = parseInt(level);
            const cleanLevel = [1, 2, 3, 4].includes(parsedLevel)
              ? (parsedLevel as 1 | 2 | 3 | 4)
              : 1;
            const existingRes = updatedResidents.find(
              (r) => r.name.toLowerCase() === name.toLowerCase(),
            );

            if (existingRes) {
              existingRes.level = cleanLevel;
              existingRes.specialty = specialty || "";
              updatedCount++;
            } else {
              updatedResidents.push({
                id: `res-${Date.now()}-${i}`,
                name,
                level: cleanLevel,
                specialty: specialty || "",
                absences: [],
              });
              addedCount++;
            }
          }
        }
      }

      if (subTab === "profs") setProfs(updatedProfs);
      else if (subTab === "residents") setResidents(updatedResidents);

      alert(
        `✅ Importation terminée !\n\n➕ Ajoutés : ${addedCount}\n🔄 Mis à jour : ${updatedCount}\n\n⚠️ N'oubliez pas de cliquer sur "Synchroniser avec le serveur" pour sauvegarder dans la base de données.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    let csv = "";
    let filename = "";

    if (subTab === "profs") {
      csv =
        "sep=;\n" +
        "Nom;Grade;Promo_Responsable;Matiere_1;Matiere_2;Matiere_3;Matiere_4\n" +
        "Alami Ahmed;Pr;FM6MD1;Anatomie;Biologie;Histologie;\n" +
        "Berrada Sarah;Dr;;Pathologie;Microbiologie;;";
      filename = "modele_enseignants.csv";
    } else {
      csv =
        "sep=;\n" +
        "Nom;Niveau;Specialite\n" +
        "Zahidi Anas;4;Orthodontie\n" +
        "Moussaoui Layla;1;Endodontie";
      filename = "modele_residents.csv";
    }

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const addAbsencesBatch = (
    personId: string,
    dates: string[],
    isPartial: boolean,
    startTime?: string,
    endTime?: string,
  ) => {
    if (!dates || dates.length === 0) return;
    if (isPartial && (!startTime || !endTime)) {
      alert("Veuillez renseigner l'heure de début et l'heure de fin.");
      return;
    }
    if (isPartial && startTime! >= endTime!) {
      alert("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const newAbsences: Absence[] = dates.map((date) =>
      isPartial ? { date, startTime, endTime } : { date },
    );

    if (subTab === "profs") {
      const prof = profs.find((p) => p.id === personId);
      if (prof) {
        const existing = prof.absences || [];
        const toAdd = newAbsences.filter(
          (na) =>
            !existing.some(
              (a) =>
                a.date === na.date &&
                (a.startTime || "") === (na.startTime || "") &&
                (a.endTime || "") === (na.endTime || ""),
            ),
        );
        if (toAdd.length > 0) {
          updateProf(personId, "absences", [...existing, ...toAdd]);
        }
      }
    } else if (subTab === "residents") {
      const res = residents.find((r) => r.id === personId);
      if (res) {
        const existing = res.absences || [];
        const toAdd = newAbsences.filter(
          (na) =>
            !existing.some(
              (a) =>
                a.date === na.date &&
                (a.startTime || "") === (na.startTime || "") &&
                (a.endTime || "") === (na.endTime || ""),
            ),
        );
        if (toAdd.length > 0) {
          updateResident(personId, "absences", [...existing, ...toAdd]);
        }
      }
    } else if (subTab === "proctors") {
      const proc = proctors.find((p) => p.id === personId);
      if (proc) {
        const existing = proc.absences || [];
        const toAdd = newAbsences.filter(
          (na) =>
            !existing.some(
              (a) =>
                a.date === na.date &&
                (a.startTime || "") === (na.startTime || "") &&
                (a.endTime || "") === (na.endTime || ""),
            ),
        );
        if (toAdd.length > 0) {
          const newAbs = [...existing, ...toAdd];
          setProctors((prev) =>
            prev.map((p) => (p.id === personId ? { ...p, absences: newAbs } : p)),
          );
          updateProctorInBackend(personId, { absences: newAbs } as any);
        }
      }
    }
  };

  const addAbsence = (
    personId: string,
    date: string,
    isPartial: boolean,
    startTime?: string,
    endTime?: string,
  ) => {
    addAbsencesBatch(personId, [date], isPartial, startTime, endTime);
  };

  const removeAbsence = (personId: string, absence: Absence) => {
    if (window.confirm("Supprimer cette période d'indisponibilité ?")) {
      if (subTab === "profs") {
        const prof = profs.find((p) => p.id === personId);
        if (prof) {
          updateProf(
            personId,
            "absences",
            prof.absences.filter(
              (a) =>
                !(
                  a.date === absence.date &&
                  a.startTime === absence.startTime &&
                  a.endTime === absence.endTime
                ),
            ),
          );
        }
      } else if (subTab === "residents") {
        const res = residents.find((r) => r.id === personId);
        if (res) {
          updateResident(
            personId,
            "absences",
            res.absences.filter(
              (a) =>
                !(
                  a.date === absence.date &&
                  a.startTime === absence.startTime &&
                  a.endTime === absence.endTime
                ),
            ),
          );
        }
      } else if (subTab === "proctors") {
        const proc = proctors.find((p) => p.id === personId);
        if (proc) {
          const newAbs = (proc.absences || []).filter(
            (a) =>
              !(
                a.date === absence.date &&
                a.startTime === absence.startTime &&
                a.endTime === absence.endTime
              ),
          );
          setProctors((prev) =>
            prev.map((p) => (p.id === personId ? { ...p, absences: newAbs } : p)),
          );
          updateProctorInBackend(personId, { absences: newAbs } as any);
        }
      }
    }
  };

  const addSubject = (profId: string, subject: string) => {
    const cleanSubject = subject.trim();
    if (!cleanSubject) return;
    const updatedProfs = profs.map((p) => {
      if (p.id === profId) {
        // Éviter les doublons
        if (!p.subjects.includes(cleanSubject)) {
          return { ...p, subjects: [...p.subjects, cleanSubject] };
        }
      }
      return p;
    });
    setProfs(updatedProfs);
    setNewSubjectInput("");

    // Synchroniser avec le backend
    (async () => {
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          const prof = updatedProfs.find((p) => p.id === profId);
          if (prof) {
            await updateProfessorApi(profId, {
              name: prof.name,
              rank: prof.rank,
              responsiblePromo: prof.responsiblePromo,
              subjects: prof.subjects,
            } as any);
          }
        }
      } catch (err) {
        console.warn("Synchronisation matière échouée", err);
      }
    })();
  };

  const addMultipleSubjects = (profId: string, subjectsToAdd: string[]) => {
    const cleanList = subjectsToAdd.map((s) => s.trim()).filter(Boolean);
    if (cleanList.length === 0) return;
    const updatedProfs = profs.map((p) => {
      if (p.id === profId) {
        const currentLower = new Set(
          p.subjects.map((s) => s.trim().toLowerCase()),
        );
        const toAppend: string[] = [];
        cleanList.forEach((s) => {
          if (!currentLower.has(s.toLowerCase())) {
            currentLower.add(s.toLowerCase());
            toAppend.push(s);
          }
        });
        if (toAppend.length === 0) return p;
        return { ...p, subjects: [...p.subjects, ...toAppend] };
      }
      return p;
    });
    setProfs(updatedProfs);
    setNewSubjectInput("");

    // Synchroniser avec le backend
    (async () => {
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          const prof = updatedProfs.find((p) => p.id === profId);
          if (prof) {
            await updateProfessorApi(profId, {
              name: prof.name,
              rank: prof.rank,
              responsiblePromo: prof.responsiblePromo,
              subjects: prof.subjects,
            } as any);
          }
        }
      } catch (err) {
        console.warn("Synchronisation matières multiples échouée", err);
      }
    })();
  };

  const removeSubject = (profId: string, subject: string) => {
    const updatedProfs = profs.map((p) => {
      if (p.id === profId) {
        return {
          ...p,
          subjects: p.subjects.filter((s) => s !== subject),
        };
      }
      return p;
    });
    setProfs(updatedProfs);

    // Synchroniser avec le backend
    (async () => {
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          const prof = updatedProfs.find((p) => p.id === profId);
          if (prof) {
            await updateProfessorApi(profId, {
              name: prof.name,
              rank: prof.rank,
              responsiblePromo: prof.responsiblePromo,
              subjects: prof.subjects,
            } as any);
          }
        }
      } catch (err) {
        console.warn("Synchronisation matière échouée", err);
      }
    })();
  };

  const formatAbsenceLabel = (absence: Absence): string => {
    const dateStr = new Date(absence.date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (absence.startTime && absence.endTime) {
      return `${dateStr} · ${absence.startTime} → ${absence.endTime}`;
    }
    return dateStr;
  };

  const conflicts = useMemo(() => {
    const map: Record<string, string[]> = {};
    exams.forEach((e1) => {
      if (!e1.date || !e1.time || !e1.subject) return;
      exams.forEach((e2) => {
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
    setExams(
      exams.map((e) => {
        if (e.id !== examId) return e;
        const currentRooms = e.roomIds || [];
        const isAlreadyIncluded = currentRooms.includes(roomId);

        // Confirmation si on retire une salle
        if (
          isAlreadyIncluded &&
          !window.confirm(
            "Retirer cette salle de l'épreuve ? Les affectations liées seront perdues.",
          )
        ) {
          return e;
        }

        const newRooms = isAlreadyIncluded
          ? currentRooms.filter((id) => id !== roomId)
          : [...currentRooms, roomId];
        return { ...e, roomIds: newRooms };
      }),
    );
  };

  // Dates uniques d'examens dans la session
  const sessionExamDates = useMemo(() => {
    const dates = Array.from(
      new Set(exams.map((e) => e.date).filter(Boolean)),
    ).sort();
    return dates;
  }, [exams]);

  const AbsenceModal = () => {
    const person =
      subTab === "profs"
        ? profs.find((p) => p.id === editingAbsenceId)
        : subTab === "residents"
          ? residents.find((r) => r.id === editingAbsenceId)
          : proctors.find((p) => p.id === editingAbsenceId);

    if (!person) return null;

    // Examens programmés à la date sélectionnée
    const examsOnSelectedDate = useMemo(() => {
      if (!absenceDateInput) return [];
      return exams
        .filter((e) => e.date === absenceDateInput && e.time)
        .sort((a, b) => a.time.localeCompare(b.time));
    }, [absenceDateInput]);

    const handleSelectPreset = (preset: "full" | "morning" | "afternoon" | "custom") => {
      setAbsenceTimePreset(preset);
      if (preset === "full") {
        setAbsenceIsPartial(false);
        setAbsenceStartTime("");
        setAbsenceEndTime("");
      } else if (preset === "morning") {
        setAbsenceIsPartial(true);
        setAbsenceStartTime("08:00");
        setAbsenceEndTime("13:00");
      } else if (preset === "afternoon") {
        setAbsenceIsPartial(true);
        setAbsenceStartTime("13:00");
        setAbsenceEndTime("18:00");
      } else {
        setAbsenceIsPartial(true);
        if (!absenceStartTime) setAbsenceStartTime("09:00");
        if (!absenceEndTime) setAbsenceEndTime("11:00");
      }
    };

    const handleSelectExamSlot = (ex: Exam) => {
      setAbsenceTimePreset("custom");
      setAbsenceIsPartial(true);
      setAbsenceStartTime(ex.time);
      setAbsenceEndTime(getExamEndStr(ex.time, ex.duration));
    };

    const handleClose = () => {
      setEditingAbsenceId(null);
      setAbsenceDateMode("single");
      setAbsenceDateInput("");
      setAbsenceDateEndInput("");
      setAbsenceTimePreset("full");
      setAbsenceIsPartial(false);
      setAbsenceStartTime("");
      setAbsenceEndTime("");
    };

    const handleAdd = () => {
      if (absenceDateMode === "single") {
        if (!absenceDateInput) {
          alert("Veuillez sélectionner une date.");
          return;
        }
        addAbsence(
          person.id,
          absenceDateInput,
          absenceIsPartial,
          absenceIsPartial ? absenceStartTime : undefined,
          absenceIsPartial ? absenceEndTime : undefined,
        );
      } else {
        if (!absenceDateInput || !absenceDateEndInput) {
          alert("Veuillez renseigner la date de début et la date de fin.");
          return;
        }
        const dates = getDatesInRange(absenceDateInput, absenceDateEndInput);
        if (dates.length === 0) {
          alert("La date de début doit être antérieure ou égale à la date de fin.");
          return;
        }
        addAbsencesBatch(
          person.id,
          dates,
          absenceIsPartial,
          absenceIsPartial ? absenceStartTime : undefined,
          absenceIsPartial ? absenceEndTime : undefined,
        );
        setAbsenceDateEndInput("");
      }
    };

    const personAbsences = Array.isArray(person.absences) ? person.absences : [];
    const sortedAbsences = [...personAbsences].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    const roleBadge = () => {
      if (subTab === "profs") {
        const p = person as Professor;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-white/15 text-indigo-100 border border-white/20">
            <span>{p.rank === "Pr" ? "Professeur" : "Docteur"}</span>
            {p.responsiblePromo && (
              <span className="text-[10px] text-amber-300 font-bold">
                • Resp {p.responsiblePromo}
              </span>
            )}
          </span>
        );
      }
      if (subTab === "residents") {
        const r = person as Resident;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-white/15 text-blue-100 border border-white/20">
            <span>R{r.level}</span>
            <span className="text-[10px] text-blue-200 font-medium">
              • {r.specialty}
            </span>
          </span>
        );
      }
      const pr = person as Proctor;
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-white/15 text-emerald-100 border border-white/20">
          <span>Surveillant</span>
          <span className="text-[10px] text-emerald-200 font-medium">
            • {pr.specialty || "Personnel"}
          </span>
        </span>
      );
    };

    const rangeDatesCount =
      absenceDateMode === "range" && absenceDateInput && absenceDateEndInput
        ? getDatesInRange(absenceDateInput, absenceDateEndInput).length
        : 0;

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
          {/* Header moderne avec dégradé Indigo */}
          <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white flex justify-between items-start shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-white/10 px-2 py-0.5 rounded-md">
                  Gestion des Indisponibilités
                </span>
                {roleBadge()}
              </div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                {person.name}
              </h3>
              <p className="text-xs text-indigo-200">
                Définissez les dates et créneaux horaires d'absence pour ce surveillant.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulaire & Liste dans conteneur défilable */}
          <div className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/40">
            {/* 1. SECTION CHOIX DU JOUR OU DE LA PÉRIODE */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-indigo-600" />
                  1. Choisir le(s) Jour(s)
                </label>
                {/* Switch Date Unique vs Période */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setAbsenceDateMode("single")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      absenceDateMode === "single"
                        ? "bg-white text-indigo-700 shadow-sm font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Date unique
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbsenceDateMode("range")}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      absenceDateMode === "range"
                        ? "bg-white text-indigo-700 shadow-sm font-black"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Période (Du... Au...)
                  </button>
                </div>
              </div>

              {/* Mode Date Unique : Puces 1-clic des dates d'examen */}
              {absenceDateMode === "single" ? (
                <div className="space-y-2">
                  {sessionExamDates.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Jours d'examens planifiés (1-clic) :
                      </span>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                        {sessionExamDates.map((d) => {
                          const isSelected = absenceDateInput === d;
                          return (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setAbsenceDateInput(d)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 ${
                                isSelected
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-200"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              <span>{formatFrenchDateShort(d)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input date personnalisée */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {sessionExamDates.length > 0 ? "Ou autre date libre :" : "Sélectionner la date :"}
                    </span>
                    <input
                      type="date"
                      value={absenceDateInput}
                      onChange={(e) => setAbsenceDateInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              ) : (
                /* Mode Période : Du ... Au ... */
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Du (Date début)
                      </span>
                      <input
                        type="date"
                        value={absenceDateInput}
                        onChange={(e) => setAbsenceDateInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Au (Date fin incluse)
                      </span>
                      <input
                        type="date"
                        value={absenceDateEndInput}
                        onChange={(e) => setAbsenceDateEndInput(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  {rangeDatesCount > 0 && (
                    <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 rounded-lg p-2 text-center">
                      ✨ {rangeDatesCount} jour(s) de congé consécutif(s) seront configurés d'un coup.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. SECTION CHOIX DU CRÉNEAU HORAIRE */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock3 className="w-4 h-4 text-indigo-600" />
                2. Choisir le Créneau d'Indisponibilité
              </label>

              {/* 4 Boutons de présets rapides */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("full")}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    absenceTimePreset === "full"
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-md ring-2 ring-indigo-200 font-black"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                  }`}
                >
                  <span className="text-sm">🌕</span>
                  <span className="text-xs">Toute la journée</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("morning")}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    absenceTimePreset === "morning"
                      ? "bg-amber-500 border-amber-500 text-white shadow-md ring-2 ring-amber-200 font-black"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                  }`}
                >
                  <Sun className={`w-4 h-4 ${absenceTimePreset === "morning" ? "text-white" : "text-amber-500"}`} />
                  <span className="text-xs">Matinée</span>
                  <span className={`text-[9px] ${absenceTimePreset === "morning" ? "text-amber-100" : "text-slate-400"}`}>08h - 13h</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("afternoon")}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    absenceTimePreset === "afternoon"
                      ? "bg-blue-600 border-blue-600 text-white shadow-md ring-2 ring-blue-200 font-black"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                  }`}
                >
                  <Moon className={`w-4 h-4 ${absenceTimePreset === "afternoon" ? "text-white" : "text-blue-500"}`} />
                  <span className="text-xs">Après-midi</span>
                  <span className={`text-[9px] ${absenceTimePreset === "afternoon" ? "text-blue-100" : "text-slate-400"}`}>13h - 18h</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectPreset("custom")}
                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                    absenceTimePreset === "custom"
                      ? "bg-purple-600 border-purple-600 text-white shadow-md ring-2 ring-purple-200 font-black"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold"
                  }`}
                >
                  <span className="text-sm">⏱️</span>
                  <span className="text-xs">Sur mesure</span>
                  <span className={`text-[9px] ${absenceTimePreset === "custom" ? "text-purple-100" : "text-slate-400"}`}>Par heure</span>
                </button>
              </div>

              {/* Épreuves du jour : 1-clic pour choisir l'horaire précis d'une épreuve */}
              {absenceDateMode === "single" && examsOnSelectedDate.length > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
                  <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Épreuves programmées ce jour-là (1-clic pour caler les heures exactes) :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {examsOnSelectedDate.map((ex) => {
                      const endStr = getExamEndStr(ex.time, ex.duration);
                      const isMatching =
                        absenceIsPartial &&
                        absenceStartTime === ex.time &&
                        absenceEndTime === endStr;
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => handleSelectExamSlot(ex)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold transition-all text-left ${
                            isMatching
                              ? "bg-amber-600 border-amber-600 text-white shadow-sm ring-2 ring-amber-200"
                              : "bg-white border-amber-200 text-amber-950 hover:bg-amber-100/60"
                          }`}
                        >
                          <span className="font-black">{ex.time} → {endStr}</span>
                          <span className={`ml-1.5 text-[10px] ${isMatching ? "text-amber-100" : "text-amber-800"}`}>
                            ({ex.promo} {ex.subject})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Saisie d'heures personnalisées */}
              {absenceTimePreset === "custom" && (
                <div className="grid grid-cols-2 gap-3 pt-1 animate-in slide-in-from-top-1 duration-150">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Heure de début
                    </span>
                    <input
                      type="time"
                      value={absenceStartTime}
                      onChange={(e) => setAbsenceStartTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Heure de fin
                    </span>
                    <input
                      type="time"
                      value={absenceEndTime}
                      onChange={(e) => setAbsenceEndTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Bouton d'ajout */}
              <button
                type="button"
                onClick={handleAdd}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-sm tracking-wide shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <ICONS.Plus className="w-4 h-4 stroke-[3]" />
                <span>
                  {absenceDateMode === "range" && rangeDatesCount > 0
                    ? `Ajouter le congé (${rangeDatesCount} jours)`
                    : absenceDateInput
                      ? `Ajouter l'indisponibilité (${formatFrenchDateShort(absenceDateInput)})`
                      : "Ajouter cette indisponibilité"}
                </span>
              </button>
            </div>

            {/* 3. SECTION LISTE DES PÉRIODES CONFIGURÉES */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-600 uppercase tracking-wider">
                  Périodes d'indisponibilité enregistrées ({sortedAbsences.length})
                </label>
              </div>

              <div className="max-h-56 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {sortedAbsences.length === 0 ? (
                  <div className="text-center py-8 bg-white border border-dashed border-slate-200 rounded-2xl p-4 text-slate-400 text-xs italic">
                    Aucune absence enregistrée. Cette personne est disponible sur toute la session.
                  </div>
                ) : (
                  sortedAbsences.map((absence, idx) => {
                    const isMorning = absence.startTime === "08:00" && absence.endTime === "13:00";
                    const isAfternoon = absence.startTime === "13:00" && absence.endTime === "18:00";
                    const isFull = !absence.startTime || !absence.endTime;

                    return (
                      <div
                        key={`${absence.date}-${absence.startTime ?? ""}-${idx}`}
                        className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isFull
                                ? "bg-indigo-50 text-indigo-600"
                                : isMorning
                                  ? "bg-amber-50 text-amber-600"
                                  : isAfternoon
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-purple-50 text-purple-600"
                            }`}
                          >
                            {isFull ? (
                              <CalendarDays className="w-4 h-4" />
                            ) : isMorning ? (
                              <Sun className="w-4 h-4" />
                            ) : isAfternoon ? (
                              <Moon className="w-4 h-4" />
                            ) : (
                              <Clock3 className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-800 block">
                              {formatFrenchDateShort(absence.date)}
                            </span>
                            <span
                              className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-md border mt-0.5 ${
                                isFull
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : isMorning
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : isAfternoon
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {isFull
                                ? "Journée entière"
                                : isMorning
                                  ? "Matin (08h00 - 13h00)"
                                  : isAfternoon
                                    ? "Après-midi (13h00 - 18h00)"
                                    : `${absence.startTime} → ${absence.endTime}`}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAbsence(person.id, absence)}
                          title="Supprimer cette indisponibilité"
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                        >
                          <ICONS.Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SubjectsModal = () => {
    const prof = profs.find((p) => p.id === editingSubjectsId);
    const [suggestionSearch, setSuggestionSearch] = useState("");
    const [selectedPromoFilter, setSelectedPromoFilter] = useState<string>("ALL");

    // Extraction et détection de toutes les matières du planning global
    const planningSubjects = useMemo(() => {
      const map = new Map<
        string,
        { name: string; promos: Set<string>; isComposite: boolean }
      >();

      exams.forEach((exam) => {
        if (!exam.subject || !exam.subject.trim()) return;
        const raw = exam.subject.trim();

        // 1. Titre complet de la matière de l'examen
        if (!map.has(raw)) {
          map.set(raw, { name: raw, promos: new Set(), isComposite: false });
        }
        if (exam.promo) {
          map.get(raw)!.promos.add(exam.promo);
        }

        // 2. Si matière composite (séparée par /), extraire également les sous-matières individuelles
        if (raw.includes("/")) {
          const parts = raw
            .split("/")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
          if (parts.length > 1) {
            parts.forEach((part) => {
              if (!map.has(part)) {
                map.set(part, { name: part, promos: new Set(), isComposite: true });
              }
              if (exam.promo) {
                map.get(part)!.promos.add(exam.promo);
              }
            });
          }
        }
      });

      return Array.from(map.values()).map((item) => ({
        name: item.name,
        promos: Array.from(item.promos),
        isComposite: item.isComposite,
      }));
    }, [exams]);

    // Promos distinctes trouvées dans le planning pour les filtres rapides
    const distinctPlanningPromos = useMemo(() => {
      const set = new Set<string>();
      planningSubjects.forEach((ps) => {
        ps.promos.forEach((pr) => set.add(pr));
      });
      return Array.from(set).sort();
    }, [planningSubjects]);

    if (!prof) return null;

    const currentSubjectLowerSet = new Set(
      (prof.subjects || []).map((s) => s.trim().toLowerCase()),
    );

    // Matières suggérées disponibles (non encore attribuées à cet enseignant)
    const availablePlanningSubjects = planningSubjects
      .filter((item) => !currentSubjectLowerSet.has(item.name.trim().toLowerCase()))
      .filter((item) => {
        if (selectedPromoFilter === "ALL") return true;
        return item.promos.includes(selectedPromoFilter as Promo);
      })
      .filter((item) => {
        if (!suggestionSearch.trim()) return true;
        const q = suggestionSearch.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.promos.some((pr) => pr.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const aIsPromo =
          prof.responsiblePromo && a.promos.includes(prof.responsiblePromo);
        const bIsPromo =
          prof.responsiblePromo && b.promos.includes(prof.responsiblePromo);
        if (aIsPromo && !bIsPromo) return -1;
        if (!aIsPromo && bIsPromo) return 1;
        return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
      });

    // Matières non encore attribuées de la promo dont l'enseignant est responsable
    const unaddedPromoSubjects = prof.responsiblePromo
      ? planningSubjects
          .filter(
            (item) =>
              item.promos.includes(prof.responsiblePromo!) &&
              !currentSubjectLowerSet.has(item.name.trim().toLowerCase()),
          )
          .map((item) => item.name)
      : [];

    const handleAddSubject = () => {
      addSubject(prof.id, newSubjectInput);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50 to-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-base uppercase tracking-tight">
                    Gestion des Matières
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {prof.rank}
                  </span>
                  {prof.responsiblePromo && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                      Resp. {prof.responsiblePromo}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 font-bold">
                  {prof.name || "Enseignant sans nom"}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingSubjectsId(null);
                setNewSubjectInput("");
              }}
              className="p-2 hover:bg-slate-200/70 rounded-full transition-colors text-slate-400 hover:text-slate-700"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form & Content */}
          <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
            {/* 1. Bloc Matières Détectées dans le Planning Global */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                      Matières détectées dans le planning global
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {planningSubjects.length > 0
                        ? `${availablePlanningSubjects.length} disponible(s) sur ${planningSubjects.length} · 1-clic pour ajouter`
                        : "Aucun examen avec matière dans le planning"}
                    </p>
                  </div>
                </div>

                {/* Bouton rapide d'ajout groupé pour promo responsable */}
                {prof.responsiblePromo && unaddedPromoSubjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      addMultipleSubjects(prof.id, unaddedPromoSubjects)
                    }
                    className="text-[11px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
                    title={`Ajouter d'un coup toutes les matières de sa promo (${prof.responsiblePromo})`}
                  >
                    <ICONS.Plus className="w-3 h-3" />
                    Tout ajouter ({unaddedPromoSubjects.length} de{" "}
                    {prof.responsiblePromo})
                  </button>
                )}
              </div>

              {/* Filtres et recherche sur les matières détectées */}
              {planningSubjects.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-slate-200/70">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={suggestionSearch}
                      onChange={(e) => setSuggestionSearch(e.target.value)}
                      placeholder="Filtrer les matières détectées..."
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    />
                    {suggestionSearch && (
                      <button
                        type="button"
                        onClick={() => setSuggestionSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title="Effacer la recherche"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filtres par promo */}
                  {distinctPlanningPromos.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black text-slate-400 uppercase mr-1">
                        Promo :
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPromoFilter("ALL")}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          selectedPromoFilter === "ALL"
                            ? "bg-slate-800 text-white shadow-sm"
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        Toutes
                      </button>
                      {distinctPlanningPromos.map((pr) => (
                        <button
                          key={pr}
                          type="button"
                          onClick={() => setSelectedPromoFilter(pr)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            selectedPromoFilter === pr
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700"
                          }`}
                        >
                          {pr}
                          {prof.responsiblePromo === pr && " ★"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Liste de badges à 1-clic */}
              <div className="max-h-40 overflow-y-auto pr-1 flex flex-wrap gap-1.5 custom-scrollbar pt-1">
                {planningSubjects.length === 0 ? (
                  <div className="text-center py-4 w-full text-xs text-slate-400 italic">
                    Aucune matière trouvée dans le planning global.
                  </div>
                ) : availablePlanningSubjects.length === 0 ? (
                  <div className="w-full text-center py-3 bg-white/80 rounded-lg border border-dashed border-emerald-200">
                    <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {suggestionSearch
                        ? "Aucune matière ne correspond à votre recherche."
                        : "Toutes les matières du planning sont déjà associées à cet enseignant !"}
                    </p>
                  </div>
                ) : (
                  availablePlanningSubjects.map((item) => {
                    const isProfPromo =
                      prof.responsiblePromo &&
                      item.promos.includes(prof.responsiblePromo);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => addSubject(prof.id, item.name)}
                        className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all text-left shadow-sm active:scale-95 ${
                          isProfPromo
                            ? "bg-emerald-50 hover:bg-emerald-600 border-emerald-300 text-emerald-950 hover:text-white ring-1 ring-emerald-300/60"
                            : "bg-white hover:bg-emerald-600 border-slate-200 hover:border-emerald-600 text-slate-700 hover:text-white"
                        }`}
                        title={`Cliquer pour ajouter "${item.name}" en 1 clic`}
                      >
                        <ICONS.Plus className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white transition-colors shrink-0" />
                        <span className="font-bold">{item.name}</span>
                        {item.promos.length > 0 && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                              isProfPromo
                                ? "bg-emerald-200 text-emerald-900 group-hover:bg-emerald-500 group-hover:text-white"
                                : "bg-slate-100 text-slate-600 group-hover:bg-emerald-500 group-hover:text-white"
                            }`}
                          >
                            {item.promos.join(", ")}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. Saisie manuelle ou avec autocomplétion datalist */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Saisie manuelle ou personnalisée
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  list="planning-subjects-datalist"
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddSubject();
                    }
                  }}
                  placeholder="Ex: Anatomie, ou choisir dans l'autocomplétion..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all"
                />
                <datalist id="planning-subjects-datalist">
                  {planningSubjects.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.promos.length > 0
                        ? `[${item.promos.join(", ")}]`
                        : ""}
                    </option>
                  ))}
                </datalist>
                <button
                  onClick={handleAddSubject}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-black hover:bg-emerald-700 transition-all active:scale-95 shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <ICONS.Plus className="w-3.5 h-3.5" />
                  AJOUTER
                </button>
              </div>
            </div>

            {/* 3. Liste des matières configurées */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Matières configurées ({prof.subjects.length})
                </label>
                {prof.subjects.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-bold">
                    Cliquer sur la corbeille pour retirer
                  </span>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                {prof.subjects.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-slate-400 italic text-xs">
                    Aucune matière enregistrée pour cet enseignant.
                    <br />
                    <span className="text-[11px] text-emerald-600 font-bold not-italic">
                      ↑ Cliquez sur une matière détectée ci-dessus pour l'ajouter en 1 clic.
                    </span>
                  </div>
                ) : (
                  prof.subjects.map((subject, idx) => {
                    const inPlanning = planningSubjects.find(
                      (ps) => ps.name.toLowerCase() === subject.toLowerCase(),
                    );

                    return (
                      <div
                        key={`${subject}-${idx}`}
                        className="flex justify-between items-center px-3 py-2 rounded-lg border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50 group transition-all"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span className="text-xs font-bold text-emerald-950 truncate">
                            {subject}
                          </span>
                          {inPlanning && inPlanning.promos.length > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-200/80 text-emerald-800 shrink-0">
                              {inPlanning.promos.join(", ")}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeSubject(prof.id, subject)}
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-md transition-all shrink-0 ml-2"
                          title="Supprimer cette matière"
                        >
                          <ICONS.Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-500">
              Total :{" "}
              <span className="text-emerald-700 font-black">
                {prof.subjects.length}
              </span>{" "}
              matière(s) associée(s)
            </span>
            <button
              onClick={() => {
                setEditingSubjectsId(null);
                setNewSubjectInput("");
              }}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-wider rounded-lg border border-slate-200 transition-all active:scale-95 shadow-sm"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {editingAbsenceId && <AbsenceModal />}
      {editingSubjectsId && <SubjectsModal />}
      <BulkResidentAbsenceModal
        isOpen={isBulkResidentAbsenceOpen}
        onClose={() => setIsBulkResidentAbsenceOpen(false)}
        residents={residents}
        setResidents={setResidents}
        exams={exams}
        initialSelectedIds={bulkResidentInitialIds}
      />
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => handleTabChange("profs")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === "profs" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Enseignants
        </button>
        <button
          onClick={() => handleTabChange("residents")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === "residents" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Résidents
        </button>
        <button
          onClick={() => handleTabChange("rooms")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === "rooms" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Salles
        </button>
        <button
          onClick={() => handleTabChange("exams")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === "exams" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Examens
        </button>
        <button
          onClick={() => handleTabChange("proctors")}
          className={`pb-2 px-1 text-sm font-medium transition-colors ${subTab === "proctors" ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-500 hover:text-slate-700"}`}
        >
          Administration
        </button>
      </div>

      {/* Top Action Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
        <h2 className="font-semibold text-slate-800 italic">
          {subTab === "profs"
            ? "Gestion des Enseignants"
            : subTab === "residents"
              ? "Gestion des Résidents"
              : subTab === "rooms"
                ? "Gestion des Salles"
                : subTab === "proctors"
                  ? "Gestion des Surveillants (Administration)"
                  : "Programmation des Épreuves"}
        </h2>

        <div className="flex items-center gap-2">
          {(subTab === "profs" || subTab === "residents") && (
            <>
              {selectedIds.length > 0 && (
                <>
                  {subTab === "residents" && (
                    <button
                      type="button"
                      onClick={() => {
                        setBulkResidentInitialIds([...selectedIds]);
                        setIsBulkResidentAbsenceOpen(true);
                      }}
                      className="flex items-center gap-1.5 p-2 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-lg text-sm font-medium transition-colors border border-amber-300 shadow-sm"
                      title="Déclarer une absence pour les résidents sélectionnés"
                    >
                      <ICONS.Calendar className="w-4 h-4 text-amber-600" />
                      <span className="hidden sm:inline">
                        Absence groupée ({selectedIds.length})
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200"
                  >
                    <ICONS.Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      Supprimer ({selectedIds.length})
                    </span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={downloadTemplate}
                title="Télécharger le modèle CSV"
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
              >
                <ICONS.Download className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-[10px] border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all"
              >
                <ICONS.Upload className="w-3.5 h-3.5" /> Importer
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileUpload}
              />
            </>
          )}

          {subTab === "exams" && (
            <>
              <button
                type="button"
                onClick={() => downloadExamTemplateExcel()}
                title="Télécharger le modèle Excel d'examens"
                className="flex items-center gap-1.5 text-[10px] border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
              >
                <ICONS.Download className="w-3.5 h-3.5 text-emerald-600" /> Modèle Excel
              </button>
              <button
                type="button"
                onClick={() => examFileInputRef.current?.click()}
                title="Importer des examens depuis Excel (.xlsx) ou CSV"
                className="flex items-center gap-1.5 text-[10px] border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
              >
                <ICONS.FileSpreadsheet className="w-3.5 h-3.5" /> Importer Excel
              </button>
              <button
                type="button"
                onClick={handleExportExamsExcel}
                title="Exporter les examens au format Excel"
                className="flex items-center gap-1.5 text-[10px] border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
              >
                <ICONS.Download className="w-3.5 h-3.5" /> Exporter Excel
              </button>
              <input
                type="file"
                ref={examFileInputRef}
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportExamsExcel}
              />
            </>
          )}

          <button
            type="button"
            onClick={handleExport}
            title="Exporter toutes les données en JSON"
            className="flex items-center gap-1.5 text-[10px] border border-cyan-200 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
          >
            <ICONS.Download className="w-3.5 h-3.5" /> Exporter
          </button>
          <button
            type="button"
            onClick={() => importJsonRef.current?.click()}
            title="Importer une sauvegarde JSON"
            className="flex items-center gap-1.5 text-[10px] border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
          >
            <ICONS.Upload className="w-3.5 h-3.5" /> Restaurer
          </button>
          <input
            type="file"
            ref={importJsonRef}
            className="hidden"
            accept=".json"
            onChange={handleImportJSON}
          />

          <button
            type="button"
            onClick={() => {
              (async () => {
                try {
                  const backend = await syncWithBackend();
                  if (backend?.isBackendAvailable) {
                    if (subTab === "profs") {
                      const created = await createProfessor({
                        name: "",
                        rank: "Dr",
                      });
                      setProfs([...profs, adaptProfessor(created)]);
                    } else if (subTab === "residents") {
                      const created = await createResident({
                        name: "",
                        level: 1,
                        specialty: "",
                      });
                      setResidents([...residents, adaptResident(created)]);
                    } else if (subTab === "rooms") {
                      const created = await createRoomApi({
                        name: `Salle ${rooms.length + 1}`,
                        profCapacity: 1,
                        residentCapacity: 2,
                        proctorCapacity: 1,
                        isActive: true,
                        adminCapacity: 1,
                        itCapacity: 0,
                        zoneLeaderCapacity: 0,
                      });
                      setRooms([...rooms, adaptRoom(created)]);
                    } else if (subTab === "proctors") {
                      await addNewProctor();
                    } else {
                      const created = await createExamApi({
                        date: "",
                        time: "",
                        duration: 120,
                        promo: "FM6MD1",
                        subject: "",
                        roomIds: [],
                      });
                      setExams([...exams, adaptExam(created)]);
                    }
                    return;
                  }
                } catch (err) {
                  console.warn(
                    "Création backend échouée, fallback local",
                    err,
                  );
                }

                // Fallback local
                const id = Date.now().toString();
                if (subTab === "profs")
                  setProfs([
                    ...profs,
                    { id, name: "", rank: "Dr", subjects: [], absences: [] },
                  ]);
                else if (subTab === "residents")
                  setResidents([
                    ...residents,
                    { id, name: "", level: 1, specialty: "", absences: [] },
                  ]);
                else if (subTab === "rooms")
                  setRooms([
                    ...rooms,
                    {
                      id,
                      name: `Salle ${rooms.length + 1}`,
                      profCapacity: 1,
                      residentCapacity: 2,
                      proctorCapacity: 1,
                    },
                  ]);
                else if (subTab === "proctors")
                  await addNewProctor();
                else
                  setExams([
                    ...exams,
                    {
                      id,
                      date: "",
                      time: "",
                      duration: 120,
                      promo: "FM6MD1",
                      subject: "",
                      roomIds: [],
                    },
                  ]);
              })();
            }}
            className="flex items-center gap-1.5 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md font-black tracking-widest uppercase shadow-md transition-all active:scale-95"
          >
            <ICONS.Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {/* 1. Section Enseignants (Profs) */}
      {subTab === "profs" && (
        <div className="space-y-4">
          {/* Header Controls: Rangs, Promo and Search */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Filtre :
              </span>
              <button
                type="button"
                onClick={() => setProfRankFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  profRankFilter === "ALL"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tous ({profs.length})
              </button>
              <button
                type="button"
                onClick={() => setProfRankFilter("Pr")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profRankFilter === "Pr"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                Professeurs (Pr) ({profs.filter((p) => p.rank === "Pr").length})
              </button>
              <button
                type="button"
                onClick={() => setProfRankFilter("Dr")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profRankFilter === "Dr"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                Docteurs (Dr) ({profs.filter((p) => p.rank === "Dr").length})
              </button>
              <button
                type="button"
                onClick={() => setProfRankFilter("RESP")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  profRankFilter === "RESP"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Resp. Promo ({profs.filter((p) => !!p.responsiblePromo).length})
              </button>
            </div>

            <div className="flex items-center gap-2.5 w-full lg:w-auto">
              <select
                value={profPromoFilter}
                onChange={(e) => setProfPromoFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Toutes les promos resp.</option>
                {PROMOS.map((pr) => (
                  <option key={pr} value={pr}>
                    Resp. {pr}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={profSearch}
                onChange={(e) => setProfSearch(e.target.value)}
                placeholder="Rechercher nom, promo, matière..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-full lg:w-56 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedProfs.length > 0 &&
                        displayedProfs.every((p) => selectedIds.includes(p.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const idsToAdd = displayedProfs.map((p) => p.id);
                          setSelectedIds(Array.from(new Set([...selectedIds, ...idsToAdd])));
                        } else {
                          const idsToRemove = new Set(displayedProfs.map((p) => p.id));
                          setSelectedIds(selectedIds.filter((id) => !idsToRemove.has(id)));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">Nom complet</th>
                  <th className="px-4 py-4">Grade</th>
                  <th className="px-4 py-4">Promo Responsable &amp; Salles</th>
                  <th className="px-4 py-4">Matières enseignées</th>
                  <th className="px-4 py-4">Exceptions &amp; Congés</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedProfs.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={(e) => toggleSelection(p.id, e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-col">
                        <input
                          className="bg-transparent font-bold text-slate-800 outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                          value={p.name}
                          onChange={(e) => updateProf(p.id, "name", e.target.value)}
                          placeholder="Nom complet..."
                        />
                        {p.responsiblePromo && (
                          <span
                            className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit mt-1 border ${PROMO_COLORS[p.responsiblePromo]}`}
                          >
                            Responsable {p.responsiblePromo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={p.rank}
                        onChange={(e) =>
                          updateProf(p.id, "rank", e.target.value as any)
                        }
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer shadow-sm transition-all ${
                          p.rank === "Pr"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}
                      >
                        <option value="Pr">Pr (Professeur)</option>
                        <option value="Dr">Dr (Docteur)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5 min-w-[170px]">
                        <select
                          value={p.responsiblePromo || ""}
                          onChange={(e) => {
                            const val = (e.target.value as Promo) || null;
                            updateProf(p.id, "responsiblePromo", val);
                            if (val && p.roomAlternation === undefined) {
                              updateProf(p.id, "roomAlternation", true);
                            }
                          }}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 outline-none cursor-pointer hover:bg-slate-100"
                        >
                          <option value="">Aucune</option>
                          {PROMOS.map((pr) => (
                            <option key={pr} value={pr}>
                              {pr}
                            </option>
                          ))}
                        </select>
                        {p.responsiblePromo && (
                          <div className="flex flex-col gap-1 mt-0.5">
                            <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Présence promo obligatoire
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateProf(
                                  p.id,
                                  "roomAlternation",
                                  !(p.roomAlternation !== false),
                                )
                              }
                              className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-all border shadow-sm ${
                                p.roomAlternation !== false
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                              }`}
                              title={
                                p.roomAlternation !== false
                                  ? "Croisement activé : alterne entre les différentes salles à chaque examen de la promo"
                                  : "Fixe activé : toujours placé dans la 1ère salle lors des examens multi-salles"
                              }
                            >
                              <span className="truncate">Croiser les salles :</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                  p.roomAlternation !== false
                                    ? "bg-indigo-600 text-white"
                                    : "bg-amber-500 text-white"
                                }`}
                              >
                                {p.roomAlternation !== false
                                  ? "Activé"
                                  : "1ère salle"}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setEditingSubjectsId(p.id)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <ICONS.BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                        {(p.subjects || []).length > 0
                          ? `${(p.subjects || []).length} matière(s)`
                          : "Ajouter matières"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setEditingAbsenceId(p.id)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <ICONS.Calendar className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                        {(p.absences || []).length} date(s)
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          deleteItem(
                            p.id,
                            profs,
                            setProfs,
                            `${p.rank}. ${p.name}`,
                          )
                        }
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {displayedProfs.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-slate-400 text-sm italic"
                    >
                      Aucun enseignant correspondant aux critères sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* CSV Help Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
            <ICONS.CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <p className="font-bold uppercase tracking-wider mb-1">
                Optimisation Excel (Colonnes A, B, C...)
              </p>
              <p className="mb-2">
                Le modèle téléchargé utilise l'instruction standard (sep=;) garantissant l'ouverture dans des cellules Excel distinctes :
              </p>
              <ul className="list-disc list-inside space-y-1 opacity-90 font-medium">
                <li>
                  <strong>Cellule A</strong> : Nom | <strong>Cellule B</strong>{" "}
                  : Grade (Pr/Dr) | <strong>Cellule C</strong> : Promo (FM6MD1..) |{" "}
                  <strong>D, E, F...</strong> : Matières enseignées
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. Section Résidents */}
      {subTab === "residents" && (
        <div className="space-y-4">
          {/* Header Controls: Niveaux, Spécialités and Search */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Niveau :
              </span>
              <button
                type="button"
                onClick={() => setResidentLevelFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  residentLevelFilter === "ALL"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tous ({residents.length})
              </button>
              {[1, 2, 3, 4].map((lvl) => {
                const count = residents.filter((r) => r.level === lvl).length;
                const colors = [
                  "",
                  "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
                  "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                  "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
                  "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
                ];
                const activeColors = [
                  "",
                  "bg-emerald-600 text-white shadow-sm",
                  "bg-blue-600 text-white shadow-sm",
                  "bg-purple-600 text-white shadow-sm",
                  "bg-amber-600 text-white shadow-sm",
                ];
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setResidentLevelFilter(lvl as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      residentLevelFilter === lvl
                        ? activeColors[lvl]
                        : colors[lvl]
                    }`}
                  >
                    R{lvl} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2.5 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => {
                  setBulkResidentInitialIds(selectedIds.length > 0 ? [...selectedIds] : []);
                  setIsBulkResidentAbsenceOpen(true);
                }}
                className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 shrink-0"
                title="Déclarer une indisponibilité groupée pour plusieurs résidents"
              >
                <ICONS.Calendar className="w-3.5 h-3.5" />
                <span>+ Absence groupée</span>
              </button>

              <select
                value={residentSpecialtyFilter}
                onChange={(e) => setResidentSpecialtyFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-none cursor-pointer max-w-[200px]"
              >
                <option value="ALL">Toutes les spécialités</option>
                {residentSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={residentSearch}
                onChange={(e) => setResidentSearch(e.target.value)}
                placeholder="Rechercher nom, spécialité..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-full lg:w-56 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        displayedResidents.length > 0 &&
                        displayedResidents.every((r) => selectedIds.includes(r.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const idsToAdd = displayedResidents.map((r) => r.id);
                          setSelectedIds(Array.from(new Set([...selectedIds, ...idsToAdd])));
                        } else {
                          const idsToRemove = new Set(displayedResidents.map((r) => r.id));
                          setSelectedIds(selectedIds.filter((id) => !idsToRemove.has(id)));
                        }
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">Nom complet</th>
                  <th className="px-4 py-4">Niveau</th>
                  <th className="px-6 py-4">Spécialité</th>
                  <th className="px-4 py-4">Exceptions &amp; Congés</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedResidents.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => toggleSelection(r.id, e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3.5">
                      <input
                        className="bg-transparent font-bold text-slate-800 outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                        value={r.name}
                        onChange={(e) => updateResident(r.id, "name", e.target.value)}
                        placeholder="Nom complet..."
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={r.level}
                        onChange={(e) =>
                          updateResident(
                            r.id,
                            "level",
                            parseInt(e.target.value) as any,
                          )
                        }
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer shadow-sm transition-all ${
                          r.level === 1
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : r.level === 2
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : r.level === 3
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {[1, 2, 3, 4].map((l) => (
                          <option key={l} value={l}>
                            R{l} (Année {l})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3.5">
                      <input
                        className="bg-transparent text-xs text-slate-700 italic outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                        value={r.specialty}
                        onChange={(e) =>
                          updateResident(r.id, "specialty", e.target.value)
                        }
                        placeholder="Spécialité..."
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setEditingAbsenceId(r.id)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                      >
                        <ICONS.Calendar className="w-3.5 h-3.5 text-slate-500 hover:text-emerald-600" />
                        {(r.absences || []).length} date(s)
                      </button>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          deleteItem(
                            r.id,
                            residents,
                            setResidents,
                            `Résident ${r.name}`,
                          )
                        }
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Supprimer"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {displayedResidents.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-400 text-sm italic"
                    >
                      Aucun résident correspondant aux critères sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* CSV Help Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3">
            <ICONS.CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <p className="font-bold uppercase tracking-wider mb-1">
                Optimisation Excel (Colonnes A, B, C...)
              </p>
              <ul className="list-disc list-inside space-y-1 opacity-90 font-medium">
                <li>
                  <strong>Cellule A</strong> : Nom | <strong>Cellule B</strong>{" "}
                  : Niveau (1-4) | <strong>Cellule C</strong> : Spécialité
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 3. Section Salles (Statut Actif/Inactif + Capacités ADM, IT, Zone) */}
      {subTab === "rooms" && (
        <div className="space-y-4">
          {/* Header Controls: Salles status, counter and Search */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Statut :
              </span>
              <button
                type="button"
                onClick={() => setRoomStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  roomStatusFilter === "ALL"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Toutes ({rooms.length})
              </button>
              <button
                type="button"
                onClick={() => setRoomStatusFilter("ACTIVE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  roomStatusFilter === "ACTIVE"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Actives ({rooms.filter((r) => r.isActive !== false).length})
              </button>
              <button
                type="button"
                onClick={() => setRoomStatusFilter("INACTIVE")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  roomStatusFilter === "INACTIVE"
                    ? "bg-slate-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-300"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                Inactives ({rooms.filter((r) => r.isActive === false).length})
              </button>
            </div>

            <div className="w-full sm:w-auto">
              <input
                type="text"
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder="Rechercher une salle..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-full sm:w-64 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-4">Salle</th>
                  <th className="px-3 py-4 text-center">Statut (Planning)</th>
                  <th className="px-3 py-4 text-center">
                    <span className="text-indigo-700 font-bold">P. Cap</span>
                    <span className="block text-[9px] text-slate-400 font-normal">Enseignants</span>
                  </th>
                  <th className="px-3 py-4 text-center">
                    <span className="text-emerald-700 font-bold">R. Cap</span>
                    <span className="block text-[9px] text-slate-400 font-normal">Résidents</span>
                  </th>
                  <th className="px-3 py-4 text-center">
                    <span className="text-sky-700 font-bold">ADM Cap</span>
                    <span className="block text-[9px] text-slate-400 font-normal">Administration</span>
                  </th>
                  <th className="px-3 py-4 text-center">
                    <span className="text-purple-700 font-bold">IT Cap</span>
                    <span className="block text-[9px] text-slate-400 font-normal">EVALBOX / IT</span>
                  </th>
                  <th className="px-3 py-4 text-center">
                    <span className="text-amber-700 font-bold">Zone Cap</span>
                    <span className="block text-[9px] text-slate-400 font-normal">Resp. Zones</span>
                  </th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedRooms.map((rm) => {
                  const isActive = rm.isActive !== false;
                  const currentAdm = rm.adminCapacity !== undefined ? rm.adminCapacity : 1;
                  const currentIt = rm.itCapacity ?? 0;
                  const currentZone = rm.zoneLeaderCapacity ?? 0;

                  return (
                    <tr
                      key={rm.id}
                      className={`transition-colors hover:bg-slate-50/70 ${
                        !isActive ? "bg-slate-50/50 opacity-70" : ""
                      }`}
                    >
                      {/* Nom de la salle */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ICONS.MapPin className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-500" : "text-slate-400"}`} />
                          <input
                            className="bg-transparent font-bold text-slate-800 text-sm outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1"
                            value={rm.name}
                            onChange={(e) => updateRoom(rm.id, "name", e.target.value)}
                            placeholder="Nom de la salle..."
                          />
                        </div>
                      </td>

                      {/* Statut Toggle */}
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newActive = !isActive;
                            updateRoom(rm.id, "isActive", newActive);
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
                            isActive
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 hover:scale-105"
                              : "bg-slate-200 text-slate-500 border border-slate-300 hover:bg-slate-300"
                          }`}
                          title={
                            isActive
                              ? "Salle active (visible sur le planning). Cliquez pour désactiver."
                              : "Salle inactive (masquée du planning). Cliquez pour activer."
                          }
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isActive
                                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                                : "bg-slate-400"
                            }`}
                          />
                          {isActive ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* P. Cap (Professeurs) */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 bg-indigo-50/60 p-1 rounded-lg border border-indigo-200/80 w-fit mx-auto shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(0, rm.profCapacity - 1);
                              updateRoom(rm.id, "profCapacity", val);
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Diminuer capacité enseignants"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={rm.profCapacity}
                            onChange={(e) =>
                              updateRoom(
                                rm.id,
                                "profCapacity",
                                Math.max(0, parseInt(e.target.value) || 0),
                              )
                            }
                            className="w-8 text-center text-xs font-black bg-transparent outline-none text-indigo-950"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = rm.profCapacity + 1;
                              updateRoom(rm.id, "profCapacity", val);
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Augmenter capacité enseignants"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* R. Cap (Résidents) */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 bg-emerald-50/60 p-1 rounded-lg border border-emerald-200/80 w-fit mx-auto shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(0, rm.residentCapacity - 1);
                              updateRoom(rm.id, "residentCapacity", val);
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Diminuer capacité résidents"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={rm.residentCapacity}
                            onChange={(e) =>
                              updateRoom(
                                rm.id,
                                "residentCapacity",
                                Math.max(0, parseInt(e.target.value) || 0),
                              )
                            }
                            className="w-8 text-center text-xs font-black bg-transparent outline-none text-emerald-950"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = rm.residentCapacity + 1;
                              updateRoom(rm.id, "residentCapacity", val);
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Augmenter capacité résidents"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* ADM Cap (Administration) */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 bg-sky-50 p-1 rounded-lg border border-sky-300 w-fit mx-auto shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(0, currentAdm - 1);
                              updateRoom(rm.id, {
                                adminCapacity: val,
                                proctorCapacity: val + currentIt + currentZone,
                              });
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Diminuer capacité Administration"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={currentAdm}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              updateRoom(rm.id, {
                                adminCapacity: val,
                                proctorCapacity: val + currentIt + currentZone,
                              });
                            }}
                            className="w-8 text-center text-xs font-black bg-transparent outline-none text-sky-950"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = currentAdm + 1;
                              updateRoom(rm.id, {
                                adminCapacity: val,
                                proctorCapacity: val + currentIt + currentZone,
                              });
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Augmenter capacité Administration"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* IT Cap (EVALBOX / IT) */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 bg-purple-50 p-1 rounded-lg border border-purple-300 w-fit mx-auto shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(0, currentIt - 1);
                              updateRoom(rm.id, {
                                itCapacity: val,
                                proctorCapacity: currentAdm + val + currentZone,
                              });
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Diminuer capacité IT / EVALBOX"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={currentIt}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              updateRoom(rm.id, {
                                itCapacity: val,
                                proctorCapacity: currentAdm + val + currentZone,
                              });
                            }}
                            className="w-8 text-center text-xs font-black bg-transparent outline-none text-purple-950"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = currentIt + 1;
                              updateRoom(rm.id, {
                                itCapacity: val,
                                proctorCapacity: currentAdm + val + currentZone,
                              });
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Augmenter capacité IT / EVALBOX"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Zone Cap (Responsables de Zones) */}
                      <td className="px-3 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 bg-amber-50 p-1 rounded-lg border border-amber-300 w-fit mx-auto shadow-sm">
                          <button
                            type="button"
                            onClick={() => {
                              const val = Math.max(0, currentZone - 1);
                              updateRoom(rm.id, {
                                zoneLeaderCapacity: val,
                                proctorCapacity: currentAdm + currentIt + val,
                              });
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Diminuer capacité Resp. de Zones"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={currentZone}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              updateRoom(rm.id, {
                                zoneLeaderCapacity: val,
                                proctorCapacity: currentAdm + currentIt + val,
                              });
                            }}
                            className="w-8 text-center text-xs font-black bg-transparent outline-none text-amber-950"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = currentZone + 1;
                              updateRoom(rm.id, {
                                zoneLeaderCapacity: val,
                                proctorCapacity: currentAdm + currentIt + val,
                              });
                            }}
                            className="w-5 h-5 rounded bg-white hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shadow-sm transition-all"
                            title="Augmenter capacité Resp. de Zones"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            deleteItem(
                              rm.id,
                              rooms,
                              setRooms,
                              `Salle ${rm.name}`,
                            )
                          }
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                          title="Supprimer la salle"
                        >
                          <ICONS.Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {displayedRooms.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-10 text-center text-slate-400 text-sm italic"
                    >
                      Aucune salle trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Explanation Callout */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex gap-3">
            <ICONS.CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs text-sky-950 leading-relaxed">
              <p className="font-bold uppercase tracking-wider mb-1">
                Configuration des Salles &amp; Capacités Détaillées
              </p>
              <ul className="list-disc list-inside space-y-1 font-medium">
                <li>
                  <strong>Statut Actif / Inactif</strong> : Permet d'inclure ou d'exclure instantanément une salle du planning global des épreuves.
                </li>
                <li>
                  <strong>P. Cap (Enseignants)</strong> : Nombre de professeurs / docteurs requis pour surveiller cette salle.
                </li>
                <li>
                  <strong>R. Cap (Résidents)</strong> : Nombre de résidents requis pour assister la surveillance.
                </li>
                <li>
                  <strong>ADM Cap (Administration)</strong> : Nombre de surveillants de l'Administration requis.
                </li>
                <li>
                  <strong>IT Cap (EVALBOX / IT)</strong> : Nombre de surveillants techniques EVALBOX / IT nécessaires.
                </li>
                <li>
                  <strong>Zone Cap (Responsables de Zones)</strong> : Nombre de coordinateurs ou responsables de zone assignés à la salle.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
      {/* 4. Section Examens */}
      {subTab === "exams" && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Examens programmés :
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                {exams.length} épreuve(s)
              </span>
            </div>

            <div className="w-full sm:w-auto">
              <input
                type="text"
                value={examSearch}
                onChange={(e) => setExamSearch(e.target.value)}
                placeholder="Rechercher matière, promo, date..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-full sm:w-64 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Épreuve / Promo</th>
                  <th className="px-6 py-4 min-w-[320px]">Planification (Date &amp; Heures)</th>
                  <th className="px-6 py-4">Salles attribuées</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedExams.map((e) => {
                  const hasConflict = !!conflicts[e.id];
                  return (
                    <tr
                      key={e.id}
                      className={`transition-colors hover:bg-slate-50/70 ${
                        hasConflict ? "bg-red-50/60" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <select
                          className={`text-[10px] font-black border rounded px-2 py-0.5 mb-1.5 block cursor-pointer ${PROMO_COLORS[e.promo]}`}
                          value={e.promo}
                          onChange={(val) =>
                            updateExam(e.id, "promo", val.target.value as any)
                          }
                        >
                          {PROMOS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <input
                          className="bg-transparent font-black outline-none w-full text-indigo-950 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                          value={e.subject}
                          onChange={(ev) =>
                            updateExam(e.id, "subject", ev.target.value)
                          }
                          placeholder="Nom de l'épreuve..."
                        />
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              value={e.date}
                              onChange={(v) =>
                                updateExam(e.id, "date", v.target.value)
                              }
                              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-bold"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Début
                            </label>
                            <input
                              type="time"
                              value={e.time}
                              onChange={(v) =>
                                updateExam(e.id, "time", v.target.value)
                              }
                              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-bold"
                            />
                          </div>
                          <div className="flex flex-col">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Fin
                            </label>
                            <input
                              type="time"
                              value={calculateEndTime(e.time, e.duration)}
                              onChange={(v) =>
                                updateDurationByEndTime(
                                  e.id,
                                  e.time,
                                  v.target.value,
                                )
                              }
                              className="bg-indigo-50 border border-indigo-100 rounded px-1.5 py-1 text-[11px] font-bold text-indigo-700"
                            />
                          </div>
                          <div className="flex flex-col ml-1">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Durée
                            </label>
                            <div className="flex items-center bg-indigo-50 border border-indigo-100 rounded overflow-hidden">
                              <button
                                type="button"
                                onClick={() => {
                                  const newDuration = Math.max(
                                    5,
                                    e.duration - 5,
                                  );
                                  updateExam(e.id, "duration", newDuration);
                                }}
                                className="px-1.5 py-1 text-[10px] font-black text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                −
                              </button>
                              <span className="text-[10px] font-black text-indigo-700 px-1.5 min-w-[48px] text-center">
                                {Math.floor(e.duration / 60)}h{e.duration % 60}m
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newDuration = e.duration + 5;
                                  updateExam(e.id, "duration", newDuration);
                                }}
                                className="px-1.5 py-1 text-[10px] font-black text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {rooms.map((room) => (
                            <button
                              key={room.id}
                              type="button"
                              onClick={() => toggleRoomInExam(e.id, room.id)}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                e.roomIds?.includes(room.id)
                                  ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                                  : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              {room.name}
                            </button>
                          ))}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={(evt) => {
                              evt.stopPropagation();
                              duplicateExam(e);
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-1.5 rounded hover:bg-indigo-50 transition-colors"
                            title="Dupliquer l'examen"
                          >
                            <ICONS.Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              deleteItem(
                                e.id,
                                exams,
                                setExams,
                                `Exam ${e.subject}`,
                              )
                            }
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                            title="Supprimer l'examen"
                          >
                            <ICONS.Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {displayedExams.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center text-slate-400 text-sm italic"
                    >
                      Aucun examen programmé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Section Administration (Proctors) */}
      {subTab === "proctors" && (
        <div className="space-y-4">
          {/* Header Controls: Categories, Status and Search */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Catégorie :
              </span>
              <button
                type="button"
                onClick={() => setProctorCategoryFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  proctorCategoryFilter === "ALL"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tous ({proctors.length})
              </button>
              <button
                type="button"
                onClick={() => setProctorCategoryFilter("Administration")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  proctorCategoryFilter === "Administration"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                Administration (
                {proctors.filter((p) => (p.specialty || "Administration") === "Administration").length}
                )
              </button>
              <button
                type="button"
                onClick={() => setProctorCategoryFilter("IT")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  proctorCategoryFilter === "IT"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                IT / EVALBOX (
                {proctors.filter((p) => p.specialty === "IT").length}
                )
              </button>
              <button
                type="button"
                onClick={() => setProctorCategoryFilter("Responsables de Zones")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  proctorCategoryFilter === "Responsables de Zones"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Resp. de Zones (
                {proctors.filter((p) => p.specialty === "Responsables de Zones").length}
                )
              </button>
              <button
                type="button"
                onClick={() => setProctorCategoryFilter("Administration & Resp. de Zones")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  proctorCategoryFilter === "Administration & Resp. de Zones"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                Double Rôle (ADM+ZONE) (
                {
                  proctors.filter((p) => {
                    const s = p.specialty || "";
                    return s.includes("Administration") && s.includes("Zones");
                  }).length
                }
                )
              </button>
            </div>

            <div className="flex items-center gap-2.5 w-full lg:w-auto">
              <select
                value={proctorStatusFilter}
                onChange={(e) => setProctorStatusFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actifs uniquement</option>
                <option value="INACTIVE">Inactifs uniquement</option>
              </select>

              <input
                type="text"
                value={proctorSearch}
                onChange={(e) => setProctorSearch(e.target.value)}
                placeholder="Rechercher nom, email..."
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-full lg:w-48 outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nom complet</th>
                  <th className="px-6 py-4">Catégorie / Rôle</th>
                  <th className="px-4 py-4 text-center">Statut</th>
                  <th className="px-4 py-4 text-center">Exceptions (Indispos)</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Téléphone</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedProctors.map((p) => {
                  const isActive =
                    p.is_active === 1 || (p.is_active as any) === true;
                  const currentCat = p.specialty || "Administration";
                  const isDual =
                    currentCat.includes("Administration") &&
                    currentCat.includes("Zones");

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors hover:bg-slate-50/70 ${
                        !isActive ? "bg-slate-50/50 opacity-70" : ""
                      }`}
                    >
                      <td className="px-6 py-3.5">
                        <input
                          className="bg-transparent font-bold text-slate-800 outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                          value={p.name}
                          onChange={(e) => {
                            const updated = proctors.map((proc) =>
                              proc.id === p.id
                                ? { ...proc, name: e.target.value }
                                : proc,
                            );
                            setProctors(updated);
                            updateProctorInBackend(p.id, {
                              name: e.target.value,
                            });
                          }}
                          placeholder="Nom..."
                        />
                      </td>

                      <td className="px-6 py-3.5">
                        <select
                          value={currentCat}
                          onChange={(e) => {
                            const newCat = e.target.value;
                            const updated = proctors.map((proc) =>
                              proc.id === p.id
                                ? { ...proc, specialty: newCat }
                                : proc,
                            );
                            setProctors(updated);
                            updateProctorInBackend(p.id, {
                              specialty: newCat,
                            });
                          }}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border outline-none cursor-pointer shadow-sm transition-all ${
                            isDual
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                              : currentCat === "IT"
                                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                : currentCat === "Responsables de Zones"
                                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                  : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
                          }`}
                        >
                          <option value="Administration">
                            Administration (Support ADM)
                          </option>
                          <option value="IT">IT (Surveillant EVALBOX)</option>
                          <option value="Responsables de Zones">
                            Responsables de Zones
                          </option>
                          <option value="Administration & Resp. de Zones">
                            Administration &amp; Resp. de Zones (Double Rôle)
                          </option>
                        </select>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newActive = isActive ? 0 : 1;
                            const updated = proctors.map((proc) =>
                              proc.id === p.id
                                ? { ...proc, is_active: newActive }
                                : proc,
                            );
                            setProctors(updated);
                            updateProctorInBackend(p.id, {
                              is_active: newActive,
                            });
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${
                            isActive
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200 hover:scale-105"
                              : "bg-slate-200 text-slate-500 border border-slate-300 hover:bg-slate-300"
                          }`}
                          title={
                            isActive
                              ? "Cliquez pour désactiver ce surveillant"
                              : "Cliquez pour activer ce surveillant"
                          }
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isActive
                                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                                : "bg-slate-400"
                            }`}
                          />
                          {isActive ? "Actif" : "Inactif"}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingAbsenceId(p.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200 hover:border-sky-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                        >
                          <ICONS.Calendar className="w-3.5 h-3.5 text-slate-500 hover:text-sky-600" />
                          {(p.absences || []).length} date(s)
                        </button>
                      </td>

                      <td className="px-6 py-3.5">
                        <input
                          className="bg-transparent text-xs text-slate-600 outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                          value={p.email || ""}
                          onChange={(e) => {
                            const updated = proctors.map((proc) =>
                              proc.id === p.id
                                ? { ...proc, email: e.target.value }
                                : proc,
                            );
                            setProctors(updated);
                            updateProctorInBackend(p.id, {
                              email: e.target.value,
                            });
                          }}
                          placeholder="email@um6ss.ma"
                        />
                      </td>

                      <td className="px-6 py-3.5">
                        <input
                          className="bg-transparent text-xs text-slate-600 outline-none w-full focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5"
                          value={p.phone || ""}
                          onChange={(e) => {
                            const updated = proctors.map((proc) =>
                              proc.id === p.id
                                ? { ...proc, phone: e.target.value }
                                : proc,
                            );
                            setProctors(updated);
                            updateProctorInBackend(p.id, {
                              phone: e.target.value,
                            });
                          }}
                          placeholder="+212 ..."
                        />
                      </td>

                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => deleteProctorItem(p.id, p.name)}
                          className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                          title="Supprimer"
                        >
                          <ICONS.Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {displayedProctors.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-slate-400 text-sm italic"
                    >
                      Aucun surveillant correspondant aux critères sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={addNewProctor}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-md transition-all active:scale-95"
            >
              <ICONS.Plus className="w-5 h-5" />
              Ajouter un membre du personnel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigTab;
