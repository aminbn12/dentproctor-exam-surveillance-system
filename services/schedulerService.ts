import {
  Professor,
  Resident,
  Exam,
  Room,
  Assignment,
  Promo,
  Proctor,
  Absence,
} from "../types";

export const getShiftCounts = (
  assignments: Assignment[],
  profs: Professor[],
  residents: Resident[],
  proctors: Proctor[] = [],
) => {
  const counts: Record<string, number> = {};
  [...profs, ...residents, ...proctors].forEach((p) => (counts[p.id] = 0));

  assignments.forEach((a) => {
    a.profIds.forEach((pid) => {
      if (counts[pid] !== undefined) counts[pid]++;
    });
    a.residentIds.forEach((rid) => {
      if (counts[rid] !== undefined) counts[rid]++;
    });
    (a.proctorIds || []).forEach((prid) => {
      if (counts[prid] !== undefined) counts[prid]++;
    });
  });

  return counts;
};

export const getDailyStaffCounts = (
  assignments: Assignment[],
  allExams: Exam[],
  date: string,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  const examMap = new Map(allExams.map((e) => [e.id, e]));

  assignments.forEach((a) => {
    const ex = examMap.get(a.examId);
    if (ex && ex.date === date) {
      (a.profIds || []).forEach((pid) => {
        counts[pid] = (counts[pid] || 0) + 1;
      });
      (a.residentIds || []).forEach((rid) => {
        counts[rid] = (counts[rid] || 0) + 1;
      });
      (a.proctorIds || []).forEach((prid) => {
        counts[prid] = (counts[prid] || 0) + 1;
      });
    }
  });

  return counts;
};

export const isStaffAvailable = (
  staff: Professor | Resident | Proctor,
  targetExam: Exam,
  allExams: Exam[],
  assignments: Assignment[],
): boolean => {
  // Proctor : s'il est inactif, il n'est pas disponible
  if ("is_active" in staff) {
    const isActive =
      (staff as Proctor).is_active === 1 ||
      (staff as Proctor).is_active === (true as any);
    if (!isActive) return false;
  }

  // Vérifier les absences (pour Professor et Resident)
  if ("absences" in staff && Array.isArray((staff as any).absences)) {
    for (const absence of (staff as any).absences) {
      if (absence.date !== targetExam.date) continue;

      // Journée complète
      if (!absence.startTime || !absence.endTime) return false;

      // Absence partielle : vérifier le chevauchement avec l'examen
      if (targetExam.time) {
        const toMin = (t: string) => {
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };
        const examStart = toMin(targetExam.time);
        const examEnd = examStart + targetExam.duration;
        const absStart = toMin(absence.startTime);
        const absEnd = toMin(absence.endTime);
        if (examStart < absEnd && examEnd > absStart) return false;
      }
    }
  }

  if (!targetExam.time) return true;

  const [targetH, targetM] = targetExam.time.split(":").map(Number);
  const targetStart = targetH * 60 + targetM;
  const targetEnd = targetStart + targetExam.duration;

  for (const assignment of assignments) {
    if (
      assignment.profIds.includes(staff.id) ||
      assignment.residentIds.includes(staff.id) ||
      (assignment.proctorIds && assignment.proctorIds.includes(staff.id))
    ) {
      const otherExam = allExams.find((e) => e.id === assignment.examId);
      if (!otherExam || !otherExam.time || otherExam.date !== targetExam.date)
        continue;

      const [otherH, otherM] = otherExam.time.split(":").map(Number);
      const otherStart = otherH * 60 + otherM;
      const otherEnd = otherStart + otherExam.duration;

      if (targetStart < otherEnd && targetEnd > otherStart) return false;
    }
  }
  return true;
};

