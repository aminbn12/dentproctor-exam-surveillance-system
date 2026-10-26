import React, { useRef, useState, useMemo } from "react";
import { Professor, Resident, Room, Exam, Assignment, Proctor } from "../types";
import { ICONS, PROMO_COLORS } from "../constants";
import { ArrowUpDown, Filter } from "lucide-react";
import {
  suggestProctorsForExamRoom,
  isStaffAvailable,
  validateAssignment,
  partitionAssignedProctors,
} from "../services/schedulerService";
import {
  syncWithBackend,
  createAssignmentApi,
  deleteAssignmentApi,
  saveHistoryRecordApi,
} from "../utils/apiIntegration";
import {
  parseExamsFromExcel,
  downloadExamTemplate,
} from "../utils/excelExamService";

interface PlanningTabProps {
  profs: Professor[];
  residents: Resident[];
  rooms: Room[];
  exams: Exam[];
  assignments: Assignment[];
  setAssignments: (a: Assignment[]) => void;
  proctors?: Proctor[];
  setExams?: (e: Exam[]) => void;
}

const isAbsentForExamSlot = (
  absences: { date: string; startTime?: string; endTime?: string }[] | undefined,
  examDate: string,
  examTime: string,
  examDuration: number,
): boolean => {
  if (!absences || absences.length === 0) return false;
  return absences.some((a) => {
    if (a.date !== examDate) return false;
    if (!a.startTime || !a.endTime) return true;
    if (!examTime) return true;
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const eStart = toMin(examTime);
    const eEnd = eStart + (examDuration || 120);
    const aStart = toMin(a.startTime);
    const aEnd = toMin(a.endTime);
    return Math.max(eStart, aStart) < Math.min(eEnd, aEnd);
  });
};

