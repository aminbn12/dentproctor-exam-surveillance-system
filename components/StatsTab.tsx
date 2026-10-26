import React, { useMemo } from "react";
import { Professor, Resident, Assignment, Proctor } from "../types";
import { ICONS } from "../constants";
import { ShieldCheck } from "lucide-react";
import { getShiftCounts } from "../services/schedulerService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface StatsTabProps {
  profs: Professor[];
  residents: Resident[];
  proctors?: Proctor[];
  assignments: Assignment[];
}

const StatsTab: React.FC<StatsTabProps> = ({
  profs,
  residents,
  proctors = [],
  assignments,
}) => {
  const shiftCounts = useMemo(
    () => getShiftCounts(assignments, profs, residents, proctors),
    [assignments, profs, residents, proctors],
  );

  const profData = useMemo(() => {
    const list = profs
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.rank,
        shifts: shiftCounts[p.id] || 0,
        isActive: true,
      }))
      .sort((a, b) => b.shifts - a.shifts);
    const total = list.reduce((acc, curr) => acc + curr.shifts, 0);
    const avg = list.length ? total / list.length : 0;
    return { list, avg, totalStaff: list.length, activeStaff: list.length };
  }, [profs, shiftCounts]);

  const residentData = useMemo(() => {
    const list = residents
      .map((r) => ({
        id: r.id,
        name: r.name,
        role: `R${r.level}`,
        shifts: shiftCounts[r.id] || 0,
        isActive: true,
      }))
      .sort((a, b) => b.shifts - a.shifts);
    const total = list.reduce((acc, curr) => acc + curr.shifts, 0);
    const avg = list.length ? total / list.length : 0;
    return { list, avg, totalStaff: list.length, activeStaff: list.length };
  }, [residents, shiftCounts]);

  const proctorData = useMemo(() => {
    const list = (proctors || [])
      .map((p) => {
        const cat = p.specialty || "Administration";
        const isDual = cat.includes("Administration") && cat.includes("Zones");
        const tag = isDual
          ? "ADM+ZONE"
          : cat === "IT"
            ? "IT"
            : cat === "Responsables de Zones"
              ? "ZONE"
              : "ADM";
        const isActive = p.is_active === 1 || (p.is_active as any) === true;
        return {
          id: p.id,
          name: p.name,
          role: tag,
          fullRole: cat,
          shifts: shiftCounts[p.id] || 0,
          isActive,
        };
      })
      .sort((a, b) => b.shifts - a.shifts);

    const activeList = list.filter((p) => p.isActive);
    const total = activeList.reduce((acc, curr) => acc + curr.shifts, 0);
    const avg = activeList.length ? total / activeList.length : 0;
    return { list, avg, totalStaff: list.length, activeStaff: activeList.length };
  }, [proctors, shiftCounts]);

  const totalStaffCount = profs.length + residents.length + (proctors || []).length;
  const activeProctorCount = (proctors || []).filter(
    (p) => p.is_active === 1 || (p.is_active as any) === true,
  ).length;
  const totalActiveStaffCount = profs.length + residents.length + activeProctorCount;

  const totalAssignedShifts = useMemo(() => {
    return (Object.values(shiftCounts) as number[]).reduce((a, b) => a + b, 0);
  }, [shiftCounts]);

  const overallAvgShifts = totalActiveStaffCount > 0
    ? (totalAssignedShifts / totalActiveStaffCount).toFixed(1)
    : "0.0";

  const mobilizedStaffCount = useMemo(() => {
    const all = [...profs, ...residents, ...(proctors || [])];
    return all.filter((p) => (shiftCounts[p.id] || 0) > 0).length;
  }, [profs, residents, proctors, shiftCounts]);

  const renderSection = (
    title: string,
    data: { list: any[]; avg: number; totalStaff?: number; activeStaff?: number },
    icon: React.ReactNode,
    primaryColor: string,
    roleColumnLabel: string = "Grade / Rôle",
  ) => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-2">
        <div className={`p-2 rounded-lg ${primaryColor} text-white shadow-sm`}>
          {icon}
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            {title}
          </h3>
          {data.totalStaff !== undefined && (
            <div className="text-[11px] text-slate-400 font-bold mt-0.5">
              {data.activeStaff ?? data.totalStaff} actif(s) sur {data.totalStaff}
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="text-[11px] font-black text-slate-600 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider border border-slate-200">
            Moyenne : {data.avg.toFixed(1)} surveillances
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="font-black text-slate-400 mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <ICONS.BarChart3 className="w-4 h-4" /> Analyse de Distribution
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.list}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis dataKey="name" hide />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontWeight: 600 }}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    padding: "12px",
                  }}
                  labelStyle={{
                    fontWeight: "900",
                    color: "#1e293b",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    fontSize: "10px",
                  }}
                  formatter={(value) => [`${value} gardes`, "Surveillances"]}
                />
                <Bar dataKey="shifts" radius={[4, 4, 0, 0]}>
                  {data.list.map((entry, index) => {
                    const diff = entry.shifts - data.avg;
                    let color = "#6366f1"; // Indigo (Normal)
                    if (entry.isActive === false)
                      color = "#cbd5e1"; // Slate clair (Désactivé)
                    else if (entry.shifts === 0)
                      color = "#94a3b8"; // Slate (Inactif 0 garde)
                    else if (diff > 1.2)
                      color = "#ef4444"; // Red (Surcharge)
                    else if (diff < -1.2) color = "#10b981"; // Green (Sous-charge)
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-[9px] justify-center font-black uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>{" "}
              Surcharge
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>{" "}
              Équilibré
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>{" "}
              Sous-charge
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-slate-400 rounded-full"></span>{" "}
              0 Garde
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-slate-300 rounded-full"></span>{" "}
              Désactivé
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h4 className="font-black text-slate-400 mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest">
            <ICONS.Users className="w-4 h-4" /> Tableau de bord Équité
          </h4>
          <div className="overflow-y-auto max-h-64 pr-2 custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="text-[10px] uppercase font-black text-slate-400 sticky top-0 bg-white z-10 border-b border-slate-100">
                <tr>
                  <th className="text-left py-3">Individu</th>
                  <th className="text-left py-3">{roleColumnLabel}</th>
                  <th className="text-right py-3">Total</th>
                  <th className="text-right py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.list.map((s) => {
                  const diff = s.shifts - data.avg;
                  const isDeactivated = s.isActive === false;

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 transition-colors group ${isDeactivated ? "opacity-60 bg-slate-50/50" : ""}`}
                    >
                      <td className="py-3 font-bold text-slate-700">
                        {s.name}
                      </td>
                      <td className="py-3 text-slate-500 font-medium text-xs">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                          {s.role}
                        </span>
                      </td>
                      <td className="py-3 text-right font-black text-indigo-950">
                        {s.shifts}
                      </td>
                      <td className="py-3 text-right">
                        {isDeactivated ? (
                          <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 uppercase">
                            Désactivé
                          </span>
                        ) : s.shifts === 0 ? (
                          <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 uppercase animate-pulse">
                            0 Garde
                          </span>
                        ) : diff > 1.2 ? (
                          <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100 uppercase">
                            Surcharge
                          </span>
                        ) : diff < -1.2 ? (
                          <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">
                            Disponible
                          </span>
                        ) : (
                          <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase">
                            Équilibré
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-indigo-600 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <ICONS.GraduationCap className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10 rotate-12" />
          <div className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em]">
            Effectif Global
          </div>
          <div className="text-5xl font-black mt-2 leading-none">
            {totalStaffCount}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 text-indigo-200 text-[10px] font-bold uppercase tracking-wider">
            <span>{profs.length} PR/DR</span>
            <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
            <span>{residents.length} Résidents</span>
            <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
            <span>{(proctors || []).length} Admin/Support</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 group hover:border-indigo-300 transition-all">
          <div className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
            Charge Moyenne
          </div>
          <div className="text-5xl font-black text-slate-800 mt-2 leading-none">
            {overallAvgShifts}
          </div>
          <div className="text-[10px] text-indigo-600 mt-4 font-black uppercase tracking-widest flex items-center gap-2">
            <ICONS.CheckCircle2 className="w-3 h-3" /> Gardes / personne active
          </div>
        </div>

        <div className="bg-emerald-500 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <ICONS.Sparkles className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
          <div className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em]">
            Mobilisation
          </div>
          <div className="text-5xl font-black mt-2 leading-none">
            {mobilizedStaffCount}
          </div>
          <div className="text-[10px] text-emerald-100 mt-4 font-bold uppercase tracking-widest">
            Personnes mobilisées sur {totalStaffCount}
          </div>
        </div>
      </div>

      {renderSection(
        "Équité Enseignants",
        profData,
        <ICONS.GraduationCap className="w-6 h-6" />,
        "bg-indigo-600",
        "Grade",
      )}

      {renderSection(
        "Équité Résidents (Mixité des Années)",
        residentData,
        <ICONS.Users className="w-6 h-6" />,
        "bg-emerald-600",
        "Niveau",
      )}

      {renderSection(
        "Équité Administration & Support",
        proctorData,
        <ShieldCheck className="w-6 h-6" />,
        "bg-sky-600",
        "Rôle / Pôle",
      )}
    </div>
  );
};

export default StatsTab;
