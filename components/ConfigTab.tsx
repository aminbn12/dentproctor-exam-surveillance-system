import React, { useState, useRef, useMemo } from "react";
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
  const [absenceIsPartial, setAbsenceIsPartial] = useState(false);
  const [absenceStartTime, setAbsenceStartTime] = useState("");
  const [absenceEndTime, setAbsenceEndTime] = useState("");
  const [absenceDateInput, setAbsenceDateInput] = useState("");
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
                  subjects: prof.subjects || [],
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
        const isDuplicate = prof.absences.some(
          (a) =>
            a.date === date &&
            a.startTime === startTime &&
            a.endTime === endTime,
        );
        if (!isDuplicate)
          updateProf(personId, "absences", [...prof.absences, newAbsence]);
      }
    } else if (subTab === "residents") {
      const res = residents.find((r) => r.id === personId);
      if (res) {
        const isDuplicate = res.absences.some(
          (a) =>
            a.date === date &&
            a.startTime === startTime &&
            a.endTime === endTime,
        );
        if (!isDuplicate)
          updateResident(personId, "absences", [...res.absences, newAbsence]);
      }
    } else if (subTab === "proctors") {
      const proc = proctors.find((p) => p.id === personId);
      if (proc) {
        const absences = proc.absences || [];
        const isDuplicate = absences.some(
          (a) =>
            a.date === date &&
            a.startTime === startTime &&
            a.endTime === endTime,
        );
        if (!isDuplicate) {
          const newAbs = [...absences, newAbsence];
          setProctors((prev) =>
            prev.map((p) => (p.id === personId ? { ...p, absences: newAbs } : p)),
          );
          updateProctorInBackend(personId, { absences: newAbs } as any);
        }
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
    if (!subject.trim()) return;
    const updatedProfs = profs.map((p) => {
      if (p.id === profId) {
        // Éviter les doublons
        if (!p.subjects.includes(subject)) {
          return { ...p, subjects: [...p.subjects, subject] };
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

  const AbsenceModal = () => {
    const person =
      subTab === "profs"
        ? profs.find((p) => p.id === editingAbsenceId)
        : subTab === "residents"
          ? residents.find((r) => r.id === editingAbsenceId)
          : proctors.find((p) => p.id === editingAbsenceId);

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

    const personAbsences = Array.isArray(person.absences) ? person.absences : [];
    const sortedAbsences = [...personAbsences].sort((a, b) => {
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
              onClick={() => {
                setEditingAbsenceId(null);
                setAbsenceIsPartial(false);
                setAbsenceDateInput("");
                setAbsenceStartTime("");
                setAbsenceEndTime("");
              }}
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Date
                </span>
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
                  Indisponibilité partielle{" "}
                  <span className="text-slate-400 font-normal">
                    (par heure)
                  </span>
                </span>
              </label>

              {/* Heures — affichées uniquement si partielle */}
              {absenceIsPartial && (
                <div className="flex gap-3 animate-in slide-in-from-top-2 duration-150">
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Heure début
                    </span>
                    <input
                      type="time"
                      value={absenceStartTime}
                      onChange={(e) => setAbsenceStartTime(e.target.value)}
                      className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Heure fin
                    </span>
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
                        <ICONS.Calendar
                          className={`w-3.5 h-3.5 ${absence.startTime ? "text-amber-400" : "text-indigo-400"}`}
                        />
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
              onClick={() => {
                setEditingAbsenceId(null);
                setAbsenceIsPartial(false);
                setAbsenceDateInput("");
                setAbsenceStartTime("");
                setAbsenceEndTime("");
              }}
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
            >
              Terminer la gestion
            </button>
          </div>
        </div>
      </div>
    );
  };

  const SubjectsModal = () => {
    const prof = profs.find((p) => p.id === editingSubjectsId);

    if (!prof) return null;

    const handleAddSubject = () => {
      addSubject(prof.id, newSubjectInput);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50/30">
            <div>
              <h3 className="font-black text-emerald-950 uppercase tracking-tight">
                Gestion des Matières
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {prof.name} ({prof.rank})
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSubjectsId(null);
                setNewSubjectInput("");
              }}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <ICONS.Plus className="w-5 h-5 rotate-45 text-slate-400" />
            </button>
          </div>

          {/* Form */}
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                Ajouter une matière
              </label>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddSubject();
                    }
                  }}
                  placeholder="Anatomie, Biologie, etc..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button
                  onClick={handleAddSubject}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-black hover:bg-emerald-700 transition-all active:scale-95"
                >
                  + AJOUTER
                </button>
              </div>
            </div>

            {/* Liste des matières */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Matières configurées ({prof.subjects.length})
              </label>
              <div className="max-h-52 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {prof.subjects.length === 0 ? (
                  <div className="text-center py-6 text-slate-300 italic text-xs">
                    Aucune matière enregistrée
                  </div>
                ) : (
                  prof.subjects.map((subject, idx) => (
                    <div
                      key={`${subject}-${idx}`}
                      className="flex justify-between items-center p-3 rounded-lg border border-emerald-100 bg-emerald-50 group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700">
                          {subject}
                        </span>
                      </div>
                      <button
                        onClick={() => removeSubject(prof.id, subject)}
                        className="text-slate-300 hover:text-red-500 p-1 rounded-md transition-colors"
                        title="Supprimer cette matière"
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
              onClick={() => {
                setEditingSubjectsId(null);
                setNewSubjectInput("");
              }}
              className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
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
                            const val = (e.target.value as Promo) || undefined;
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