const PlanningTab: React.FC<PlanningTabProps> = ({
  profs,
  residents,
  rooms,
  exams,
  assignments,
  setAssignments,
  proctors = [],
  setExams,
}) => {
  const excelInputRef = useRef<HTMLInputElement>(null);
  // Filtrer les salles actives pour l'affichage et l'auto-suggestion
  const activeRooms = rooms.filter((r) => r.isActive !== false);

  // États pour le tri et le filtrage dynamique
  const [sortBy, setSortBy] = useState<"date" | "promo" | "subject">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedPromoFilter, setSelectedPromoFilter] = useState<string>("all");

  const filteredAndSortedExams = useMemo(() => {
    let list = exams.filter((e) => e.date && e.subject);

    // Filtre par promotion
    if (selectedPromoFilter !== "all") {
      list = list.filter((e) => e.promo === selectedPromoFilter);
    }

    // Tri
    return list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "promo") {
        cmp = (a.promo || "").localeCompare(b.promo || "");
        if (cmp === 0) {
          const dtA = `${a.date}T${a.time || "00:00"}`;
          const dtB = `${b.date}T${b.time || "00:00"}`;
          cmp = dtA.localeCompare(dtB);
        }
      } else if (sortBy === "subject") {
        cmp = (a.subject || "").localeCompare(b.subject || "");
        if (cmp === 0) {
          const dtA = `${a.date}T${a.time || "00:00"}`;
          const dtB = `${b.date}T${b.time || "00:00"}`;
          cmp = dtA.localeCompare(dtB);
        }
      } else {
        // Par défaut: date chronologique puis heure
        const dtA = `${a.date}T${a.time || "00:00"}`;
        const dtB = `${b.date}T${b.time || "00:00"}`;
        cmp = dtA.localeCompare(dtB);
        if (cmp === 0) {
          cmp = (a.promo || "").localeCompare(b.promo || "");
        }
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [exams, sortBy, sortOrder, selectedPromoFilter]);

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !setExams) return;

    try {
      const result = await parseExamsFromExcel(file, rooms);
      if (result.errors.length > 0) {
        alert("❌ Erreur d'importation :\n" + result.errors.join("\n"));
        return;
      }
      if (result.exams.length === 0) {
        alert("⚠️ Aucun examen valide trouvé dans le fichier Excel.");
        return;
      }

      const replace = window.confirm(
        `✅ ${result.exams.length} examen(s) détecté(s) dans le fichier !\n\nVoulez-vous REMPLACER le planning actuel ?\n(Cliquez sur 'Annuler' pour les AJOUTER à la suite de la liste existante)`,
      );

      const updatedExams = replace ? result.exams : [...exams, ...result.exams];
      setExams(updatedExams);

      const wantAutoFill = window.confirm(
        `🎉 ${result.exams.length} examens importés avec succès !\n\nSouhaitez-vous générer automatiquement les surveillances maintenant ?`,
      );

      if (wantAutoFill) {
        handleAutoFill(updatedExams);
      }
    } catch (err: any) {
      alert("❌ Erreur : " + err.message);
    } finally {
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const handleAutoFill = (customExams?: Exam[]) => {
    (async () => {
      let newAssignments: Assignment[] = [];
      const examsToUse = customExams || exams;
      const sortedExams = [...examsToUse]
        .filter((e) => e.date && e.time && e.subject)
        .sort(
          (a, b) =>
            new Date(`${a.date}T${a.time}`).getTime() -
            new Date(`${b.date}T${b.time}`).getTime(),
        );

      sortedExams.forEach((exam) => {
        const assignedRoomIds = exam.roomIds || [];
        rooms
          .filter((r) => assignedRoomIds.includes(r.id) && r.isActive !== false)
          .forEach((room) => {
            const suggestion = suggestProctorsForExamRoom(
              exam,
              room,
              profs,
              residents,
              sortedExams,
              newAssignments,
              proctors,
            );
            newAssignments.push({
              examId: exam.id,
              roomId: room.id,
              profIds: suggestion.profIds,
              residentIds: suggestion.residentIds,
              proctorIds: suggestion.proctorIds || [],
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
    type: "prof" | "resident" | "proctor",
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
          [type === "prof"
            ? "profIds"
            : type === "resident"
              ? "residentIds"
              : "proctorIds"]: ids,
        };
      } else {
        newAsgn = {
          examId,
          roomId,
          profIds: type === "prof" ? ids : [],
          residentIds: type === "resident" ? ids : [],
          proctorIds: type === "proctor" ? ids : [],
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

  const handleArchive = async () => {
    if (assignments.length === 0) {
      alert("Il n'y a aucune affectation à archiver.");
      return;
    }

    const periodName = prompt(
      "Entrez un nom ou une période pour cette archive (ex: Session Normale Janvier) :",
      `Planning du ${new Date().toLocaleDateString("fr-FR")}`,
    );

    if (!periodName) return;

    try {
      // 1. Sauvegarder dans l'historique
      await saveHistoryRecordApi(periodName, exams, assignments);

      // 2. Vider les affectations actuelles
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable) {
        for (const asgn of assignments) {
          if (asgn.id) await deleteAssignmentApi(asgn.id);
        }
      }
      setAssignments([]);
      alert("✅ Planning archivé avec succès et grille réinitialisée !");
    } catch (err) {
      console.error("Erreur lors de l'archivage :", err);
      alert(
        "Une erreur est survenue lors de l'archivage. Vérifiez la connexion au serveur.",
      );
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
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Feuil1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
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
               <th>Heure Début</th>
               <th>Heure Fin</th>
               <th>Promo</th>
               <th>Épreuve</th>
               <th>Salle</th>
               <th>Enseignants</th>
               <th>Résidents</th>
               <th>Administration</th>
               <th>EVALBOX / IT</th>
               <th>Resp. Zones</th>
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

    const uniqueDates: string[] = [];
    sortedExams.forEach((e) => {
      if (e.date && !uniqueDates.includes(e.date)) {
        uniqueDates.push(e.date);
      }
    });

    // Fonction pour calculer l'heure de fin
    const getEndTime = (time: string, duration: number) => {
      const [hours, minutes] = time.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
    };

    sortedExams.forEach((exam) => {
      const examRooms = exam.roomIds || [];
      const endTime = getEndTime(exam.time, exam.duration);
      const dateIdx = uniqueDates.indexOf(exam.date);
      const dayBg = dateIdx % 2 === 1 ? "#f1f5f9" : "#ffffff";
      const promoBg = promoColors[exam.promo] || "#ffffff";

      examRooms.forEach((roomId) => {
        const room = rooms.find((r) => r.id === roomId);
        if (!room || room.isActive === false) return;

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
              const promoDigit = (exam.promo || "").match(/\d+$/)?.[0] || (exam.promo || "").replace(/\D/g, "").slice(-1) || exam.promo || "";
              const respTag = p?.responsiblePromo === exam.promo ? ` (Resp ${promoDigit})` : "";
              return `${display}${respTag}`;
            })
            .join(", ") || "";

        const assignedResidents =
          (assignment?.residentIds ?? [])
            .map((id) => residents.find((r) => r.id === id))
            .filter(Boolean)
            .map((r) => {
              const rawName = r?.name || "";
              // Ajouter "Dr." uniquement si pas déjà présent
              if (/^(Dr\.?|Doctor)\s+/i.test(rawName)) {
                return rawName;
              }
              return `Dr. ${rawName}`;
            })
            .join(", ") || "";

        const assignedProctorObjs = (assignment?.proctorIds ?? [])
          .map((id) => proctors.find((p) => p.id === id))
          .filter(Boolean) as Proctor[];

        // Répartition exclusive des surveillants : chacun dans UNE SEULE colonne selon son rôle retenu
        const { adm: admProctors, it: itProctors, zone: zoneProctors } =
          partitionAssignedProctors(assignedProctorObjs, room);

        const assignedAdm = admProctors.map((p) => p.name).join(", ");
        const assignedIt = itProctors.map((p) => p.name).join(", ");
        const assignedZone = zoneProctors.map((p) => p.name).join(", ");

        tableContent += `
          <tr>
            <td class="centered" style="background-color: ${dayBg};">${exam.date}</td>
            <td class="centered" style="background-color: ${dayBg};">${exam.time}</td>
            <td class="centered" style="background-color: ${dayBg};">${endTime}</td>
            <td class="centered" style="font-weight: bold; background-color: ${promoBg};">${exam.promo}</td>
            <td style="font-weight: bold; background-color: ${promoBg};">${exam.subject}</td>
            <td class="centered" style="color: #dc2626; font-weight: bold; background-color: ${dayBg};">${room.name}</td>
            <td style="background-color: ${dayBg};">${assignedProfs}</td>
            <td style="background-color: ${dayBg};">${assignedResidents}</td>
            <td style="background-color: ${dayBg};">${assignedAdm}</td>
            <td style="background-color: ${dayBg};">${assignedIt}</td>
            <td style="background-color: ${dayBg};">${assignedZone}</td>
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

  const handleExportMacroXlsm = async () => {
    const sortedExams = [...exams]
      .filter((e) => e.date && e.time)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() -
          new Date(`${b.date}T${b.time}`).getTime(),
      );

    const getEndTime = (time: string, duration: number) => {
      const [hours, minutes] = time.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
    };

    const rows: any[] = [];

    sortedExams.forEach((exam) => {
      const examRooms = exam.roomIds || [];
      const endTime = getEndTime(exam.time, exam.duration);

      examRooms.forEach((roomId) => {
        const room = rooms.find((r) => r.id === roomId);
        if (!room || room.isActive === false) return;

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
              const promoDigit = (exam.promo || "").match(/\d+$/)?.[0] || (exam.promo || "").replace(/\D/g, "").slice(-1) || exam.promo || "";
              const respTag = p?.responsiblePromo === exam.promo ? ` (Resp ${promoDigit})` : "";
              return `${display}${respTag}`;
            })
            .join(", ") || "";

        const assignedResidents =
          (assignment?.residentIds ?? [])
            .map((id) => residents.find((r) => r.id === id))
            .filter(Boolean)
            .map((r) => {
              const rawName = r?.name || "";
              if (/^(Dr\.?|Doctor)\s+/i.test(rawName)) return rawName;
              return `Dr. ${rawName}`;
            })
            .join(", ") || "";

        const assignedProctorObjs = (assignment?.proctorIds ?? [])
          .map((id) => proctors.find((p) => p.id === id))
          .filter(Boolean) as Proctor[];

        const { adm: admProctors, it: itProctors, zone: zoneProctors } =
          partitionAssignedProctors(assignedProctorObjs, room);

        rows.push({
          date: exam.date,
          time: exam.time,
          endTime,
          promo: exam.promo,
          subject: exam.subject,
          room: room.name,
          profs: assignedProfs,
          residents: assignedResidents,
          adm: admProctors.map((p) => p.name).join(", "),
          it: itProctors.map((p) => p.name).join(", "),
          zone: zoneProctors.map((p) => p.name).join(", "),
        });
      });
    });

    try {
      const response = await fetch("/api/exams/export-macro-xlsm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (!response.ok) throw new Error("Erreur export macro");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Planning_Surveillances_Macro_${new Date().toISOString().split("T")[0]}.xlsm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn("Export macro via API échoué, téléchargement direct du modèle", err);
      const link = document.createElement("a");
      link.href = "/Modele_Planning_Surveillance.xlsm";
      link.download = "Modele_Planning_Surveillance.xlsm";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-end">
          {setExams && (
            <>
              <button
                onClick={() => downloadExamTemplate()}
                title="Télécharger le modèle Excel d'examens"
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 px-3 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
              >
                <ICONS.Download className="w-4 h-4 text-emerald-600" /> Modèle Excel
              </button>
              <button
                onClick={() => excelInputRef.current?.click()}
                title="Importer un fichier Excel (.xlsx, .xls) ou CSV d'examens"
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
              >
                <ICONS.FileSpreadsheet className="w-4 h-4" /> Importer Examens
              </button>
              <input
                type="file"
                ref={excelInputRef}
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleImportExcel}
              />
            </>
          )}
          <button
            onClick={handleClearAll}
            title="Effacer la grille actuelle"
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            Vider
          </button>
          <button
            onClick={handleArchive}
            title="Sauvegarder dans l'historique et vider la grille"
            className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all"
          >
            <ICONS.Calendar className="w-4 h-4" /> Archiver
          </button>
          <button
            onClick={() => handleAutoFill()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all active:scale-95"
          >
            <ICONS.Sparkles className="w-4 h-4" /> Suggestion Auto
          </button>
          <button
            onClick={handleExportExcel}
            title="Exporter les données actuelles au format Excel (Feuil1 compatible macro)"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition-all active:scale-95"
          >
            <ICONS.Download className="w-4 h-4" /> Exporter Excel
          </button>
          <button
            type="button"
            onClick={handleExportMacroXlsm}
            title="Extraire le planning complet dans un classeur Excel avec Macro VBA intégrée (.xlsm)"
            className="flex items-center gap-2 bg-purple-50 border border-purple-300 hover:bg-purple-100 text-purple-800 px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
          >
            <ICONS.FileSpreadsheet className="w-4 h-4 text-purple-600" /> Modèle Macro (.xlsm)
          </button>
        </div>
      </div>

      {/* Barre d'organisation & de filtrage dynamique */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Groupe 1 : Tri */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-500" />
            Organiser par :
          </span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setSortBy("date")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                sortBy === "date"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📅 Date &amp; Heure
            </button>
            <button
              type="button"
              onClick={() => setSortBy("promo")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                sortBy === "promo"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🎓 Promotion
            </button>
            <button
              type="button"
              onClick={() => setSortBy("subject")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                sortBy === "subject"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📚 Épreuve
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            title={
              sortOrder === "asc"
                ? "Ordre croissant (cliquer pour inverser)"
                : "Ordre décroissant (cliquer pour inverser)"
            }
            className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <ArrowUpDown className="w-3 h-3 text-slate-500" />
            <span>{sortOrder === "asc" ? "Croissant (A-Z)" : "Décroissant (Z-A)"}</span>
          </button>
        </div>

        {/* Groupe 2 : Filtre par Promotion */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Promo :
          </span>
          <button
            type="button"
            onClick={() => setSelectedPromoFilter("all")}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
              selectedPromoFilter === "all"
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            Toutes
          </button>
          {(["FM6MD1", "FM6MD2", "FM6MD3", "FM6MD4", "FM6MD5"] as const).map(
            (pr) => {
              const isSelected = selectedPromoFilter === pr;
              return (
                <button
                  key={pr}
                  type="button"
                  onClick={() =>
                    setSelectedPromoFilter(isSelected ? "all" : pr)
                  }
                  className={`px-2.5 py-1 text-xs font-black rounded-lg border uppercase tracking-tight transition-all ${
                    isSelected
                      ? "ring-2 ring-indigo-500 ring-offset-1 shadow-xs " +
                        PROMO_COLORS[pr]
                      : "opacity-70 hover:opacity-100 " + PROMO_COLORS[pr]
                  }`}
                >
                  {pr}
                </button>
              );
            },
          )}
          <span className="text-[11px] font-semibold text-slate-400 ml-1">
            ({filteredAndSortedExams.length} épreuve
            {filteredAndSortedExams.length > 1 ? "s" : ""})
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto overflow-y-auto max-h-[calc(100vh-210px)] relative">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-30 bg-slate-50 shadow-xs border-b border-slate-200">
            <tr className="bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
              <th className="p-3.5 text-left font-bold text-slate-600 w-56 min-w-[220px] sticky top-0 left-0 bg-slate-100/95 backdrop-blur-xs z-40 border-r border-b border-slate-200 uppercase text-[11px] tracking-wider shadow-[2px_0_6px_rgba(0,0,0,0.06)]">
                Détails Épreuve
              </th>
              <th className="p-2 text-left font-bold text-slate-600 sticky top-0 bg-slate-100/95 backdrop-blur-xs z-30 border-r border-b border-slate-200 uppercase text-[10px] tracking-wider w-44 min-w-[165px] max-w-[190px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                Exceptions / Indispos
              </th>
              {activeRooms.map((room) => {
                const admCap =
                  room.adminCapacity !== undefined
                    ? room.adminCapacity
                    : room.proctorCapacity !== undefined
                      ? room.proctorCapacity
                      : 1;
                const itCap = room.itCapacity ?? 0;
                const zoneCap = room.zoneLeaderCapacity ?? 0;
                const adminParts: string[] = [];
                if (admCap > 0) adminParts.push(`${admCap} ADM`);
                if (itCap > 0) adminParts.push(`${itCap} IT`);
                if (zoneCap > 0) adminParts.push(`${zoneCap} ZONE`);
                const adminText =
                  adminParts.length > 0 ? adminParts.join(" + ") : "0 ADM";

                return (
                  <th
                    key={room.id}
                    className="p-3 text-left border-l border-b border-slate-200 sticky top-0 bg-slate-50/95 backdrop-blur-xs z-30 min-w-[220px] max-w-[280px] shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <ICONS.MapPin className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="font-bold text-slate-700 uppercase text-xs truncate">
                        {room.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal uppercase tracking-wider block mt-1">
                      Cap: {room.profCapacity}P + {room.residentCapacity}R + {adminText}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAndSortedExams.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + activeRooms.length}
                  className="p-12 text-center text-slate-400 text-sm font-semibold italic bg-slate-50/20"
                >
                  Aucune épreuve trouvée avec les filtres sélectionnés.
                </td>
              </tr>
            ) : (
              filteredAndSortedExams.map((exam) => {
                const absentProfs = profs.filter((p) =>
                  isAbsentForExamSlot(p.absences, exam.date, exam.time, exam.duration),
                );
                const absentResidents = residents.filter((r) =>
                  isAbsentForExamSlot(r.absences, exam.date, exam.time, exam.duration),
                );
                const absentProctors = proctors.filter((p) =>
                  isAbsentForExamSlot(p.absences, exam.date, exam.time, exam.duration),
                );
                const totalAbsent =
                  absentProfs.length + absentResidents.length + absentProctors.length;

                return (
                <tr key={exam.id} className="hover:bg-slate-50/30 group">
                  <td className="p-3.5 align-top border-r border-slate-100 sticky left-0 bg-white z-20 shadow-[2px_0_10px_rgba(0,0,0,0.04)]">
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

                  {/* Colonne Exceptions & Indisponibilités - Format optimisé sans coupure */}
                  <td className="p-2 align-top border-r border-slate-100 bg-slate-50/20 w-44 min-w-[165px] max-w-[190px]">
                    {totalAbsent === 0 ? (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded px-1.5 py-1 font-bold">
                        <ICONS.CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>Aucune</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-[9px] font-black text-amber-800 bg-amber-50 border border-amber-200/80 rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>{totalAbsent} indispo(s)</span>
                        </div>
                        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto pr-1 pb-1.5 custom-scrollbar">
                          {absentProfs.map((p) => (
                            <span
                              key={p.id}
                              className="text-[9px] px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 font-medium truncate block leading-relaxed"
                              title={`Enseignant: ${p.rank}. ${p.name}`}
                            >
                              <strong>{p.rank}</strong> {p.name}
                            </span>
                          ))}
                          {absentResidents.map((r) => (
                            <span
                              key={r.id}
                              className="text-[9px] px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium truncate block leading-relaxed"
                              title={`Résident: R${r.level} ${r.name} (${r.specialty})`}
                            >
                              <strong>R{r.level}</strong> {r.name}
                            </span>
                          ))}
                          {absentProctors.map((pr) => {
                            const cat = pr.specialty || "Administration";
                            const isDual =
                              cat.includes("Administration") &&
                              cat.includes("Zones");
                            const tag = isDual
                              ? "ADM+ZONE"
                              : cat === "IT"
                                ? "IT"
                                : cat === "Responsables de Zones"
                                  ? "ZONE"
                                  : "ADM";
                            return (
                              <span
                                key={pr.id}
                                className="text-[9px] px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-medium truncate block leading-relaxed"
                                title={`Personnel: [${tag}] ${pr.name}`}
                              >
                                <strong>[{tag}]</strong> {pr.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </td>
                  {activeRooms.map((room) => {
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
                      exams,
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
                    const availableProctors = proctors.filter(
                      (p) =>
                        (p.is_active === 1 || (p.is_active as any) === true) &&
                        !(asgn?.proctorIds || []).includes(p.id) &&
                        isStaffAvailable(p, exam, exams, assignments),
                    );

                    return (
                      <td
                        key={room.id}
                        className={`p-3 border-l border-slate-100 align-top transition-colors ${warnings.length > 0 ? "bg-amber-50/30" : "group-hover:bg-indigo-50/10"}`}
                      >
                        <div className="space-y-3">
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
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium shadow-sm w-full truncate ${isResp ? "bg-indigo-600 text-white border-indigo-700" : "bg-blue-50 text-blue-700 border-blue-200"}`}
                                  >
                                    {isResp && (
                                      <ICONS.CheckCircle2 className="w-3 h-3 text-indigo-200 shrink-0" />
                                    )}
                                    <span className="truncate flex-1">
                                      {p?.rank}. {p?.name}
                                    </span>
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
                              className="w-full text-[10px] p-1.5 border border-slate-200 rounded-md bg-white outline-none disabled:opacity-50"
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
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium shadow-sm w-full truncate ${r?.level && r.level >= 3 ? "bg-emerald-600 text-white border-emerald-700" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}
                                  >
                                    <span className="shrink-0">
                                      R{r?.level} -
                                    </span>
                                    <span className="truncate flex-1">
                                      {r?.name}
                                    </span>
                                    <span className="text-[8px] opacity-70 shrink-0">
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
                              className="w-full text-[10px] p-1.5 border border-slate-200 rounded-md bg-white outline-none disabled:opacity-50"
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

                          {/* Administration / Surveillants section */}
                          {(() => {
                            const admCap =
                              room.adminCapacity !== undefined
                                ? room.adminCapacity
                                : 1;
                            const itCap = room.itCapacity ?? 0;
                            const zoneCap = room.zoneLeaderCapacity ?? 0;
                            const targetProctorCap =
                              room.proctorCapacity !== undefined && room.proctorCapacity > 0
                                ? room.proctorCapacity
                                : admCap + itCap + zoneCap || 1;

                            const assignedProctorObjs = (asgn?.proctorIds || [])
                              .map((id) => proctors.find((x) => x.id === id))
                              .filter(Boolean) as Proctor[];

                            // Partitionnement exclusif selon les quotas de la salle
                            const {
                              adm: admProctors,
                              it: itProctors,
                              zone: zoneProctors,
                            } = partitionAssignedProctors(assignedProctorObjs, room);

                            const admCount = admProctors.length;
                            const itCount = itProctors.length;
                            const zoneCount = zoneProctors.length;

                            return (
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Administration &amp; Support
                                  </label>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 rounded ${(asgn?.proctorIds || []).length >= targetProctorCap ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50"}`}
                                  >
                                    {(asgn?.proctorIds || []).length} / {targetProctorCap}
                                  </span>
                                </div>

                                {/* Quotas détaillés : ADM, IT, Resp. Zones */}
                                <div className="flex items-center gap-1 mb-2 text-[9px] font-bold">
                                  <span
                                    className={`px-1.5 py-0.5 rounded border ${
                                      admCount >= admCap
                                        ? "bg-sky-100 text-sky-800 border-sky-300"
                                        : "bg-sky-50 text-sky-700 border-sky-200"
                                    }`}
                                    title="Surveillants Administration requis"
                                  >
                                    ADM: {admCount}/{admCap}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded border ${
                                      itCount >= itCap
                                        ? "bg-purple-100 text-purple-800 border-purple-300"
                                        : "bg-purple-50 text-purple-700 border-purple-200"
                                    }`}
                                    title="Surveillants EVALBOX / IT requis"
                                  >
                                    IT: {itCount}/{itCap}
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded border ${
                                      zoneCount >= zoneCap
                                        ? "bg-amber-100 text-amber-800 border-amber-300"
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    }`}
                                    title="Responsables de Zones requis"
                                  >
                                    ZONE: {zoneCount}/{zoneCap}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {(asgn?.proctorIds || []).map((pid) => {
                                    const p = proctors.find((x) => x.id === pid);
                                    const isZone = zoneProctors.some((z) => z.id === pid);
                                    const isIt = itProctors.some((it) => it.id === pid);
                                    const role = isZone ? "ZONE" : isIt ? "IT" : "ADM";

                                    const badgeStyle =
                                      role === "ZONE"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : role === "IT"
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-sky-50 text-sky-700 border-sky-200";

                                    return (
                                      <span
                                        key={pid}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium shadow-sm w-full truncate ${badgeStyle}`}
                                      >
                                        <span className="font-bold text-[8px] uppercase px-1 py-0.2 rounded bg-white/80 shrink-0 border border-current/20">
                                          {role}
                                        </span>
                                        <span className="truncate flex-1 font-semibold">
                                          {p?.name}
                                        </span>
                                        <button
                                          onClick={() => {
                                            if (
                                              window.confirm(
                                                `Retirer ${p?.name} ?`,
                                              )
                                            )
                                              updateAssignment(
                                                exam.id,
                                                room.id,
                                                "proctor",
                                                (asgn.proctorIds || []).filter(
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
                                  className="w-full text-[10px] p-1.5 border border-slate-200 rounded-md bg-white outline-none disabled:opacity-50"
                                  onChange={(e) =>
                                    e.target.value &&
                                    updateAssignment(
                                      exam.id,
                                      room.id,
                                      "proctor",
                                      [
                                        ...(asgn?.proctorIds || []),
                                        e.target.value,
                                      ],
                                    )
                                  }
                                  value=""
                                  disabled={
                                    (asgn?.proctorIds || []).length >= targetProctorCap
                                  }
                                >
                                  <option value="">+ Affecter Surveillant / Support</option>
                                  {availableProctors.map((p) => {
                                    const cat = p.specialty || "Administration";
                                    const isDual =
                                      cat.includes("Administration") &&
                                      cat.includes("Zones");
                                    const tag = isDual
                                      ? "[ADM+ZONE]"
                                      : cat === "IT"
                                        ? "[IT]"
                                        : cat === "Responsables de Zones"
                                          ? "[Zone]"
                                          : "[ADM]";
                                    return (
                                      <option key={p.id} value={p.id}>
                                        {tag} {p.name}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PlanningTab;
