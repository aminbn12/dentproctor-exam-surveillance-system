import React, { useMemo } from "react";
import { Professor, Resident, Assignment } from "../types";
import { ICONS } from "../constants";
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
  assignments: Assignment[];
}

const StatsTab: React.FC<StatsTabProps> = ({
  profs,
  residents,
  assignments,
}) => {
  const shiftCounts = useMemo(
    () => getShiftCounts(assignments, profs, residents),
    [assignments, profs, residents],
  );

  const profData = useMemo(() => {
    const list = profs
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.rank,
        shifts: shiftCounts[p.id] || 0,
      }))
      .sort((a, b) => b.shifts - a.shifts);
    const total = list.reduce((acc, curr) => acc + curr.shifts, 0);
    const avg = list.length ? total / list.length : 0;
    return { list, avg };
  }, [profs, shiftCounts]);

  const residentData = useMemo(() => {
    const list = residents
      .map((r) => ({
        id: r.id,
        name: r.name,
        role: `A${r.level}`,
        shifts: shiftCounts[r.id] || 0,
      }))
      .sort((a, b) => b.shifts - a.shifts);
    const total = list.reduce((acc, curr) => acc + curr.shifts, 0);
    const avg = list.length ? total / list.length : 0;
    return { list, avg };
  }, [residents, shiftCounts]);

  const renderSection = (
    title: string,
    data: { list: any[]; avg: number },
    icon: React.ReactNode,
    primaryColor: string,
  ) => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <div className={`p-2 rounded-lg ${primaryColor} text-white shadow-sm`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-800 tracking-tight">
          {title}
        </h3>
        <div className="ml-auto text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-200">
          Moyenne : {data.avg.toFixed(1)} surveillances
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
                    if (entry.shifts === 0)
                      color = "#94a3b8"; // Slate (Inactif)
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
              Inactif (0)
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
                  <th className="text-left py-3">Promotion</th>
                  <th className="text-right py-3">Total</th>
                  <th className="text-right py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.list.map((s) => {
                  const diff = s.shifts - data.avg;
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="py-3 font-bold text-slate-700">
                        {s.name}
                      </td>
                      <td className="py-3 text-slate-500 font-medium text-xs uppercase">
                        {s.role}
                      </td>
                      <td className="py-3 text-right font-black text-indigo-950">
                        {s.shifts}
                      </td>
                      <td className="py-3 text-right">
                        {s.shifts === 0 ? (
                          <span className="text-[9px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 uppercase animate-pulse">
                            Inactif
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
            {profs.length + residents.length}
          </div>
          <div className="flex items-center gap-3 mt-4 text-indigo-200 text-[10px] font-bold uppercase tracking-widest">
            <span>{profs.length} PR/DR</span>
            <span className="w-1 h-1 bg-indigo-400 rounded-full"></span>
            <span>{residents.length} Résidents</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200 group hover:border-indigo-300 transition-all">
          <div className="text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">
            Charge Moyenne
          </div>
          <div className="text-5xl font-black text-slate-800 mt-2 leading-none">
            {(
              (Object.values(shiftCounts) as number[]).reduce(
                (a, b) => a + b,
                0,
              ) / (profs.length + residents.length || 1)
            ).toFixed(1)}
          </div>
          <div className="text-[10px] text-indigo-600 mt-4 font-black uppercase tracking-widest flex items-center gap-2">
            <ICONS.CheckCircle2 className="w-3 h-3" /> Gardes / personne
          </div>
        </div>

        <div className="bg-emerald-500 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
          <ICONS.Sparkles className="absolute -right-4 -bottom-4 w-32 h-32 opacity-10" />
          <div className="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em]">
            Couverture
          </div>
          <div className="text-5xl font-black mt-2 leading-none">
            {residents.filter((r) => (shiftCounts[r.id] || 0) > 0).length}
          </div>
          <div className="text-[10px] text-emerald-100 mt-4 font-bold uppercase tracking-widest">
            Résidents actifs sur {residents.length}
          </div>
        </div>
      </div>

      {renderSection(
        "Équité Enseignants",
        profData,
        <ICONS.GraduationCap className="w-6 h-6" />,
        "bg-indigo-600",
      )}

      {renderSection(
        "Équité Résidents (Mixité des Années)",
        residentData,
        <ICONS.Users className="w-6 h-6" />,
        "bg-emerald-600",
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default StatsTab;