export const suggestProctorsForExamRoom = (
  exam: Exam,
  room: Room,
  profs: Professor[],
  residents: Resident[],
  allExams: Exam[],
  assignments: Assignment[],
  proctors?: Proctor[],
): { profIds: string[]; residentIds: string[]; proctorIds: string[] } => {
  const shiftCounts = getShiftCounts(assignments, profs, residents);
  const dailyCounts = getDailyStaffCounts(assignments, allExams, exam.date);

  // --- LOGIQUE ENSEIGNANTS ---
  let selectedProfIds: string[] = [];
  let availableProfs = profs.filter((p) =>
    isStaffAvailable(p, exam, allExams, assignments),
  );

  // 1. Règle Responsable de promo :
  // Présence TOUJOURS OBLIGATOIRE sans limite journalière lors des examens de sa promotion (sauf congé/maladie).
  // L'option configurable "roomAlternation" (par défaut activée) permet d'activer ou désactiver
  // le croisement / la rotation entre les différentes salles de l'examen.
  const resp = profs.find((p) => p.responsiblePromo === exam.promo);

  if (resp) {
    const assignedRoomIds = exam.roomIds || [];
    const shouldAlternateRooms = resp.roomAlternation !== false;
    let targetRoomId = assignedRoomIds[0];

    if (shouldAlternateRooms && assignedRoomIds.length > 1) {
      // Rotation chronologique entre les salles
      const promoExams = allExams
        .filter((e) => e.promo === exam.promo && e.date && e.time)
        .sort(
          (a, b) =>
            new Date(`${a.date}T${a.time}`).getTime() -
            new Date(`${b.date}T${b.time}`).getTime(),
        );

      const promoExamIdx = promoExams.findIndex((e) => e.id === exam.id);
      const targetRoomIdx =
        (promoExamIdx >= 0 ? promoExamIdx : 0) % (assignedRoomIds.length || 1);
      targetRoomId = assignedRoomIds[targetRoomIdx];
    }

    if (room.id === targetRoomId) {
      // Cette salle est la cible pour le responsable : l'assigner s'il est disponible (pas en congé/maladie)
      const isRespAvailable = availableProfs.some((p) => p.id === resp.id);
      if (isRespAvailable && room.profCapacity > 0) {
        selectedProfIds.push(resp.id);
        availableProfs = availableProfs.filter((p) => p.id !== resp.id);
      }
    } else if (assignedRoomIds.includes(targetRoomId)) {
      // Le responsable est réservé pour la salle cible lors de ce même créneau :
      // On l'exclut de la salle courante pour ne pas le bloquer ni le dédoubler
      availableProfs = availableProfs.filter((p) => p.id !== resp.id);
    }
  }

  // 2. Équité et répartition optimale des professeurs :
  // - Règle d'encadrement senior : Garantir au moins 1 Pr par salle (ne jamais laisser les Dr seuls [Dr, Dr]).
  // - Règle d'équité globale : Répartition équitable de la charge entre TOUS les enseignants
  //   (Pr et Dr) autour de la même moyenne globale, quel que soit le nombre d'épreuves (21, 48, etc.).
  const sortProfsByLoad = (list: Professor[]): Professor[] => {
    return [...list].sort((a, b) => {
      const loadA = (shiftCounts[a.id] || 0) + (dailyCounts[a.id] || 0) * 1.5;
      const loadB = (shiftCounts[b.id] || 0) + (dailyCounts[b.id] || 0) * 1.5;
      if (Math.abs(loadA - loadB) > 0.01) return loadA - loadB;
      if (shiftCounts[a.id] !== shiftCounts[b.id])
        return shiftCounts[a.id] - shiftCounts[b.id];
      return a.name.localeCompare(b.name);
    });
  };

  let hasPr = selectedProfIds.some(
    (id) => profs.find((p) => p.id === id)?.rank === "Pr",
  );

  // Étape A : Garantir au moins 1 Professeur (Pr) pour l'encadrement senior de la salle
  // (Empêche qu'une salle se retrouve avec des Dr seuls sans Pr)
  if (!hasPr && selectedProfIds.length < room.profCapacity) {
    const availablePrs = sortProfsByLoad(
      availableProfs.filter((p) => p.rank === "Pr"),
    );
    if (availablePrs.length > 0) {
      const chosenPr = availablePrs[0];
      selectedProfIds.push(chosenPr.id);
      availableProfs = availableProfs.filter((p) => p.id !== chosenPr.id);
      hasPr = true;
    }
  }

  // Étape B : Compléter les places restantes selon l'ÉQUITÉ GLOBALE (Pr et Dr)
  // Les enseignants (Pr et Dr) sont sélectionnés ensemble selon leur charge réelle cumulée.
  // Les salles avec 2 surveillants auront soit [Pr + Dr], soit [Pr + Pr], mais JAMAIS [Dr + Dr].
  while (
    selectedProfIds.length < room.profCapacity &&
    availableProfs.length > 0
  ) {
    const sorted = sortProfsByLoad(availableProfs);

    // Trouver le candidat le moins chargé respectant la règle d'encadrement
    const candidateIdx = sorted.findIndex((p) => {
      // Si la salle possède déjà un Pr (ou si capacité === 1), Pr comme Dr sont éligibles
      if (hasPr || room.profCapacity === 1) return true;
      // Si la salle n'a pas encore de Pr, priorité absolue à un Pr pour éviter [Dr, Dr]
      if (p.rank === "Pr") return true;
      // Repli d'urgence : aucun Pr n'est disponible dans la faculté sur ce créneau
      const anyPrLeft = sorted.some((other) => other.rank === "Pr");
      return !anyPrLeft;
    });

    if (candidateIdx === -1) break;

    const chosen = sorted[candidateIdx];
    selectedProfIds.push(chosen.id);
    availableProfs = availableProfs.filter((p) => p.id !== chosen.id);
    if (chosen.rank === "Pr") hasPr = true;
  }

  // --- LOGIQUE RÉSIDENTS (Hiérarchie d'expérience & Équité) ---
  // Règle : Placer d'abord 1 résident senior (3e ou 4e année : R3 ou R4) pour encadrer,
  // puis compléter les places restantes avec les autres années (R1 ou R2) en assurant la mixité.
  let selectedResidentIds: string[] = [];
  let availableResidents = residents.filter((r) =>
    isStaffAvailable(r, exam, allExams, assignments),
  );

  const usedSpecialties = new Set<string>();

  // Étape A : Sélection prioritaire d'un résident senior (R3 / R4)
  if (room.residentCapacity > 0) {
    const availableSeniors = availableResidents
      .filter((r) => r.level >= 3)
      .sort((a, b) => {
        const loadA = (shiftCounts[a.id] || 0) + (dailyCounts[a.id] || 0) * 1.5;
        const loadB = (shiftCounts[b.id] || 0) + (dailyCounts[b.id] || 0) * 1.5;
        if (Math.abs(loadA - loadB) > 0.01) return loadA - loadB;
        if (shiftCounts[a.id] !== shiftCounts[b.id])
          return shiftCounts[a.id] - shiftCounts[b.id];
        return b.level - a.level; // R4 avant R3 à charge égale
      });

    if (availableSeniors.length > 0) {
      const chosenSenior = availableSeniors[0];
      selectedResidentIds.push(chosenSenior.id);
      usedSpecialties.add(chosenSenior.specialty);
      availableResidents = availableResidents.filter(
        (r) => r.id !== chosenSenior.id,
      );
    }
  }

  // Étape B : Compléter avec les résidents juniors (R1 / R2) puis les autres disponibles
  // en favorisant la mixité de spécialités et l'équité de charge
  availableResidents.sort((a, b) => {
    let loadA = (shiftCounts[a.id] || 0) + (dailyCounts[a.id] || 0) * 1.5;
    let loadB = (shiftCounts[b.id] || 0) + (dailyCounts[b.id] || 0) * 1.5;

    // Préférer les juniors (R1/R2) pour compléter après le senior
    if (a.level <= 2 && b.level > 2) loadA -= 0.3;
    if (b.level <= 2 && a.level > 2) loadB -= 0.3;

    // Pénaliser les doublons de spécialité dans la même salle (hors omnisport)
    if (room.name.toLowerCase() !== "omnisport") {
      if (usedSpecialties.has(a.specialty)) loadA += 5.0;
      if (usedSpecialties.has(b.specialty)) loadB += 5.0;
    }

    if (Math.abs(loadA - loadB) > 0.01) return loadA - loadB;
    if (shiftCounts[a.id] !== shiftCounts[b.id])
      return shiftCounts[a.id] - shiftCounts[b.id];
    return a.level - b.level;
  });

  while (
    selectedResidentIds.length < room.residentCapacity &&
    availableResidents.length > 0
  ) {
    const nextResident = availableResidents.shift()!;
    selectedResidentIds.push(nextResident.id);
    usedSpecialties.add(nextResident.specialty);
  }

  // --- LOGIQUE SURVEILLANTS ADMINISTRATION (ADM, IT, ZONE) ---
  let selectedProctorIds: string[] = [];
  const reqAdm =
    room.adminCapacity !== undefined
      ? room.adminCapacity
      : (room.proctorCapacity ?? 1);
  const reqIt = room.itCapacity ?? 0;
  const reqZone = room.zoneLeaderCapacity ?? 0;
  const totalProctorCap = reqAdm + reqIt + reqZone;

  if (totalProctorCap > 0 && proctors && proctors.length > 0) {
    const proctorShiftCounts: Record<string, number> = {};
    proctors.forEach((p) => (proctorShiftCounts[p.id] = 0));
    assignments.forEach((a) => {
      (a.proctorIds || []).forEach((pid) => {
        if (proctorShiftCounts[pid] !== undefined) proctorShiftCounts[pid]++;
      });
    });

    let availableProctors = proctors.filter(
      (p) =>
        (p.is_active === 1 || (p.is_active as any) === true) &&
        isStaffAvailable(p, exam, allExams, assignments),
    );

    // Trier par équité de charge
    availableProctors.sort(
      (a, b) =>
        (proctorShiftCounts[a.id] || 0) - (proctorShiftCounts[b.id] || 0),
    );

    // 1. Quota IT
    let itCount = 0;
    for (let i = 0; i < availableProctors.length && itCount < reqIt; ) {
      const p = availableProctors[i];
      if ((p.specialty || "").includes("IT")) {
        selectedProctorIds.push(p.id);
        availableProctors.splice(i, 1);
        itCount++;
      } else {
        i++;
      }
    }

    // 2. Quota Responsable de Zone
    let zoneCount = 0;
    for (let i = 0; i < availableProctors.length && zoneCount < reqZone; ) {
      const p = availableProctors[i];
      if ((p.specialty || "").includes("Zones")) {
        selectedProctorIds.push(p.id);
        availableProctors.splice(i, 1);
        zoneCount++;
      } else {
        i++;
      }
    }

    // 3. Quota Administration
    let admCount = 0;
    for (let i = 0; i < availableProctors.length && admCount < reqAdm; ) {
      const p = availableProctors[i];
      if (
        (p.specialty || "Administration") === "Administration" ||
        (p.specialty || "").includes("Administration")
      ) {
        selectedProctorIds.push(p.id);
        availableProctors.splice(i, 1);
        admCount++;
      } else {
        i++;
      }
    }

    // 4. Strict cloisonnement des rôles (Option 2) :
    // INTERDICTION FORMELLE au personnel IT de combler des places vacantes d'Administration ou de Zone.
    // De même, les quotas ADM et ZONE ne sont attribués qu'au personnel qualifié.
    // Si une catégorie manque de personnel (ex: 0 Responsable de Zone disponible sur ce créneau),
    // la salle reste strictement en l'état (ex: 3 / 4) avec ZONE: 0/1, sans appel indu de personnel IT.
  }

  return {
    profIds: selectedProfIds,
    residentIds: selectedResidentIds,
    proctorIds: selectedProctorIds,
  };
};

