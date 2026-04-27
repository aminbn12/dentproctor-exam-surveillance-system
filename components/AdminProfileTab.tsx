import React, { useState, useEffect } from "react";
import { ICONS } from "../constants";
import { UserSession } from "../types";
import {
  AdminUser,
  getCurrentUserProfileApi,
  updateCurrentUserProfileApi,
  getAllUsersApi,
  createAdminUserApi,
  updateUserByIdApi,
  deleteUserApi,
  fetchProfessorsApi,
  fetchResidentsApi,
  CreateAdminRequest,
  UpdateAdminRequest,
} from "../utils/apiIntegration";

interface AdminProfileTabProps {
  user: UserSession;
}

const AdminProfileTab: React.FC<AdminProfileTabProps> = ({ user }) => {
  const [currentProfile, setCurrentProfile] = useState<AdminUser | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [allProfessors, setAllProfessors] = useState<any[]>([]);
  const [allResidents, setAllResidents] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"admins" | "staff">("admins");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<UpdateAdminRequest>({});

  // Create user form (for SUPER_ADMIN)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdminRequest>({
    username: "",
    email: "",
    password: "",
    full_name: "",
    department: "",
    role: "ADMIN",
  });

  const isSuperAdmin = user.role === "SUPER_ADMIN";

  useEffect(() => {
    loadProfile();
    if (isSuperAdmin) {
      loadAllUsers();
    }
  }, [isSuperAdmin]);

  const loadProfile = async () => {
    try {
      const profile = await getCurrentUserProfileApi();
      setCurrentProfile(profile);
      setProfileForm({
        email: profile.email,
        full_name: profile.full_name || "",
        department: profile.department || "",
      });
    } catch (err: any) {
      setError("Erreur lors du chargement du profil");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const users = await getAllUsersApi();
      setAllUsers(users);

      // Load professors and residents for staff view
      try {
        const professors = await fetchProfessorsApi();
        setAllProfessors(professors);
      } catch (e) {
        console.error("Error loading professors:", e);
      }

      try {
        const residents = await fetchResidentsApi();
        setAllResidents(residents);
      } catch (e) {
        console.error("Error loading residents:", e);
      }
    } catch (err: any) {
      console.error("Erreur lors du chargement des utilisateurs:", err);
    }
  };

  const handleUpdateProfile = async () => {
    try {
      setError(null);
      const updated = await updateCurrentUserProfileApi(profileForm);
      setCurrentProfile(updated);
      setIsEditingProfile(false);
      setSuccess("Profil mis à jour avec succès");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour du profil");
    }
  };

  const handleCreateUser = async () => {
    try {
      setError(null);
      await createAdminUserApi(createForm);
      setShowCreateForm(false);
      setCreateForm({
        username: "",
        email: "",
        password: "",
        full_name: "",
        department: "",
        role: "ADMIN",
      });
      setSuccess("Utilisateur créé avec succès");
      loadAllUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création de l'utilisateur");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur?")
    ) {
      return;
    }
    try {
      await deleteUserApi(userId);
      setSuccess("Utilisateur supprimé avec succès");
      loadAllUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression de l'utilisateur");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">
        Mon Profil Administrateur
      </h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      {/* Current User Profile Card */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-700">
            Informations du profil
          </h3>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ICONS.Settings className="w-4 h-4" />
              Modifier
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nom d'utilisateur
            </label>
            <input
              type="text"
              value={currentProfile?.username || ""}
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Rôle
            </label>
            <input
              type="text"
              value={
                currentProfile?.role === "SUPER_ADMIN"
                  ? "Super Administrateur"
                  : currentProfile?.role === "ADMIN"
                    ? "Administrateur"
                    : "Surveillant"
              }
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Email
            </label>
            {isEditingProfile ? (
              <input
                type="email"
                value={profileForm.email || ""}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, email: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            ) : (
              <input
                type="text"
                value={currentProfile?.email || ""}
                disabled
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nom complet
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.full_name || ""}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, full_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            ) : (
              <input
                type="text"
                value={currentProfile?.full_name || ""}
                disabled
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Département
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.department || ""}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, department: e.target.value })
                }
                placeholder="Ex: Médecine Dentaire, Chirurgie, etc."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            ) : (
              <input
                type="text"
                value={currentProfile?.department || ""}
                disabled
                placeholder="Non défini"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Statut du compte
            </label>
            <input
              type="text"
              value={currentProfile?.is_active ? "Actif" : "Inactif"}
              disabled
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
          </div>
        </div>

        {isEditingProfile && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleUpdateProfile}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ICONS.CheckCircle2 className="w-4 h-4" />
              Enregistrer
            </button>
            <button
              onClick={() => {
                setIsEditingProfile(false);
                setProfileForm({
                  email: currentProfile?.email,
                  full_name: currentProfile?.full_name,
                  department: currentProfile?.department,
                });
              }}
              className="px-6 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* SUPER_ADMIN: User Management */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-700">
              Gestion des utilisateurs
            </h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <ICONS.UserPlus className="w-4 h-4" />
              Nouvel utilisateur
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setViewMode("admins")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "admins"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Administrateurs
            </button>
            <button
              onClick={() => setViewMode("staff")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "staff"
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Personnel (Pr/Dr & Résidents)
            </button>
          </div>

          {/* Create User Form */}
          {showCreateForm && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h4 className="font-medium text-slate-700 mb-4">
                Créer un nouvel utilisateur
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Nom d'utilisateur *
                  </label>
                  <input
                    type="text"
                    value={createForm.username}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, username: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, password: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Rôle
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, role: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="ADMIN">Administrateur</option>
                    <option value="SUPER_ADMIN">Super Administrateur</option>
                    <option value="PROCTOR">Surveillant</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={createForm.full_name || ""}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        full_name: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Département
                  </label>
                  <input
                    type="text"
                    value={createForm.department || ""}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        department: e.target.value,
                      })
                    }
                    placeholder="Ex: Médecine Dentaire"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleCreateUser}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <ICONS.CheckCircle2 className="w-4 h-4" />
                  Créer
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="overflow-x-auto">
            {viewMode === "admins" ? (
              <>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">
                        Utilisateur
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">
                        Rôle
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">
                        Département
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">
                        Statut
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">
                            {u.full_name || u.username}
                          </div>
                          <div className="text-sm text-slate-500">
                            @{u.username}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{u.email}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              u.role === "SUPER_ADMIN"
                                ? "bg-purple-100 text-purple-700"
                                : u.role === "ADMIN"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {u.role === "SUPER_ADMIN"
                              ? "Super Admin"
                              : u.role === "ADMIN"
                                ? "Admin"
                                : "Surveillant"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {u.department || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              u.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {u.is_active ? "Actif" : "Inactif"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {u.id !== currentProfile?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <ICONS.Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                {/* Professors Section */}
                {allProfessors.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold text-slate-700 mb-3">
                      Professeurs (Pr/Dr)
                    </h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">
                            Nom
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">
                            Grade
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">
                            Promo Responsable
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allProfessors.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4 font-medium text-slate-800">
                              {p.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {p.rank}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {p.responsible_promo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Residents Section */}
                {allResidents.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-700 mb-3">
                      Résidents
                    </h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">
                            Nom
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">
                            Niveau
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-600">
                            Spécialité
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {allResidents.map((r) => (
                          <tr
                            key={r.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4 font-medium text-slate-800">
                              {r.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              Niveau {r.level}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {r.specialty || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {allProfessors.length === 0 && allResidents.length === 0 && (
                  <p className="text-slate-500 text-center py-8">
                    Aucun personnel trouvé. Ajoutez des Professors et Résidents
                    dans l'onglet Configuration.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileTab;
