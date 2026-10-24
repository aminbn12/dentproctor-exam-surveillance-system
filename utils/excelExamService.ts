import * as XLSX from "xlsx";
import { Exam, Room, Promo } from "../types";

export interface ParseResult {
  exams: Exam[];
  errors: string[];
  warnings: string[];
  addedCount: number;
}

// Convert Excel dates (serial numbers or strings) to YYYY-MM-DD
function normalizeDate(raw: any): string {
  if (!raw) return "";

  // If it's an Excel numeric date
  if (typeof raw === "number") {
    const dateObj = XLSX.SSF.parse_date_code(raw);
    if (dateObj) {
      const y = dateObj.y.toString().padStart(4, "0");
      const m = dateObj.m.toString().padStart(2, "0");
      const d = dateObj.d.toString().padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  const str = String(raw).trim();

  // If formatted as DD/MM/YYYY or DD-MM-YYYY
  const frMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (frMatch) {
    const [, d, m, y] = frMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // If already YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return str;
}

// Convert Excel time to HH:MM
function normalizeTime(raw: any): string {
  if (raw === undefined || raw === null || raw === "") return "";

  // If it's a numeric fractional day from Excel (e.g. 0.3541666... for 08:30)
  if (typeof raw === "number" && raw < 1) {
    const totalMinutes = Math.round(raw * 24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  const str = String(raw).trim();

  // If formatted as "08h30" or "8H30" or "08:30"
  const timeMatch = str.match(/^(\d{1,2})[:hH](\d{2})/);
  if (timeMatch) {
    const [, h, m] = timeMatch;
    return `${h.padStart(2, "0")}:${m}`;
  }

  return str;
}

// Normalize promo string
function normalizePromo(raw: any): Promo {
  const str = String(raw || "").trim().toUpperCase();
  if (str.includes("FM6MD1") || str === "M1" || str === "1") return "FM6MD1";
  if (str.includes("FM6MD2") || str === "M2" || str === "2") return "FM6MD2";
  if (str.includes("FM6MD3") || str === "M3" || str === "3") return "FM6MD3";
  if (str.includes("FM6MD4") || str === "M4" || str === "4") return "FM6MD4";
  if (str.includes("FM6MD5") || str === "M5" || str === "5") return "FM6MD5";
  return "FM6MD1";
}

// Find room IDs from string names
function resolveRoomIds(rawRooms: any, availableRooms: Room[]): string[] {
  if (!rawRooms) {
    // Default to rooms named Amphi 1 and Amphi 2 if available
    const amphis = availableRooms.filter((r) =>
      r.name.toLowerCase().includes("amphi"),
    );
    return amphis.length > 0
      ? amphis.map((r) => r.id)
      : availableRooms.slice(0, 2).map((r) => r.id);
  }

  const str = String(rawRooms).toLowerCase();
  const matchedIds: string[] = [];

  for (const room of availableRooms) {
    const roomNameLower = room.name.toLowerCase();
    // Check if room name or ID is present in string
    if (str.includes(roomNameLower) || str.includes(room.id.toLowerCase())) {
      matchedIds.push(room.id);
    }
  }

  // If string contains "amphi 1/amphi2" or similar combined
  if (matchedIds.length === 0) {
    if (str.includes("amphi 1") || str.includes("amphi1")) {
      const a1 = availableRooms.find((r) =>
        r.name.toLowerCase().includes("amphi 1"),
      );
      if (a1) matchedIds.push(a1.id);
    }
    if (str.includes("amphi 2") || str.includes("amphi2")) {
      const a2 = availableRooms.find((r) =>
        r.name.toLowerCase().includes("amphi 2"),
      );
      if (a2) matchedIds.push(a2.id);
    }
  }

  return matchedIds.length > 0
    ? matchedIds
    : availableRooms.slice(0, 2).map((r) => r.id);
}

/**
 * Parse une grille de calendrier / matrice (jours en colonnes, créneaux en lignes)
 */
function parseGridRows(
  grid: any[][],
  availableRooms: Room[],
): { exams: Exam[]; warnings: string[] } {
  const warnings: string[] = [];
  const parsedExams: Exam[] = [];

  // 1. Détecter la ligne des jours
  const dayNames = [
    "lundi",
    "mardi",
    "mercredi",
    "jeudi",
    "vendredi",
    "samedi",
    "dimanche",
  ];
  let dayRowIdx = -1;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    const matchCount = row.filter(
      (cell) =>
        typeof cell === "string" &&
        dayNames.includes(cell.toLowerCase().trim()),
    ).length;
    if (matchCount >= 2) {
      dayRowIdx = r;
      break;
    }
  }

  if (dayRowIdx === -1) {
    return {
      exams: [],
      warnings: ["Ligne des jours (Lundi, Mardi...) non détectée."],
    };
  }

  // 2. Détecter la ligne des dates
  let dateRowIdx = dayRowIdx + 1;
  const colDates: Record<number, string> = {};

  for (let c = 0; c < (grid[dayRowIdx] || []).length; c++) {
    const dayVal = grid[dayRowIdx][c];
    if (
      typeof dayVal === "string" &&
      dayNames.includes(dayVal.toLowerCase().trim())
    ) {
      let rawDate = grid[dateRowIdx] ? grid[dateRowIdx][c] : "";
      let normalized = normalizeDate(rawDate);
      if (!normalized) {
        normalized = normalizeDate(dayVal);
      }
      if (normalized) {
        colDates[c] = normalized;
      }
    }
  }

  // 3. Détecter les blocs horaires (ex: 08H30-09H30, 10H00 - 11H00)
  const slotPattern =
    /(\d{1,2})[hH:](\d{0,2})\s*[-–àa]\s*(\d{1,2})[hH:](\d{0,2})/;
  interface Block {
    startRow: number;
    endRow: number;
    time: string;
    duration: number;
  }
  const blocks: Block[] = [];

  for (let r = dateRowIdx + 1; r < grid.length; r++) {
    for (let c = 0; c <= 2; c++) {
      const val = String(grid[r]?.[c] || "").trim();
      const m = val.match(slotPattern);
      if (m) {
        const startH = m[1].padStart(2, "0");
        const startM = (m[2] || "00").padStart(2, "0");
        const endH = m[3].padStart(2, "0");
        const endM = (m[4] || "00").padStart(2, "0");
        const startMin = parseInt(startH) * 60 + parseInt(startM);
        const endMin = parseInt(endH) * 60 + parseInt(endM);
        const duration = Math.max(30, endMin - startMin);
        blocks.push({
          startRow: r,
          endRow: grid.length,
          time: `${startH}:${startM}`,
          duration,
        });
        break;
      }
    }
  }

  for (let b = 0; b < blocks.length; b++) {
    blocks[b].endRow =
      b + 1 < blocks.length ? blocks[b + 1].startRow : grid.length;
  }

  // Ordre des promos habituel par créneau horaire
  // 08:30 -> FM6MD1, 10:00 -> FM6MD2, 11:30 -> FM6MD4, 14:30 -> FM6MD3, 16:00 -> FM6MD5
  const fallbackPromoOrder: Promo[] = [
    "FM6MD1",
    "FM6MD2",
    "FM6MD4",
    "FM6MD3",
    "FM6MD5",
  ];

  let examIdx = 0;
  blocks.forEach((block, bIdx) => {
    const promo = fallbackPromoOrder[bIdx] || "FM6MD1";

    Object.keys(colDates).forEach((colKey) => {
      const c = parseInt(colKey);
      const date = colDates[c];
      const subjects: string[] = [];
      let roomStr = "";

      for (let r = block.startRow; r < block.endRow; r++) {
        const cellVal = String(grid[r]?.[c] || "").trim();
        if (!cellVal) continue;

        if (/amphi|salle|omnisport/i.test(cellVal)) {
          roomStr = cellVal;
        } else if (!slotPattern.test(cellVal)) {
          if (!/planning|contr[oô]le|semestre/i.test(cellVal)) {
            subjects.push(cellVal);
          }
        }
      }

      if (subjects.length > 0) {
        const roomIds = resolveRoomIds(roomStr, availableRooms);
        parsedExams.push({
          id: `exam_grid_${Date.now()}_${examIdx++}_${Math.random().toString(36).substr(2, 4)}`,
          date,
          time: block.time,
          duration: block.duration,
          promo,
          subject: subjects.join(" / "),
          roomIds,
        });
      }
    });
  });

  return { exams: parsedExams, warnings };
}

/**
 * Lit et parse un fichier Excel (.xlsx, .xls) ou CSV d'examens (Tabulaire ou Matrice Grille)
 */
export async function parseExamsFromExcel(
  file: File,
  availableRooms: Room[],
): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsedExams: Exam[] = [];

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: "array" });

    // Prendre la première feuille ou celle contenant 'exam' / 'liste'
    const sheetName =
      workbook.SheetNames.find(
        (s) =>
          s.toLowerCase().includes("exam") || s.toLowerCase().includes("liste"),
      ) || workbook.SheetNames[0];

    if (!sheetName) {
      throw new Error("Aucune feuille trouvée dans le fichier Excel.");
    }

    const worksheet = workbook.Sheets[sheetName];

    // 1. Essai de lecture au format Tabulaire (colonnes: Date, Heure, Matiere...)
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
    });

    const firstRowKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
    const hasTabularHeaders = firstRowKeys.some((k) =>
      /matiere|epreuve|subject|module|heure|duree/i.test(k),
    );

    if (hasTabularHeaders && rows.length > 0) {
      rows.forEach((row, index) => {
        const rowNum = index + 2;
        const keys = Object.keys(row);
        const findKey = (candidates: string[]) =>
          keys.find((k) =>
            candidates.some((c) =>
              k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(c),
            ),
          );

        const dateKey = findKey(["date", "jour"]);
        const timeKey = findKey(["heure", "debut", "time", "creneau"]);
        const durationKey = findKey(["duree", "duration", "minutes"]);
        const promoKey = findKey(["promo", "promotion", "classe"]);
        const subjectKey = findKey(["matiere", "epreuve", "subject", "module"]);
        const roomsKey = findKey(["salle", "salles", "rooms", "amphi"]);

        const rawSubject = subjectKey ? row[subjectKey] : "";
        if (!rawSubject || String(rawSubject).trim() === "") {
          return;
        }

        const date = dateKey ? normalizeDate(row[dateKey]) : "";
        const time = timeKey ? normalizeTime(row[timeKey]) : "09:00";
        const durationRaw = durationKey ? parseInt(row[durationKey]) : 60;
        const duration =
          isNaN(durationRaw) || durationRaw <= 0 ? 60 : durationRaw;
        const promo = promoKey ? normalizePromo(row[promoKey]) : "FM6MD1";
        const subject = String(rawSubject).trim();
        const roomIds = resolveRoomIds(
          roomsKey ? row[roomsKey] : null,
          availableRooms,
        );

        parsedExams.push({
          id: `exam_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
          date,
          time,
          duration,
          promo,
          subject,
          roomIds,
        });
      });
    }

    // 2. Si le format tabulaire n'a rien trouvé, essayer le format Grille Calendrier
    if (parsedExams.length === 0) {
      const grid: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
      });
      const gridResult = parseGridRows(grid, availableRooms);
      parsedExams = gridResult.exams;
      warnings.push(...gridResult.warnings);
    }

    if (parsedExams.length === 0) {
      throw new Error(
        "Aucun examen valide trouvé dans le fichier Excel. Vérifiez que le fichier contient soit des colonnes (Date, Heure, Matière), soit une grille de planning (Lundi à Vendredi avec créneaux horaires).",
      );
    }

    return {
      exams: parsedExams,
      errors,
      warnings,
      addedCount: parsedExams.length,
    };
  } catch (err: any) {
    return {
      exams: [],
      errors: [err.message || "Erreur lors de la lecture du fichier Excel."],
      warnings,
      addedCount: 0,
    };
  }
}

/**
 * Exporte la liste actuelle des examens au format Excel (.xlsx)
 */
export function exportExamsToExcel(
  exams: Exam[],
  rooms: Room[],
  filename = "Planning_Examens.xlsx",
) {
  const roomMap = new Map<string, string>();
  rooms.forEach((r) => roomMap.set(r.id, r.name));

  const rows = exams.map((exam) => ({
    Date: exam.date,
    Heure_Debut: exam.time,
    Duree_Minutes: exam.duration,
    Promo: exam.promo,
    Matiere: exam.subject,
    Salles: exam.roomIds
      ? exam.roomIds.map((id) => roomMap.get(id) || id).join(", ")
      : "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Heure
    { wch: 15 }, // Durée
    { wch: 12 }, // Promo
    { wch: 55 }, // Matière
    { wch: 25 }, // Salles
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Examens_Liste");
  XLSX.writeFile(workbook, filename);
}

/**
 * Télécharge un modèle Excel vierge prêt à être rempli
 */
export function downloadExamTemplate() {
  const exampleRows = [
    {
      Date: "2026-11-09",
      Heure_Debut: "08:30",
      Duree_Minutes: 60,
      Promo: "FM6MD1",
      Matiere: "Chimie / Biochimie structurale",
      Salles: "Amphi 1, Amphi 2",
    },
    {
      Date: "2026-11-09",
      Heure_Debut: "10:00",
      Duree_Minutes: 60,
      Promo: "FM6MD2",
      Matiere: "Embryologie et développement crânio-facial / Anatomie tête et cou",
      Salles: "Amphi 1, Amphi 2",
    },
    {
      Date: "2026-11-09",
      Heure_Debut: "11:30",
      Duree_Minutes: 60,
      Promo: "FM6MD4",
      Matiere: "Pathologie dento-maxillaire / Dentition / Dysmorphoses",
      Salles: "Amphi 1, Amphi 2",
    },
    {
      Date: "2026-11-09",
      Heure_Debut: "14:30",
      Duree_Minutes: 60,
      Promo: "FM6MD3",
      Matiere: "Thérapeutique dentino pulpaire pédiatrique / Prothèse conjointe plurale",
      Salles: "Amphi 1, Amphi 2",
    },
    {
      Date: "2026-11-09",
      Heure_Debut: "16:00",
      Duree_Minutes: 60,
      Promo: "FM6MD5",
      Matiere: "Prothèse maxillo-faciale / Prothèses spécifiques",
      Salles: "Amphi 1, Amphi 2",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(exampleRows);
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 15 },
    { wch: 12 },
    { wch: 65 },
    { wch: 25 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Examens_Modele");
  XLSX.writeFile(workbook, "Modele_Planning_Examens.xlsx");
}