/**
 * Répartit de manière exclusive les surveillants assignés dans une salle
 * (Chaque surveillant n'apparaît que dans UNE SEULE colonne selon les quotas et son rôle).
 */
export const partitionAssignedProctors = (
  assignedProctorObjs: Proctor[],
  room: Room,
): { adm: Proctor[]; it: Proctor[]; zone: Proctor[] } => {
  const reqIt = room.itCapacity ?? 0;
  const reqZone = room.zoneLeaderCapacity ?? 0;
  const reqAdm =
    room.adminCapacity !== undefined
      ? room.adminCapacity
      : (room.proctorCapacity ?? 1);

  const remaining = [...assignedProctorObjs];
  const itList: Proctor[] = [];
  const zoneList: Proctor[] = [];
  const admList: Proctor[] = [];

  // 1. Quota IT : ceux dont la spécialité contient "IT"
  for (let i = 0; i < remaining.length && itList.length < reqIt; ) {
    if ((remaining[i].specialty || "").includes("IT")) {
      itList.push(remaining.splice(i, 1)[0]);
    } else {
      i++;
    }
  }

  // 2. Quota Responsable de Zone : ceux dont la spécialité contient "Zones"
  for (let i = 0; i < remaining.length && zoneList.length < reqZone; ) {
    if ((remaining[i].specialty || "").includes("Zones")) {
      zoneList.push(remaining.splice(i, 1)[0]);
    } else {
      i++;
    }
  }

  // 3. Quota Administration : ceux dont la spécialité contient "Administration" ou catégorie standard
  for (let i = 0; i < remaining.length && admList.length < reqAdm; ) {
    if (
      (remaining[i].specialty || "").includes("Administration") ||
      remaining[i].specialty === "Administration" ||
      (!remaining[i].specialty?.includes("IT") &&
        !remaining[i].specialty?.includes("Zones"))
    ) {
      admList.push(remaining.splice(i, 1)[0]);
    } else {
      i++;
    }
  }

  // 4. Surveillants assignés restants (en cas de dépassement ou d'affectation manuelle) :
  // Strict cloisonnement : un profil IT reste TOUJOURS IT, il n'est JAMAIS basculé en ADM !
  while (remaining.length > 0) {
    const p = remaining.shift()!;
    if ((p.specialty || "").includes("IT")) {
      itList.push(p);
    } else if (zoneList.length < reqZone && (p.specialty || "").includes("Zones")) {
      zoneList.push(p);
    } else if ((p.specialty || "").includes("Zones") && !(p.specialty || "").includes("Administration")) {
      zoneList.push(p);
    } else {
      admList.push(p);
    }
  }

  return { adm: admList, it: itList, zone: zoneList };
};

