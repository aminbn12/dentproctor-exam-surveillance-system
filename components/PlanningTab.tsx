import React from "react";
import { Professor, Resident, Room, Exam, Assignment } from "../types";
import { ICONS, PROMO_COLORS } from "../constants";
import {
  suggestProctorsForExamRoom,
  isStaffAvailable,
  validateAssignment,
} from "../services/schedulerService";
import {
  syncWithBackend,
  createAssignmentApi,
  deleteAssignmentApi,
} from "../utils/apiIntegration";

interface PlanningTabProps {
  profs: Professor[];
  residents: Resident[];
  rooms: Room[];
  exams: Exam[];
  assignments: Assignment[];
  setAssignments: (a: Assignment[]) => void;
}

const PlanningTab: React.FC<PlanningTabProps> = ({
  profs,
  residents,
  rooms,
  exams,
  assignments,
  setAssignments,
}) => {
  const handleAutoFill = () => {
    (async () => {
      let newAssignments: Assignment[] = [];
      const sortedExams = [...exams]
        .filter((e) => e.date && e.time && e.subject)
        .sort(
          (a, b) =>
            new Date(`${a.date}T${a.time}`).getTime() -
            new Date(`${b.date}T${b.time}`).getTime(),
        );

      sortedExams.forEach((exam) => {
        const assignedRoomIds = exam.roomIds || [];
        rooms
          .filter((r) => assignedRoomIds.includes(r.id))
          .forEach((room) => {
            const suggestion = suggestProctorsForExamRoom(
              exam,
              room,
              profs,
              residents,
              sortedExams,
              newAssignments,
            );
            newAssignments.push({
              examId: exam.id,
              roomId: room.id,
              profIds: suggestion.profIds,
              residentIds: suggestion.residentIds,
            });
          });
      });

      setAssignments(newAssignments);

      // Persister au backend
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          const createdAssignments: Assignment[] = [];
          for (const asgn of newAssignments) {
            const created = await createAssignmentApi(asgn);
            createdAssignments.push({ ...asgn, id: created.id });
          }
          setAssignments(createdAssignments);
        }
      } catch (err) {
        console.warn(
          "Auto-fill persistence échouée, version locale conservée",
          err,
        );
      }
    })();
  };

  const getAssignment = (examId: string, roomId: string) =>
    assignments.find((a) => a.examId === examId && a.roomId === roomId);

  const updateAssignment = (
    examId: string,
    roomId: string,
    type: "prof" | "resident",
    ids: string[],
  ) => {
    (async () => {
      const existingIndex = assignments.findIndex(
        (a) => a.examId === examId && a.roomId === roomId,
      );

      let newAsgn: Assignment;
      if (existingIndex > -1) {
        newAsgn = {
          ...assignments[existingIndex],
          [type === "prof" ? "profIds" : "residentIds"]: ids,
        };
      } else {
        newAsgn = {
          examId,
          roomId,
          profIds: type === "prof" ? ids : [],
          residentIds: type === "resident" ? ids : [],
        };
      }

      // Mettre à jour le state local immédiatement
      const updatedAssignments = [...assignments];
      if (existingIndex > -1) {
        updatedAssignments[existingIndex] = newAsgn;
      } else {
        updatedAssignments.push(newAsgn);
      }
      setAssignments(updatedAssignments);

      // Persister au backend
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          // Si c'est une nouvelle affectation, la créer
          if (!existingIndex || !assignments[existingIndex]?.id) {
            const created = await createAssignmentApi(newAsgn);
            // Mettre à jour avec l'ID retourné par le backend
            newAsgn.id = created.id;
            const finalAssignments = [...updatedAssignments];
            if (existingIndex > -1) {
              finalAssignments[existingIndex] = newAsgn;
            } else {
              finalAssignments[finalAssignments.length - 1] = newAsgn;
            }
            setAssignments(finalAssignments);
          }
        }
      } catch (err) {
        console.warn(
          "Persistence assignment échouée, changement local appliqué",
          err,
        );
      }
    })();
  };

  const getEndTimeStr = (
    startTime: string,
    durationMinutes: number,
  ): string => {
    if (!startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    const date = new Date();
    date.setHours(h, m, 0);
    date.setMinutes(date.getMinutes() + durationMinutes);
    return date.toTimeString().slice(0, 5);
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir réinitialiser tout le planning ? Toutes les affectations actuelles seront supprimées.",
      )
    ) {
      (async () => {
        try {
          const backend = await syncWithBackend();
          if (backend?.isBackendAvailable) {
            // Supprimer tous les assignments au backend (ceux qui ont un ID)
            for (const asgn of assignments) {
              if (asgn.id) {
                await deleteAssignmentApi(asgn.id);
              }
            }
          }
        } catch (err) {
          console.warn(
            "Suppression backend échouée, suppression locale appliquée",
            err,
          );
        } finally {
          setAssignments([]);
        }
      })();
    }
  };

  const handleExportExcel = () => {
    // Mapping des couleurs Tailwind vers Hexadécimal pour Excel
    const promoColors: Record<string, string> = {
      FM6MD1: "#fef9c3", // yellow-100
      FM6MD2: "#dbeafe", // blue-100
      FM6MD3: "#dcfce7", // green-100
      FM6MD4: "#ffe4e6", // rose-100
      FM6MD5: "#f3e8ff", // purple-100
    };

    let tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Planning Surveillance</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000000; padding: 8px; text-align: left; vertical-align: middle; font-size: 11pt; }
          th { background-color: #4f46e5; color: white; font-weight: bold; text-align: center; }
          .centered { text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Heure</th>
              <th>Durée</th>
              <th>Promo</th>
              <th>Épreuve</th>
              <th>Salle</th>
              <th>Enseignants (Surveillants)</th>
              <th>Résidents (Surveillants)</th>
            </tr>
          </thead>
          <tbody>
    `;

    const sortedExams = [...exams]
      .filter((e) => e.date && e.time)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() -
          new Date(`${b.date}T${b.time}`).getTime(),
      );

    sortedExams.forEach((exam) => {
      const examRooms = exam.roomIds || [];

      examRooms.forEach((roomId) => {
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return;

        const assignment = assignments.find(
          (a) => a.examId === exam.id && a.roomId === roomId,
        );

        const assignedProfs =
          (assignment?.profIds ?? [])
            .map((id) => profs.find((p) => p.id === id))
            .filter(Boolean)
            .map((p) => {
              const rawName = p?.name || "";
              const cleanName = rawName
                .replace(/^(Dr\.?\s+|Pr\.?\s+|Prof\.?\s+)/i, "")
                .trim();
              const rank = (p?.rank || "").toString().replace(/\.$/, "");
              const display = rank ? `${rank} ${cleanName}` : cleanName;
              return `${display}${p?.responsiblePromo === exam.promo ? " (Resp)" : ""}`;
            })
            .join(", ") || "";

        const assignedResidents =
          (assignment?.residentIds ?? [])
            .map((id) => residents.find((r) => r.id === id))
            .filter(Boolean)
            .map((r) => `Dr. ${r?.name}`)
            .join(", ") || "";

        const bgColor = promoColors[exam.promo] || "#ffffff";

        tableContent += `
          <tr>
            <td class="centered">${exam.date}</td>
            <td class="centered">${exam.time}</td>
            <td class="centered">${Math.floor(exam.duration / 60)}h${String(exam.duration % 60).padStart(2, "0")}</td>
            <td class="centered" style="font-weight: bold; background-color: ${bgColor}">${exam.promo}</td>
            <td style="font-weight: bold;">${exam.subject}</td>
            <td class="centered">${room.name}</td>
            <td>${assignedProfs}</td>
            <td>${assignedResidents}</td>
          </tr>
        `;
      });
    });

    tableContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableContent], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Planning_Surveillances_${new Date().toISOString().split("T")[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase tracking-tighter">
            Planning Intelligent
          </h2>
          <p className="text-slate-500 text-sm italic">
            Application automatique des règles de mixité et d'expérience.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            Vider
          </button>
          <button
            onClick={handleAutoFill}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all active:scale-95"
          >
            <ICONS.Sparkles className="w-4 h-4" /> Suggestion Auto
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all active:scale-95"
          >
            <ICONS.Download className="w-4 h-4" /> Exporter Excel
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 text-left font-bold text-slate-500 w-64 sticky left-0 bg-slate-50 z-20 border-r border-slate-100 uppercase text-[11px] tracking-widest">
                Détails Épreuve
              </th>
              {rooms.map((room) => (
                <th
                  key={room.id}
                  className="p-4 text-left border-l border-slate-100 min-w-[320px]"
                >
                  <div className="flex items-center gap-2">
                    <ICONS.MapPin className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-slate-700 uppercase">
                      {room.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider block mt-1">
                    Cap: {room.profCapacity}P + {room.residentCapacity}R
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exams
              .filter((e) => e.date && e.subject)
              .map((exam) => (
                <tr key={exam.id} className="hover:bg-slate-50/30 group">
                  <td className="p-4 align-top border-r border-slate-100 sticky left-0 bg-white z-10 shadow-[2px_0_10px_rgba(0,0,0,0.03)]">
                    <div
                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-tighter mb-2 ${PROMO_COLORS[exam.promo]}`}
                    >
                      {exam.promo}
                    </div>
                    <div className="font-black text-indigo-950 leading-tight mb-2 uppercase">
                      {exam.subject}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                        <ICONS.Calendar className="w-3 h-3 text-slate-400" />
                        {exam.date}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-indigo-600">
                        <ICONS.Clock className="w-3 h-3 text-indigo-400" />
                        {exam.time} — {getEndTimeStr(exam.time, exam.duration)}
                      </div>
                    </div>
                  </td>
                  {rooms.map((room) => {
                    const isRoomUsed = exam.roomIds?.includes(room.id);
                    if (!isRoomUsed) {
                      return (
                        <td
                          key={room.id}
                          className="p-4 border-l border-slate-100 bg-slate-50/50 align-middle text-center opacity-30"
                        >
                          <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest rotate-[-12deg]">
                            Inutilisée
                          </div>
                        </td>
                      );
                    }

                    const asgn = getAssignment(exam.id, room.id);
                    const warnings = validateAssignment(
                      asgn,
                      exam,
                      room,
                      profs,
                      residents,
                    );

                    const availableProfs = profs.filter(
                      (p) =>
                        !asgn?.profIds.includes(p.id) &&
                        isStaffAvailable(p, exam, exams, assignments),
                    );
                    const availableResidents = residents.filter(
                      (r) =>
                        !asgn?.residentIds.includes(r.id) &&
                        isStaffAvailable(r, exam, exams, assignments),
                    );

                    return (
                      <td
                        key={room.id}
                        className={`p-4 border-l border-slate-100 align-top transition-colors ${warnings.length > 0 ? "bg-amber-50/30" : "group-hover:bg-indigo-50/10"}`}
                      >
                        <div className="space-y-4">
                          {warnings.length > 0 && (
                            <div className="p-2 bg-amber-100/50 border border-amber-200 rounded text-[10px] text-amber-800 font-medium space-y-1">
                              {warnings.map((w, idx) => (
                                <div
                                  key={idx}
                                  className="flex gap-1.5 items-start"
                                >
                                  <ICONS.AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>{w}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Enseignants
                              </label>
                              <span
                                className={`text-[9px] font-bold px-1.5 rounded ${(asgn?.profIds.length || 0) === room.profCapacity ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}
                              >
                                {asgn?.profIds.length || 0} /{" "}
                                {room.profCapacity}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {asgn?.profIds.map((pid) => {
                                const p = profs.find((x) => x.id === pid);
                                const isResp =
                                  p?.responsiblePromo === exam.promo;
                                return (
                                  <span
                                    key={pid}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium shadow-sm ${isResp ? "bg-indigo-600 text-white border-indigo-700" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                                  >
                                    {isResp && (
                                      <ICONS.CheckCircle2 className="w-3 h-3 text-indigo-200" />
                                    )}
                                    {p?.rank}. {p?.name}
                                    <button
                                      onClick={() => {
                                        if (
                                          window.confirm(`Retirer ${p?.name} ?`)
                                        )
                                          updateAssignment(
                                            exam.id,
                                            room.id,
                                            "prof",
                                            asgn.profIds.filter(
                                              (id) => id !== pid,
                                            ),
                                          );
                                      }}
                                      className="ml-1 opacity-60 hover:opacity-100 font-bold"
                                    >
                                      &times;
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                            <select
                              className="w-full text-[11px] p-2 border border-slate-200 rounded-lg bg-white outline-none disabled:opacity-50"
                              onChange={(e) =>
                                e.target.value &&
                                updateAssignment(exam.id, room.id, "prof", [
                                  ...(asgn?.profIds || []),
                                  e.target.value,
                                ])
                              }
                              value=""
                              disabled={
                                (asgn?.profIds.length || 0) >= room.profCapacity
                              }
                            >
                              <option value="">+ Affecter PR/DR</option>
                              {availableProfs.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.rank}. {p.name}{" "}
                                  {p.responsiblePromo === exam.promo
                                    ? "(Responsable)"
                                    : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Résidents
                              </label>
                              <span
                                className={`text-[9px] font-bold px-1.5 rounded ${(asgn?.residentIds.length || 0) === room.residentCapacity ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}
                              >
                                {asgn?.residentIds.length || 0} /{" "}
                                {room.residentCapacity}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {asgn?.residentIds.map((rid) => {
                                const r = residents.find((x) => x.id === rid);
                                return (
                                  <span
                                    key={rid}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium shadow-sm ${r?.level && r.level >= 3 ? "bg-emerald-600 text-white border-emerald-700" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                                  >
                                    R{r?.level} - {r?.name}
                                    <span className="text-[8px] opacity-70 ml-1">
                                      ({r?.specialty.substring(0, 4)}.)
                                    </span>
                                    <button
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Retirer le résident ${r?.name} ?`,
                                          )
                                        )
                                          updateAssignment(
                                            exam.id,
                                            room.id,
                                            "resident",
                                            asgn.residentIds.filter(
                                              (id) => id !== rid,
                                            ),
                                          );
                                      }}
                                      className="ml-1 opacity-60 hover:opacity-100 font-bold"
                                    >
                                      &times;
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                            <select
                              className="w-full text-[11px] p-2 border border-slate-200 rounded-lg bg-white outline-none disabled:opacity-50"
                              onChange={(e) =>
                                e.target.value &&
                                updateAssignment(exam.id, room.id, "resident", [
                                  ...(asgn?.residentIds || []),
                                  e.target.value,
                                ])
                              }
                              value=""
                              disabled={
                                (asgn?.residentIds.length || 0) >=
                                room.residentCapacity
                              }
                            >
                              <option value="">+ Affecter Résident</option>
                              {availableResidents.map((r) => (
                                <option key={r.id} value={r.id}>
                                  R{r.level} - {r.name} ({r.specialty})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanningTab;
