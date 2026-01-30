// Utilitaire pour la persistance de données dans localStorage
import { Professor, Resident, Room, Exam, Assignment } from '../types';

const STORAGE_KEYS = {
  PROFS: 'dentproctor_profs',
  RESIDENTS: 'dentproctor_residents',
  ROOMS: 'dentproctor_rooms',
  EXAMS: 'dentproctor_exams',
  ASSIGNMENTS: 'dentproctor_assignments'
};

export const saveToLocalStorage = (
  profs: Professor[],
  residents: Resident[],
  rooms: Room[],
  exams: Exam[],
  assignments: Assignment[]
) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFS, JSON.stringify(profs));
    localStorage.setItem(STORAGE_KEYS.RESIDENTS, JSON.stringify(residents));
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
    localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
  }
};

export const loadFromLocalStorage = () => {
  try {
    return {
      profs: JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFS) || '[]') as Professor[],
      residents: JSON.parse(localStorage.getItem(STORAGE_KEYS.RESIDENTS) || '[]') as Resident[],
      rooms: JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS) || '[]') as Room[],
      exams: JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAMS) || '[]') as Exam[],
      assignments: JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS) || '[]') as Assignment[]
    };
  } catch (error) {
    console.error('Erreur lors du chargement:', error);
    return null;
  }
};

export const clearLocalStorage = () => {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
};

export const exportToJSON = (
  profs: Professor[],
  residents: Resident[],
  rooms: Room[],
  exams: Exam[],
  assignments: Assignment[],
  filename: string = `dentproctor-backup-${new Date().toISOString().split('T')[0]}.json`
) => {
  const data = { profs, residents, rooms, exams, assignments };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const importFromJSON = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch (error) {
        reject('Format JSON invalide');
      }
    };
    reader.onerror = () => reject('Erreur de lecture du fichier');
    reader.readAsText(file);
  });
};