export const validateAssignment = (
  assignment: Assignment | undefined,
  exam: Exam,
  room: Room,
  profs: Professor[],
  residents: Resident[],
  allExams?: Exam[],
): string[] => {
  if (!assignment) return [];
  const warnings: string[] = [];

  const assignedProfs = assignment.profIds
    .map((id) => profs.find((p) => p.id === id))
    .filter(Boolean) as Professor[];
  const assignedRes = assignment.residentIds
    .map((id) => residents.find((r) => r.id === id))
    .filter(Boolean) as Resident[];

  // Recommandation présence d'un Pr
  if (assignedProfs.length > 0) {
    const hasPr = assignedProfs.some((p) => p.rank === "Pr");
    if (!hasPr) {
      warnings.push(
        "Encadrement : Aucun Professeur (Pr) assigné pour encadrer cette salle.",
      );
    }
  }

  // Vérification Responsable de promo (obligatoire sauf absence)
  const resp = profs.find((p) => p.responsiblePromo === exam.promo);
  if (resp) {
    const assignedRooms = exam.roomIds || [];
    let targetRoomId = assignedRooms[0];
    const shouldAlternateRooms = resp.roomAlternation !== false;

    if (shouldAlternateRooms && assignedRooms.length > 1 && allExams && allExams.length > 0) {
      const promoExams = allExams
        .filter((e) => e.promo === exam.promo && e.date && e.time)
        .sort(
          (a, b) =>
            new Date(`${a.date}T${a.time}`).getTime() -
            new Date(`${b.date}T${b.time}`).getTime(),
        );
      const promoExamIdx = promoExams.findIndex((e) => e.id === exam.id);
      const targetRoomIdx =
        (promoExamIdx >= 0 ? promoExamIdx : 0) % (assignedRooms.length || 1);
      targetRoomId = assignedRooms[targetRoomIdx];
    }

    if (room.id === targetRoomId) {
      const hasResp = assignedProfs.some((p) => p.id === resp.id);
      if (!hasResp) {
        // Vérifier s'il a une absence déclarée
        const isAbsent = !isStaffAvailable(resp, exam, allExams || [exam], []);
        if (!isAbsent) {
          warnings.push(
            `Salle assignée : Le responsable de promo (${resp.name}) n'est pas assigné.`,
          );
        }
      }
    }
  }

  if (assignedRes.length > 0) {
    const specs = assignedRes.map((r) => r.specialty);
    if (
      specs.length !== new Set(specs).size &&
      room.name.toLowerCase() !== "omnisport"
    ) {
      warnings.push("Mixité : Doublon de spécialité.");
    }

    if (assignedRes.length >= 2 && !assignedRes.some((r) => r.level >= 3)) {
      warnings.push("Expérience : Aucun senior (R3/R4).");
    }
  }

  return warnings;
};
