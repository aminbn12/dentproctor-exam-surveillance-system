import React, { useState, useEffect } from "react";
import { HistoryRecord, Professor, Resident, Room } from "../types";
import {
  fetchHistoryRecordsApi,
  deleteHistoryRecordApi,
} from "../utils/apiIntegration";
import { ICONS } from "../constants";

interface HistoryTabProps {
  profs: Professor[];
  residents: Resident[];
  rooms: Room[];
}

const HistoryTab: React.FC<HistoryTabProps> = ({ profs, residents, rooms }) => {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await fetchHistoryRecordsApi();
        setHistoryRecords(data);
      } catch (err) {
        console.error("Erreur lors du chargement de l'historique :", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  const handleDelete = async (id: number) => {
    if (
      window.confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement cette archive ?",
      )
    ) {
      try {
        await deleteHistoryRecordApi(id);
        setHistoryRecords(historyRecords.filter((record) => record.id !== id));
      } catch (err) {
        console.error("Erreur lors de la suppression :", err);
        alert("Impossible de supprimer l'archive.");
      }
    }
  };

  const exportRecordToExcel = (record: HistoryRecord) => {
    // Exact same format as PlanningTab export
    let tableContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .centered { text-align: center; }
        </style>
      </head>
      <body>
        <h2>${record.period_name}</h2>
        <p>Date d'archive: ${new Date(record.date_saved).toLocaleString("fr-FR")}</p>
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

    const sortedExams = [...record.exams_snapshot]
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

        const assignment = record.assignments_snapshot.find(
          (a) => a.examId === exam.id && a.roomId === roomId,
        );

        // Same logic as PlanningTab for professors
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

        // Same logic as PlanningTab for residents
        const assignedResidents =
          (assignment?.residentIds ?? [])
            .map((id) => residents.find((r) => r.id === id))
            .filter(Boolean)
            .map((r) => `Dr. ${r?.name}`)
            .join(", ") || "";

        const bgColor = "#ffffff";

        tableContent += `
          <tr>
            <td class="centered">${exam.date}</td>
            <td class="centered">${exam.time}</td>
            <td class="centered">${Math.floor(exam.duration / 60)}h${String(exam.duration % 60).padStart(2, "0")}</td>
            <td class="centered" style="font-weight: bold; background-color: ${bgColor}">${exam.promo}</td>
            <td style="font-weight: bold;">${exam.subject}</td>
            <td class="centered">${room.name}</td>
            <td>${assignedProfs}</}</td>
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
    link.download = `Archive_${record.period_name}_${new Date(record.date_saved).toISOString().split("T")[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Chargement de l'historique...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">
            Historique des Plannings
          </h2>
          <p className="text-slate-500 text-sm">
            Consultez et exportez les sessions de surveillance archivées.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {historyRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Aucune archive disponible.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nom de Période (Archive)</th>
                <th className="px-6 py-4">Date de sauvegarde</th>
                <th className="px-6 py-4 text-center">Épreuves Plannifiées</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyRecords.map((record) => (
                <tr
                  key={record.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-bold text-slate-700">
                    <div className="flex items-center gap-2">
                      <ICONS.Calendar className="w-4 h-4 text-indigo-500" />
                      {record.period_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(record.date_saved).toLocaleString("fr-FR")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-indigo-50 text-indigo-700 font-black px-2.5 py-1 rounded-full text-xs">
                      {record.exams_snapshot.length} Épreuves
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => exportRecordToExcel(record)}
                        className="flex items-center gap-1.5 p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-bold transition-colors border border-green-200"
                        title="Exporter vers Excel"
                      >
                        <ICONS.Download className="w-4 h-4" /> Excel
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Supprimer définitivement"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
