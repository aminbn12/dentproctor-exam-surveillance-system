
import React, { useState, useEffect } from 'react';
import { 
  Professor, Resident, Room, Exam, Assignment, AppTab, UserSession 
} from './types';
import { 
  INITIAL_PROFESSORS, 
  INITIAL_RESIDENTS, 
  INITIAL_ROOMS, 
  INITIAL_EXAMS, 
  ICONS 
} from './constants';
import ConfigTab from './components/ConfigTab';
import PlanningTab from './components/PlanningTab';
import StatsTab from './components/StatsTab';
import ProctorView from './components/ProctorView';
import LoginScreen from './components/LoginScreen';
import { saveToLocalStorage, loadFromLocalStorage } from './utils/storage';
import { syncWithBackend, getFetchHeaders } from './utils/apiIntegration';
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
  BackendAssignment
} from './utils/apiAdapter';

const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('planning');
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Data State - Chargement depuis localStorage ou valeurs par défaut
  const [profs, setProfs] = useState<Professor[]>(() => {
    const saved = loadFromLocalStorage();
    return saved?.profs?.length ? saved.profs : INITIAL_PROFESSORS;
  });
  const [residents, setResidents] = useState<Resident[]>(() => {
    const saved = loadFromLocalStorage();
    return saved?.residents?.length ? saved.residents : INITIAL_RESIDENTS;
  });
  const [rooms, setRooms] = useState<Room[]>(() => {
    const saved = loadFromLocalStorage();
    return saved?.rooms?.length ? saved.rooms : INITIAL_ROOMS;
  });
  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = loadFromLocalStorage();
    return saved?.exams?.length ? saved.exams : INITIAL_EXAMS;
  });
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = loadFromLocalStorage();
    return saved?.assignments || [];
  });

  // Sauvegarder automatiquement quand les données changent
  useEffect(() => {
    saveToLocalStorage(profs, residents, rooms, exams, assignments);
  }, [profs, residents, rooms, exams, assignments]);

  // Vérifier la disponibilité du backend et charger les données
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

  // Charger les données depuis le backend
  const loadDataFromBackend = async (apiUrl: string) => {
    setIsLoadingData(true);
    try {
      const headers = getFetchHeaders();
      
      // Charger les professeurs
      const profsRes = await fetch(`${apiUrl}/professors`, { headers });
      if (profsRes.ok) {
        const backendProfs: BackendProfessor[] = await profsRes.json();
        setProfs(backendProfs.map(adaptProfessor));
      }
      
      // Charger les résidents
      const residentsRes = await fetch(`${apiUrl}/residents`, { headers });
      if (residentsRes.ok) {
        const backendResidents: BackendResident[] = await residentsRes.json();
        setResidents(backendResidents.map(adaptResident));
      }
      
      // Charger les salles
      const roomsRes = await fetch(`${apiUrl}/rooms`, { headers });
      if (roomsRes.ok) {
        const backendRooms: BackendRoom[] = await roomsRes.json();
        setRooms(backendRooms.map(adaptRoom));
      }
      
      // Charger les examens
      const examsRes = await fetch(`${apiUrl}/exams`, { headers });
      if (examsRes.ok) {
        const backendExams: BackendExam[] = await examsRes.json();
        setExams(backendExams.map(adaptExam));
      }
      
      // Charger les assignments
      const assignmentsRes = await fetch(`${apiUrl}/assignments`, { headers });
      if (assignmentsRes.ok) {
        const backendAssignments: BackendAssignment[] = await assignmentsRes.json();
        const roomsMap = new Map(setRooms.map((r: any) => [r.id, r]));
        setAssignments(backendAssignments.map(a => adaptAssignment(a, roomsMap)));
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des données du backend:', error);
      // Garder les données locales en cas d'erreur
    } finally {
      setIsLoadingData(false);
    }
  };

  // Sync with Proctor View when logging in
  useEffect(() => {
    if (user?.role === 'PROCTOR') {
      setActiveTab('my-planning');
    } else if (user?.role === 'ADMIN') {
      setActiveTab('planning');
    }
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('access_token');
  };

  if (!user) {
    return <LoginScreen onLogin={setUser} profs={profs} residents={residents} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-indigo-700 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <ICONS.GraduationCap className="w-8 h-8 text-indigo-200" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">DentProctor</h1>
              <p className="text-[10px] uppercase font-black tracking-widest text-indigo-300">
                {user.role === 'ADMIN' ? 'Administration Centrale' : `Espace ${user.type === 'prof' ? 'Enseignant' : 'Résident'}`}
              </p>
            </div>
          </div>

          <nav className="flex bg-indigo-800/50 rounded-lg p-1">
            {user.role === 'ADMIN' ? (
              <>
                <button onClick={() => setActiveTab('config')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'config' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}>Configuration</button>
                <button onClick={() => setActiveTab('planning')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'planning' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}>Planning Global</button>
                <button onClick={() => setActiveTab('stats')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'stats' ? 'bg-white text-indigo-700 shadow-sm' : 'hover:bg-indigo-600/50 text-indigo-100'}`}>Équité</button>
              </>
            ) : (
              <button onClick={() => setActiveTab('my-planning')} className={`px-4 py-1.5 rounded-md text-sm font-medium bg-white text-indigo-700 shadow-sm`}>Mon Planning</button>
            )}
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold">{user.name}</div>
              <button onClick={handleLogout} className="text-[10px] text-indigo-300 hover:text-white uppercase font-black">Déconnexion</button>
            </div>
            <button onClick={handleLogout} className="sm:hidden p-2 bg-indigo-800 rounded-lg"><ICONS.Plus className="w-5 h-5 rotate-45" /></button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {activeTab === 'config' && <ConfigTab profs={profs} setProfs={setProfs} residents={residents} setResidents={setResidents} rooms={rooms} setRooms={setRooms} exams={exams} setExams={setExams} />}
        {activeTab === 'planning' && <PlanningTab profs={profs} residents={residents} rooms={rooms} exams={exams} assignments={assignments} setAssignments={setAssignments} />}
        {activeTab === 'stats' && <StatsTab profs={profs} residents={residents} assignments={assignments} />}
        {activeTab === 'my-planning' && <ProctorView user={user} exams={exams} assignments={assignments} rooms={rooms} profs={profs} residents={residents} />}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
        Portail de Surveillance • Faculté de Médecine Dentaire
      </footer>
    </div>
  );
};

export default App;
