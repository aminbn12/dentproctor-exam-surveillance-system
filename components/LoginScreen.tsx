import React, { useState, useEffect } from "react";
import { ICONS } from "../constants";
import { UserSession } from "../types";
import { syncWithBackend, setAuthToken } from "../utils/apiIntegration";
import { AuthResponse } from "../types/api";

interface LoginScreenProps {
  onLogin: (user: UserSession) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);

  // Vérifier la disponibilité du backend au démarrage
  useEffect(() => {
    const checkBackend = async () => {
      const backend = await syncWithBackend();
      setIsBackendAvailable(backend?.isBackendAvailable ?? false);
    };
    checkBackend();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const apiUrl = "/api";
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Identifiants incorrects");
      }

      const data: AuthResponse = await response.json();

      // Stocker le token
      setAuthToken(data.access_token);

      // Se connecter
      onLogin({
        id: data.user.id,
        name: data.user.full_name || data.user.username,
        role: data.user.role as "ADMIN" | "PROCTOR",
        type: data.user.staff_type as "prof" | "resident",
      });
    } catch (err: any) {
      setError(err.message || "Erreur de connexion au serveur Python.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <ICONS.GraduationCap className="absolute -top-10 -left-10 w-96 h-96 rotate-12" />
        <ICONS.Users className="absolute -bottom-20 -right-20 w-[30rem] h-[30rem] -rotate-12" />
      </div>

      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-8 sm:p-12 z-10 animate-in fade-in zoom-in duration-500">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 bg-indigo-50 rounded-3xl text-indigo-600 mb-6">
            <ICONS.GraduationCap className="w-12 h-12" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">
            DentProctor
          </h1>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em]">
            {isBackendAvailable
              ? "✅ Backend Python Actif"
              : "⚠️ Mode Hors-Ligne"}
          </p>
        </div>

        {!isBackendAvailable && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
            <p className="text-[11px] font-bold text-yellow-700">
              ⚠️ Le backend n'est pas disponible. Lancez le serveur Python.
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
              <ICONS.AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-[11px] font-bold text-red-700 leading-tight">
                {error}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Identifiant
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <ICONS.User className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-5 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm"
                disabled={!isBackendAvailable}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Mot de passe
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <ICONS.Lock className="w-4 h-4 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-11 pr-12 py-4 font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all text-sm"
                disabled={!isBackendAvailable}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-300 hover:text-indigo-500 transition-colors"
              >
                {showPassword ? (
                  <ICONS.EyeOff className="w-4 h-4" />
                ) : (
                  <ICONS.Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !isBackendAvailable}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 mt-4"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Connexion...
              </>
            ) : (
              "🔓 Se connecter"
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            📝 Identifiants de Test:
          </p>
          <div className="space-y-2 text-[10px]">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="font-bold text-slate-700">Admin:</p>
              <code className="text-slate-600">admin / admin123</code>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="font-bold text-slate-700">Professeur:</p>
              <code className="text-slate-600">khalifa / prof123</code>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="font-bold text-slate-700">Résident:</p>
              <code className="text-slate-600">achaari / resident123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
