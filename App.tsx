import React, { useState, useEffect } from "react";
import {
  Professor,
  Resident,
  Room,
  Exam,
  Assignment,
  AppTab,
  UserSession,
  Proctor,
} from "./types";
import {
  INITIAL_PROFESSORS,
  INITIAL_RESIDENTS,
  INITIAL_ROOMS,
  INITIAL_EXAMS,
  ICONS,
} from "./constants";
import ConfigTab from "./components/ConfigTab";
import PlanningTab from "./components/PlanningTab";
import HistoryTab from "./components/HistoryTab";
import StatsTab from "./components/StatsTab";
import ProctorView from "./components/ProctorView";
import LoginScreen from "./components/LoginScreen";
import AdminProfileTab from "./components/AdminProfileTab";
import { saveToLocalStorage, loadFromLocalStorage } from "./utils/storage";
import { syncWithBackend, getFetchHeaders } from "./utils/apiIntegration";
import {
  adaptProfessor,
  adaptResident,
  adaptRoom,
  adaptExam,
  adaptAssignment,
  BackendProfessor,
  BackendResident,
  BackendRoom,
  BackendExam,
  BackendAssignment,
} from "./utils/apiAdapter";

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("planning");
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Data State - Chargement depuis localStorage AVANT tout (priorité locale)
  // On ne charge les données par défaut que si localStorage est vide
  const getInitialProfs = (): Professor[] => {
    const saved = loadFromLocalStorage();
    console.log(
      "📂 Chargement profs depuis localStorage:",
      saved?.profs?.length || 0,
    );
    // Priorité: localStorage > backend (chargé plus tard) > défaut
    if (saved?.profs && saved.profs.length > 0) {
      return saved.profs;
    }
    return INITIAL_PROFESSORS;
  };

  const getInitialResidents = (): Resident[] => {
    const saved = loadFromLocalStorage();
    if (saved?.residents && saved.residents.length > 0) {
      return saved.residents;
    }
    return INITIAL_RESIDENTS;
  };

  const getInitialRooms = (): Room[] => {
    const saved = loadFromLocalStorage();
    if (saved?.rooms && saved.rooms.length > 0) {
      return saved.rooms;
    }
    return INITIAL_ROOMS;
  };

  const getInitialExams = (): Exam[] => {
    const saved = loadFromLocalStorage();
    if (saved?.exams && saved.exams.length > 0) {
      return saved.exams;
    }
    return INITIAL_EXAMS;
  };

  const [profs, setProfs] = useState<Professor[]>(getInitialProfs);
  const [residents, setResidents] = useState<Resident[]>(getInitialResidents);
  const [rooms, setRooms] = useState<Room[]>(getInitialRooms);
  const [exams, setExams] = useState<Exam[]>(getInitialExams);
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = loadFromLocalStorage();
    return saved?.assignments || [];
  });
  const [proctors, setProctors] = useState<Proctor[]>(() => {
    return []; // Initialize empty, will load from backend if available
  });

  // Sauvegarder automatiquement quand les données changent (VERS localStorage)
  useEffect(() => {
    console.log("💾 Sauvegarde vers localStorage:", {
      profs: profs.length,
      residents: residents.length,
      rooms: rooms.length,
      exams: exams.length,
    });
    saveToLocalStorage(profs, residents, rooms, exams, assignments);
  }, [profs, residents, rooms, exams, assignments]);

  // charger les données depuis le backend SEULEMENT si localStorage est vide
  // Le backend sert de sauvegarde secondaire, mais on ne remplace pas les données locales
  useEffect(() => {
    const checkBackendAndLoadData = async () => {
      const backend = await syncWithBackend();
      if (backend?.isBackendAvailable && user) {
        setIsBackendAvailable(true);
        await loadDataFromBackend(backend.apiUrl);
      }
    };

    if (user) {
      checkBackendAndLoadData();
    }
  }, [user]);

  // Charger les données depuis le backend SEULEMENT si localStorage est vide (fallback)
  const loadDataFromBackend = async (apiUrl: string) => {
    setIsLoadingData(true);
    try {
      const headers = getFetchHeaders();
      const saved = loadFromLocalStorage();

      // Charger les professors - SEULEMENT si localStorage est vide
      const profsRes = await fetch(`${apiUrl}/professors`, { headers });
      if (profsRes.ok) {
        const backendProfs: BackendProfessor[] = await profsRes.json();
        // Utiliser backend seulement si localStorage est vide
        if (
          backendProfs &&
          backendProfs.length > 0 &&
          (!saved?.profs || saved.profs.length === 0)
        ) {
          setProfs(backendProfs.map(adaptProfessor));
        }
      }

      // Charger les résidents - SEULEMENT si localStorage est vide
      const residentsRes = await fetch(`${apiUrl}/residents`, { headers });
      if (residentsRes.ok) {
        const backendResidents: BackendResident[] = await residentsRes.json();
        if (
          backendResidents &&
          backendResidents.length > 0 &&
          (!saved?.residents || saved.residents.length === 0)
        ) {
          setResidents(backendResidents.map(adaptResident));
        }
      }

      // Charger les salles - SEULEMENT si localStorage est vide
      const roomsRes = await fetch(`${apiUrl}/rooms`, { headers });
      if (roomsRes.ok) {
        const backendRooms: BackendRoom[] = await roomsRes.json();
        if (
          backendRooms &&
          backendRooms.length > 0 &&
          (!saved?.rooms || saved.rooms.length === 0)
        ) {
          setRooms(backendRooms.map(adaptRoom));
        }
      }

      // Charger les examens - SEULEMENT si localStorage est vide
      const examsRes = await fetch(`${apiUrl}/exams`, { headers });
      if (examsRes.ok) {
        const backendExams: BackendExam[] = await examsRes.json();
        if (
          backendExams &&
          backendExams.length > 0 &&
          (!saved?.exams || saved.exams.length === 0)
        ) {
          setExams(backendExams.map(adaptExam));
        }
      }

      // Charger les surveillants (proctors) - SEULEMENT si vide
      const proctorsRes = await fetch(`${apiUrl}/proctors`, { headers });
      if (proctorsRes.ok) {
        const backendProctors = await proctorsRes.json();
        if (backendProctors && backendProctors.length > 0) {
          setProctors(backendProctors);
        }
      }

      // Charger les assignments - SEULEMENT si localStorage est vide
      const assignmentsRes = await fetch(`${apiUrl}/assignments`, { headers });
      if (assignmentsRes.ok) {
        const backendAssignments: BackendAssignment[] =
          await assignmentsRes.json();
        // Utiliser backend seulement si localStorage est vide
        if (
          backendAssignments &&
          backendAssignments.length > 0 &&
          (!saved?.assignments || saved.assignments.length === 0)
        ) {
          const roomsMap = new Map<string, Room>(
            rooms.map((r: Room) => [r.id, r]),
          );
          setAssignments(
            backendAssignments.map((a) => adaptAssignment(a, roomsMap)),
          );
        }
      }
    } catch (error) {
      console.warn("Erreur lors du chargement des données du backend:", error);
      // Garder les données locales en cas d'erreur
    } finally {
      setIsLoadingData(false);
    }
  };

  // Sync with Proctor View when logging in
  useEffect(() => {
    if (user?.role === "PROCTOR") {
      setActiveTab("my-planning");
    } else if (user?.role === "ADMIN") {
      setActiveTab("planning");
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("access_token");
  };

  if (!user) {
    return (
      <LoginScreen onLogin={setUser} profs={profs} residents={residents} />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <ICONS.GraduationCap className="w-8 h-8 text-indigo-200" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                APP surveillances UM6SS
              </h1>
              <p className="text-[10px] uppercase font-black tracking-widest text-indigo-300">
                {user.role === "SUPER_ADMIN"
                  ? "Super Administration"
                  : user.role === "ADMIN"
                    ? "Administration Centrale"
                    : `Espace ${user.type === "prof" ? "Enseignant" : "Résident"}`}
              </p>
            </div>
          </div>

          <nav className="flex bg-indigo-800/50 rounded-lg p-1">
            {user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? (
              <>
                <button
                  onClick={() => setActiveTab("config")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "config" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-indigo-600/50 text-indigo-100"}`}
                >
                  Configuration
                </button>
                <button
                  onClick={() => setActiveTab("planning")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "planning" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-indigo-600/50 text-indigo-100"}`}
                >
                  Planning Global
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "history" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-indigo-600/50 text-indigo-100"}`}
                >
                  Historique
                </button>
                <button
                  onClick={() => setActiveTab("stats")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "stats" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-indigo-600/50 text-indigo-100"}`}
                >
                  Équité
                </button>
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "profile" ? "bg-white text-indigo-700 shadow-sm" : "hover:bg-indigo-600/50 text-indigo-100"}`}
                >
                  Profil
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab("my-planning")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium bg-white text-indigo-700 shadow-sm`}
              >
                Mon Planning
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold">{user.name}</div>
              <button
                onClick={handleLogout}
                className="text-[10px] text-indigo-300 hover:text-white uppercase font-black"
              >
                Déconnexion
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="sm:hidden p-2 bg-indigo-800 rounded-lg"
            >
              <ICONS.Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>
        </div>
      </header>

      <main
        className={`flex-1 mx-auto w-full p-6 transition-all duration-300 ${
          activeTab === "planning" ? "max-w-[98%]" : "max-w-7xl"
        }`}
      >
        {activeTab === "config" && (
          <ConfigTab
            profs={profs}
            setProfs={setProfs}
            residents={residents}
            setResidents={setResidents}
            rooms={rooms}
            setRooms={setRooms}
            exams={exams}
            setExams={setExams}
            proctors={proctors}
            setProctors={setProctors}
          />
        )}
        {activeTab === "planning" && (
          <PlanningTab
            profs={profs}
            residents={residents}
            rooms={rooms}
            exams={exams}
            assignments={assignments}
            setAssignments={setAssignments}
            proctors={proctors}
          />
        )}
        {activeTab === "history" && (
          <HistoryTab profs={profs} residents={residents} rooms={rooms} />
        )}
        {activeTab === "stats" && (
          <StatsTab
            profs={profs}
            residents={residents}
            assignments={assignments}
          />
        )}
        {activeTab === "my-planning" && (
          <ProctorView
            user={user}
            exams={exams}
            assignments={assignments}
            rooms={rooms}
            profs={profs}
            residents={residents}
          />
        )}
        {activeTab === "profile" && <AdminProfileTab user={user} />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
        Portail de Surveillance • Faculté de Médecine Dentaire
      </footer>
    </div>
  );
};

export default App;
