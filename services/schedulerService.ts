
import { Professor, Resident, Exam, Room, Assignment, Promo } from '../types';

export const getShiftCounts = (
  assignments: Assignment[],
  profs: Professor[],
  residents: Resident[]
) => {
  const counts: Record<string, number> = {};
  [...profs, ...residents].forEach(p => counts[p.id] = 0);

  assignments.forEach(a => {
    a.profIds.forEach(pid => { if(counts[pid] !== undefined) counts[pid]++; });
    a.residentIds.forEach(rid => { if(counts[rid] !== undefined) counts[rid]++; });
  });

  return counts;
};

export const isStaffAvailable = (
  staff: Professor | Resident,
  targetExam: Exam,
  allExams: Exam[],
  assignments: Assignment[]
): boolean => {
  // Vérifier les absences (journée complète ou plage horaire)
  for (const absence of staff.absences) {
    if (absence.date !== targetExam.date) continue;

    // Journée complète
    if (!absence.startTime || !absence.endTime) return false;

    // Absence partielle : vérifier le chevauchement avec l'examen
    if (targetExam.time) {
      const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
      const examStart = toMin(targetExam.time);
      const examEnd = examStart + targetExam.duration;
      const absStart = toMin(absence.startTime);
      const absEnd = toMin(absence.endTime);
      if (examStart < absEnd && examEnd > absStart) return false;
    }
  }
  if (!targetExam.time) return true;

  const [targetH, targetM] = targetExam.time.split(':').map(Number);
  const targetStart = targetH * 60 + targetM;
  const targetEnd = targetStart + targetExam.duration;

  for (const assignment of assignments) {
    if (assignment.profIds.includes(staff.id) || assignment.residentIds.includes(staff.id)) {
      const otherExam = allExams.find(e => e.id === assignment.examId);
      if (!otherExam || !otherExam.time || otherExam.date !== targetExam.date) continue;

      const [otherH, otherM] = otherExam.time.split(':').map(Number);
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
  assignments: Assignment[]
): { profIds: string[], residentIds: string[] } => {
  const shiftCounts = getShiftCounts(assignments, profs, residents);
  
  // --- LOGIQUE ENSEIGNANTS (AVEC RÈGLE PR OBLIGATOIRE) ---
  let selectedProfIds: string[] = [];
  let availableProfs = profs.filter(p => isStaffAvailable(p, exam, allExams, assignments));

  // 1. Règle Omnisport : Responsable obligatoire (qui est généralement Pr)
  if (room.name.toLowerCase().includes('omnisport')) {
    const resp = availableProfs.find(p => p.responsiblePromo === exam.promo);
    if (resp) {
      selectedProfIds.push(resp.id);
      availableProfs = availableProfs.filter(p => p.id !== resp.id);
    }
  }

  // 2. Garantie d'au moins un Pr (si pas déjà sélectionné via responsable)
  const selectedContainsPr = selectedProfIds.some(id => profs.find(p => p.id === id)?.rank === 'Pr');
  
  if (!selectedContainsPr && room.profCapacity > 0) {
    // On cherche le Pr le moins chargé
    const availablePrs = availableProfs
      .filter(p => p.rank === 'Pr')
      .sort((a, b) => shiftCounts[a.id] - shiftCounts[b.id]);
    
    if (availablePrs.length > 0) {
      const chosenPr = availablePrs[0];
      selectedProfIds.push(chosenPr.id);
      availableProfs = availableProfs.filter(p => p.id !== chosenPr.id);
    }
  }

  // 3. Compléter les places restantes par équité (Pr ou Dr indifféremment)
  availableProfs.sort((a, b) => {
    if (shiftCounts[a.id] !== shiftCounts[b.id]) return shiftCounts[a.id] - shiftCounts[b.id];
    // A charge égale, on préfère un Pr pour la solidité de l'encadrement
    if (a.rank !== b.rank) return a.rank === 'Pr' ? -1 : 1;
    return 0;
  });

  while (selectedProfIds.length < room.profCapacity && availableProfs.length > 0) {
    selectedProfIds.push(availableProfs.shift()!.id);
  }

  // --- LOGIQUE RÉSIDENTS (Équité Absolue) ---
  let selectedResidentIds: string[] = [];
  let pool = residents.filter(r => isStaffAvailable(r, exam, allExams, assignments));

  pool.sort((a, b) => {
    if (shiftCounts[a.id] !== shiftCounts[b.id]) return shiftCounts[a.id] - shiftCounts[b.id];
    return b.level - a.level;
  });

  const usedSpecialties = new Set<string>();
  const usedLevels = new Set<number>();

  for (const res of [...pool]) {
    if (selectedResidentIds.length >= room.residentCapacity) break;
    const isNewSpec = !usedSpecialties.has(res.specialty);
    const isNewLevel = !usedLevels.has(res.level);

    if (isNewSpec && isNewLevel) {
      selectedResidentIds.push(res.id);
      usedSpecialties.add(res.specialty);
      usedLevels.add(res.level);
      pool = pool.filter(r => r.id !== res.id);
    }
  }

  while (selectedResidentIds.length < room.residentCapacity && pool.length > 0) {
    const next = pool.shift()!;
    selectedResidentIds.push(next.id);
  }

  return { profIds: selectedProfIds, residentIds: selectedResidentIds };
};

export const validateAssignment = (
  assignment: Assignment | undefined,
  exam: Exam,
  room: Room,
  profs: Professor[],
  residents: Resident[]
): string[] => {
  if (!assignment) return [];
  const warnings: string[] = [];

  const assignedProfs = assignment.profIds.map(id => profs.find(p => p.id === id)).filter(Boolean) as Professor[];
  const assignedRes = assignment.residentIds.map(id => residents.find(r => r.id === id)).filter(Boolean) as Resident[];

  // NOUVELLE RÈGLE : Un Professeur (Pr) est OBLIGATOIRE
  if (assignedProfs.length > 0) {
    const hasPr = assignedProfs.some(p => p.rank === 'Pr');
    if (!hasPr) {
      warnings.push("SÉCURITÉ : Un Professeur (Pr) est obligatoire pour encadrer la salle. (Dr seul interdit)");
    }
  }

  if (room.name.toLowerCase().includes('omnisport')) {
    const hasResp = assignedProfs.some(p => p.responsiblePromo === exam.promo);
    if (!hasResp) warnings.push("Omnisport : Responsable de promo absent.");
  }

  if (assignedRes.length > 0) {
    const specs = assignedRes.map(r => r.specialty);
    if (specs.length !== new Set(specs).size && room.name.toLowerCase() !== 'omnisport') {
      warnings.push("Mixité : Doublon de spécialité.");
    }
    
    if (assignedRes.length >= 2 && !assignedRes.some(r => r.level >= 3)) {
      warnings.push("Expérience : Aucun senior (R3/R4).");
    }
  }

  return warnings;
};
