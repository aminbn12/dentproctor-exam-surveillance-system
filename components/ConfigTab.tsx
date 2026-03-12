import React, { useState, useRef, useMemo } from "react";
import { Absence } from "../types";
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
  profs,
  setProfs,
  residents,
  setResidents,
  rooms,
  setRooms,
  exams,
  setExams,
}) => {
  const [subTab, setSubTab] = useState<
    "profs" | "residents" | "rooms" | "exams"
  >("profs");
  const [editingAbsenceId, setEditingAbsenceId] = useState<string | null>(null);
  const [absenceIsPartial, setAbsenceIsPartial] = useState(false);
  const [absenceStartTime, setAbsenceStartTime] = useState("");
  const [absenceEndTime, setAbsenceEndTime] = useState("");
  const [absenceDateInput, setAbsenceDateInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);

  // Vider la sélection quand on change d'onglet
  const handleTabChange = (newTab: "profs" | "residents" | "rooms" | "exams") => {
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
          setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id)); // Retirer de la sélection s'il y était
        }
      })();
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const typeLabel = subTab === "profs" ? "enseignants" : "résidents";
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer les ${selectedIds.length} ${typeLabel} sélectionné(s) ?`)) {
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
          console.warn("Suppression en masse backend a échoué (partiellement ou totalement).", err);
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

  const updateRoom = (id: string, field: keyof Room, value: any) => {
    (async () => {
      const newRooms = rooms.map((r) =>
        r.id === id ? { ...r, [field]: value } : r,
      );
      setRooms(newRooms);
      try {
        const backend = await syncWithBackend();
        if (backend?.isBackendAvailable) {
          await updateRoomApi(id, { [field]: value } as any);
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
              (p) => p.name.toLowerCase() === name.toLowerCase()
            );

            if (existingProf) {
              existingProf.rank = cleanRank;
              existingProf.subjects = subjects.filter((s) => s && s.trim() !== "");
              existingProf.responsiblePromo = PROMOS.includes(promo as any)
                ? promo as Promo
                : undefined;
              updatedCount++;
            } else {
              updatedProfs.push({
                id: `prof-${Date.now()}-${i}`,
                name,
                rank: cleanRank,
                subjects: subjects.filter((s) => s && s.trim() !== ""),
                responsiblePromo: PROMOS.includes(promo as any)
                  ? promo as Promo
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
            const cleanLevel = [1, 2, 3, 4].includes(parsedLevel) ? parsedLevel as 1|2|3|4 : 1;
            const existingRes = updatedResidents.find(
              (r) => r.name.toLowerCase() === name.toLowerCase()
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
        `✅ Importation terminée !\n\n➕ Ajoutés : ${addedCount}\n🔄 Mis à jour : ${updatedCount}\n\n⚠️ N'oubliez pas de cliquer sur "Synchroniser avec le serveur" pour sauvegarder dans la base de données.`
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

  const addAbsence = (
    personId: string,
    date: string,
    isPartial: boolean,
    startTime?: string,
    endTime?: string,
  ) => {
    if (!date) return;
    if (isPartial && (!startTime || !endTime)) {
      alert("Veuillez renseigner l'heure de début et l'heure de fin.");
      return;
    }
    if (isPartial && startTime! >= endTime!) {
      alert("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const newAbsence: Absence = isPartial
      ? { date, startTime, endTime }
      : { date };

    if (subTab === "profs") {
      const prof = profs.find((p) => p.id === personId);
      if (prof) {
        // Eviter les doublons exacts
        const isDuplicate = prof.absences.some(
          (a) => a.date === date && a.startTime === startTime && a.endTime === endTime,
        );
        if (!isDuplicate)
          updateProf(personId, "absences", [...prof.absences, newAbsence]);
      }
    } else {
      const res = residents.find((r) => r.id === personId);
      if (res) {
        const isDuplicate = res.absences.some(
          (a) => a.date === date && a.startTime === startTime && a.endTime === endTime,
        );
        if (!isDuplicate)
          updateResident(personId, "absences", [...res.absences, newAbsence]);
      }
    }
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
              (a) => !(a.date === absence.date && a.startTime === absence.startTime && a.endTime === absence.endTime),
            ),
          );
        }
      } else {
        const res = residents.find((r) => r.id === personId);
        if (res) {
          updateResident(
            personId,
            "absences",
            res.absences.filter(
              (a) => !(a.date === absence.date && a.startTime === absence.startTime && a.endTime === absence.endTime),
            ),
          );
        }
      }
    }
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

  const AbsenceModal = () => {
    const person =
      subTab === "profs"
        ? profs.find((p) => p.id === editingAbsenceId)
        : residents.find((r) => r.id === editingAbsenceId);

    if (!person) return null;

    const handleAdd = () => {
      addAbsence(
        person.id,
        absenceDateInput,
        absenceIsPartial,
        absenceIsPartial ? absenceStartTime : undefined,
        absenceIsPartial ? absenceEndTime : undefined,
      );
      // Reset form
      setAbsenceDateInput("");
      setAbsenceStartTime("");
      setAbsenceEndTime("");
      setAbsenceIsPartial(false);
    };

    const sortedAbsences = [...person.absences].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30">
            <div>
              <h3 className="font-black text-indigo-950 uppercase tracking-tight">
                Exceptions &amp; Congés
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {person.name}
              </p>
            </div>
            <button
              onClick={() => { setEditingAbsenceId(null); setAbsenceIsPartial(false); setAbsenceDateInput(""); setAbsenceStartTime(""); setAbsenceEndTime(""); }}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <ICONS.Plus className="w-5 h-5 rotate-45 text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                Ajouter une période d'indisponibilité
              </label>

              {/* Date */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</span>
                <input
                  type="date"
                  value={absenceDateInput}
                  onChange={(e) => setAbsenceDateInput(e.target.value)}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Toggle Partielle */}
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <div
                  onClick={() => setAbsenceIsPartial(!absenceIsPartial)}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                    absenceIsPartial ? "bg-indigo-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                      absenceIsPartial ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </div>
                <span className="text-xs font-bold text-slate-600">
                  Indisponibilité partielle <span className="text-slate-400 font-normal">(par heure)</span>
                </span>
              </label>

              {/* Heures — affichées uniquement si partielle */}
              {absenceIsPartial && (
                <div className="flex gap-3 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heure début</span>
                    <input
                      type="time"
                      value={absenceStartTime}
                      onChange={(e) => setAbsenceStartTime(e.target.value)}
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Heure fin</span>
                    <input
                      type="time"
                      value={absenceEndTime}
                      onChange={(e) => setAbsenceEndTime(e.target.value)}
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleAdd}
                className="w-full bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-black hover:bg-indigo-700 transition-all active:scale-95"
              >
                + AJOUTER
              </button>
            </div>

            {/* Liste des absences */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Périodes configurées
              </label>
              <div className="max-h-52 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                {sortedAbsences.length === 0 ? (
                  <div className="text-center py-6 text-slate-300 italic text-xs">
                    Aucune absence enregistrée
                  </div>
                ) : (
                  sortedAbsences.map((absence, idx) => (
                    <div
                      key={`${absence.date}-${absence.startTime ?? ""}-${idx}`}
                      className={`flex justify-between items-center p-2.5 rounded-lg border group ${
                        absence.startTime
                          ? "bg-amber-50 border-amber-100"
                          : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ICONS.Calendar className={`w-3.5 h-3.5 ${absence.startTime ? "text-amber-400" : "text-indigo-400"}`} />
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">
                            {formatAbsenceLabel(absence)}
                          </span>
                          {absence.startTime && (
                            <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wide">
                              Partielle
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeAbsence(person.id, absence)}
                        className="text-slate-300 hover:text-red-500 p-1 rounded-md transition-colors"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => { setEditingAbsenceId(null); setAbsenceIsPartial(false); setAbsenceDateInput(""); setAbsenceStartTime(""); setAbsenceEndTime(""); }}
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
            >
              Terminer la gestion
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {editingAbsenceId && <AbsenceModal />}
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
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center bg-slate-50/50 gap-4">
          <h2 className="font-semibold text-slate-800 italic">
            {subTab === "profs"
              ? "Gestion des Enseignants"
              : subTab === "residents"
                ? "Gestion des Résidents"
                : subTab === "rooms"
                  ? "Gestion des Salles"
                  : "Programmation des Épreuves"}
          </h2>

          <div className="flex items-center gap-2">
            {(subTab === "profs" || subTab === "residents") && (
              <>
                {selectedIds.length > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    className="flex items-center gap-1.5 p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200"
                  >
                    <ICONS.Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Supprimer ({selectedIds.length})</span>
                  </button>
                )}
                <button
                  onClick={downloadTemplate}
                  title="Télécharger le modèle CSV"
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                >
                  <ICONS.Download className="w-4 h-4" />
                </button>
                <button
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
            <input
              type="file"
              ref={importJsonRef}
              className="hidden"
              accept=".json"
              onChange={handleImportJSON}
            />

            <button
              onClick={syncLocalDataToBackend}
              title="Synchroniser les données locales vers le serveur"
              className="flex items-center gap-1.5 text-[10px] border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-md font-black tracking-widest uppercase transition-all shadow-sm"
            >
              <ICONS.Save className="w-3.5 h-3.5" /> Sync Server
            </button>

            <button
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
                        });
                        setRooms([...rooms, adaptRoom(created)]);
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
                      },
                    ]);
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-t border-slate-200">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                {subTab === "profs" && (
                  <>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Promo Resp.</th>
                    <th className="px-4 py-3">Matières</th>
                    <th className="px-4 py-3">Indispos</th>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={profs.length > 0 && selectedIds.length === profs.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(profs.map((p) => p.id));
                          else setSelectedIds([]);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 w-20">Actions</th>
                  </>
                )}
                {subTab === "residents" && (
                  <>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Niveau</th>
                    <th className="px-4 py-3">Spécialité</th>
                    <th className="px-4 py-3">Exceptions</th>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={residents.length > 0 && selectedIds.length === residents.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(residents.map((r) => r.id));
                          else setSelectedIds([]);
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </>
                )}
                {subTab === "rooms" && (
                  <>
                    <th className="px-6 py-3">Salle</th>
                    <th className="px-6 py-3">P. Cap</th>
                    <th className="px-6 py-3">R. Cap</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </>
                )}
                {subTab === "exams" && (
                  <>
                    <th className="px-6 py-3">Épreuve / Promo</th>
                    <th className="px-6 py-3 min-w-[320px]">
                      Planification (Date & Heures)
                    </th>
                    <th className="px-6 py-3">Salles</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subTab === "profs" &&
                profs.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <input
                          className="bg-transparent font-semibold outline-none w-full"
                          value={p.name}
                          onChange={(e) =>
                            updateProf(p.id, "name", e.target.value)
                          }
                          placeholder="Nom..."
                        />
                        {p.responsiblePromo && (
                          <span
                            className={`text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded w-fit mt-1 border ${PROMO_COLORS[p.responsiblePromo]}`}
                          >
                            Responsable {p.responsiblePromo}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        className="bg-transparent font-bold text-xs"
                        value={p.rank}
                        onChange={(e) =>
                          updateProf(p.id, "rank", e.target.value as any)
                        }
                      >
                        <option value="Pr">Pr</option>
                        <option value="Dr">Dr</option>
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <select
                        className="bg-transparent text-[10px] font-black uppercase tracking-wider outline-none border border-slate-200 rounded px-1.5 py-0.5"
                        value={p.responsiblePromo || ""}
                        onChange={(e) =>
                          updateProf(
                            p.id,
                            "responsiblePromo",
                            e.target.value || undefined,
                          )
                        }
                      >
                        <option value="">Aucune</option>
                        {PROMOS.map((pr) => (
                          <option key={pr} value={pr}>
                            {pr}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {p.subjects.map((s, idx) => (
                          <span
                            key={idx}
                            className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-100"
                          >
                            {s}
                          </span>
                        ))}
                        {p.subjects.length === 0 && (
                          <span className="text-slate-300 text-[10px]">
                            Aucune matière
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => setEditingAbsenceId(p.id)}
                        className="flex items-center gap-1.5 text-[10px] font-black bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 px-2 py-1 rounded transition-all"
                      >
                        <ICONS.Calendar className="w-3 h-3" />{" "}
                        {p.absences.length} DATE(S)
                      </button>
                    </td>
                    <td className="px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={(e) => toggleSelection(p.id, e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() =>
                          deleteItem(
                            p.id,
                            profs,
                            setProfs,
                            `${p.rank}. ${p.name}`,
                          )
                        }
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              {subTab === "residents" &&
                residents.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <input
                        className="bg-transparent font-semibold outline-none w-full"
                        value={r.name}
                        onChange={(e) =>
                          updateResident(r.id, "name", e.target.value)
                        }
                        placeholder="Nom..."
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select
                        className="bg-transparent font-black text-indigo-600 text-xs"
                        value={r.level}
                        onChange={(e) =>
                          updateResident(
                            r.id,
                            "level",
                            parseInt(e.target.value) as any,
                          )
                        }
                      >
                        {[1, 2, 3, 4].map((l) => (
                          <option key={l} value={l}>
                            A{l}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <input
                        className="bg-transparent text-xs text-slate-600 italic outline-none w-full"
                        value={r.specialty}
                        onChange={(e) =>
                          updateResident(r.id, "specialty", e.target.value)
                        }
                        placeholder="Spécialité..."
                      />
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => setEditingAbsenceId(r.id)}
                        className="flex items-center gap-1.5 text-[10px] font-black bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 px-2 py-1 rounded transition-all"
                      >
                        <ICONS.Calendar className="w-3 h-3" />{" "}
                        {r.absences.length} DATE(S)
                      </button>
                    </td>
                    <td className="px-6 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={(e) => toggleSelection(r.id, e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() =>
                          deleteItem(
                            r.id,
                            residents,
                            setResidents,
                            `Résident ${r.name}`,
                          )
                        }
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              {subTab === "rooms" &&
                rooms.map((rm) => (
                  <tr key={rm.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3">
                      <input
                        className="bg-transparent font-bold outline-none w-full"
                        value={rm.name}
                        onChange={(e) =>
                          updateRoom(rm.id, "name", e.target.value)
                        }
                        placeholder="Salle..."
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        className="w-12 bg-slate-50 border rounded px-1"
                        value={rm.profCapacity}
                        onChange={(e) =>
                          updateRoom(
                            rm.id,
                            "profCapacity",
                            parseInt(e.target.value),
                          )
                        }
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        className="w-12 bg-slate-50 border rounded px-1"
                        value={rm.residentCapacity}
                        onChange={(e) =>
                          updateRoom(
                            rm.id,
                            "residentCapacity",
                            parseInt(e.target.value),
                          )
                        }
                      />
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() =>
                          deleteItem(rm.id, rooms, setRooms, `Salle ${rm.name}`)
                        }
                        className="text-slate-300 hover:text-red-500 p-1"
                      >
                        <ICONS.Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              {subTab === "exams" &&
                exams.map((e) => {
                  const hasConflict = !!conflicts[e.id];
                  return (
                    <tr
                      key={e.id}
                      className={`hover:bg-slate-50/50 ${hasConflict ? "bg-red-50" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <select
                          className={`text-[10px] font-black border rounded px-1.5 py-0.5 mb-1 block ${PROMO_COLORS[e.promo]}`}
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
                          className="bg-transparent font-black outline-none w-full text-indigo-950"
                          value={e.subject}
                          onChange={(ev) =>
                            updateExam(e.id, "subject", ev.target.value)
                          }
                          placeholder="Épreuve..."
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
                              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold"
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
                              className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold"
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
                              className="bg-indigo-50 border border-indigo-100 rounded px-1 py-0.5 text-[10px] font-bold text-indigo-700"
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
                                  const newDuration = Math.max(5, e.duration - 5);
                                  updateExam(e.id, "duration", newDuration);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-black text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                −
                              </button>
                              <span className="text-[10px] font-black text-indigo-700 px-1 min-w-[45px] text-center">
                                {Math.floor(e.duration / 60)}h{e.duration % 60}m
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newDuration = e.duration + 5;
                                  updateExam(e.id, "duration", newDuration);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-black text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {rooms.map((room) => (
                            <button
                              key={room.id}
                              onClick={() => toggleRoomInExam(e.id, room.id)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${e.roomIds?.includes(room.id) ? "bg-indigo-600 text-white border-indigo-700 shadow-sm" : "bg-white text-slate-300 border-slate-200"}`}
                            >
                              {room.name}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(evt) => {
                            evt.stopPropagation();
                            duplicateExam(e);
                          }}
                          className="text-slate-300 hover:text-indigo-500 p-1"
                        >
                          <ICONS.Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            deleteItem(
                              e.id,
                              exams,
                              setExams,
                              `Exam ${e.subject}`,
                            )
                          }
                          className="text-slate-300 hover:text-red-500 p-1"
                        >
                          <ICONS.Trash2 className="w-4 h-4" />
                        </button>
                      </td>
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
          <p className="font-bold uppercase tracking-wider mb-1">
            Optimisation Excel (Colonnes A, B, C...)
          </p>
          <p className="mb-2">
            Le modèle téléchargé utilise désormais une instruction technique
            (sep=;) qui garantit que chaque donnée s'ouvre dans une **cellule
            Excel séparée**.
          </p>
          <ul className="list-disc list-inside space-y-1 opacity-90 font-medium">
            {subTab === "profs" ? (
              <>
                <li>
                  <strong>Cellule A</strong> : Nom | <strong>Cellule B</strong>{" "}
                  : Grade | <strong>Cellule C</strong> : Promo |{" "}
                  <strong>D, E, F...</strong> : Matières
                </li>
              </>
            ) : (
              <>
                <li>
                  <strong>Cellule A</strong> : Nom | <strong>Cellule B</strong>{" "}
                  : Niveau (1-4) | <strong>Cellule C</strong> : Spécialité
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ConfigTab;
