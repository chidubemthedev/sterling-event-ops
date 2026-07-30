"use client";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { db } from "@/lib/firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { 
  History, 
  Search, 
  Clock, 
  User, 
  FileText, 
  Filter, 
  RefreshCw, 
  Eye, 
  X,
  FileImage,
  AlertTriangle
} from "lucide-react";

interface MovementLog {
  id: string;
  actionType: string;
  itemName: string;
  itemSku: string;
  quantity: number;
  actionedByName: string;
  createdAt: string;
  note?: string;
  snapshotUrl?: string;
  eventId?: string;
}

export default function AuditLogsPage() {
  const { workspaceId } = useWorkspaceStore();

  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  // Lightbox Modal State
  const [activeZoomUrl, setActiveZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    setLoading(true);
    const q = query(
      collection(db, "movement_logs"),
      where("workspaceId", "==", workspaceId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: MovementLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as MovementLog);
      });
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.error("Failed to fetch audit logs:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  // Filter logs based on search and action type
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.itemSku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actionedByName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.note && log.note.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesAction = actionFilter === "all" || log.actionType.toUpperCase() === actionFilter.toUpperCase();

    return matchesSearch && matchesAction;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">
            Lalterable Ledger
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white font-heading mt-1">
            Immutable Audit Trail Logs
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed">
            Legally non-deletable log registers tracing checkouts, returns, equipment damage reports, and corrections.
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-zinc-900/40 border border-zinc-850 p-5 rounded-2xl backdrop-blur-md flex flex-col md:flex-row gap-4 justify-between items-center relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />

        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search by asset, SKU, operator, or notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-zinc-600 outline-none transition-all duration-150"
          />
        </div>

        {/* Action filter */}
        <div className="flex items-center gap-3.5 w-full md:w-auto shrink-0 justify-end">
          <span className="text-[10.5px] font-bold text-zinc-400 font-sans flex items-center gap-1.5 shrink-0 select-none">
            <Filter className="size-3.5 text-zinc-500" /> Filter Logs:
          </span>
          
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-300 font-semibold outline-none focus:border-indigo-500 transition-colors cursor-pointer min-w-[130px]"
          >
            <option value="all">All Actions</option>
            <option value="checkout">Checkouts</option>
            <option value="return">Returns</option>
            <option value="damage">Damages</option>
            <option value="correction">Corrections</option>
          </select>
        </div>
      </div>

      {/* LOGS TABLE LIST */}
      <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-xs text-zinc-500 font-mono">
              <RefreshCw className="size-6 animate-spin text-indigo-500 mb-1" />
              <span>Streaming system audit files...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-2 text-xs text-zinc-500 font-medium">
              <History className="size-8 text-zinc-600 mb-1" />
              <span>No logs found matching search filters.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-900/10 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Operator</th>
                  <th className="px-6 py-4">Asset Detail</th>
                  <th className="px-6 py-4">Action Type</th>
                  <th className="px-6 py-4">Quantity</th>
                  <th className="px-6 py-4">Snapshot / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40 font-medium">
                {filteredLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = isNaN(date.getTime()) 
                    ? "N/A" 
                    : date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <tr key={log.id} className="hover:bg-zinc-900/20 transition-colors">
                      
                      {/* Timestamp */}
                      <td className="px-6 py-4 text-zinc-400 font-mono text-[10.5px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-zinc-500 shrink-0" />
                          <span>{formattedTime}</span>
                        </div>
                      </td>

                      {/* Operator Name */}
                      <td className="px-6 py-4 text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-zinc-500 shrink-0" />
                          <span>{log.actionedByName}</span>
                        </div>
                      </td>

                      {/* Item details */}
                      <td className="px-6 py-4 space-y-0.5">
                        <span className="text-zinc-200 font-bold block leading-normal">{log.itemName}</span>
                        <code className="text-[9.5px] font-mono text-zinc-500 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-900">
                          {log.itemSku}
                        </code>
                      </td>

                      {/* Action Badge */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[9px] font-black uppercase tracking-wider border ${
                          log.actionType === "CHECKOUT"
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                            : log.actionType === "RETURN"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : log.actionType === "DAMAGE"
                            ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                            : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                        }`}>
                          {log.actionType}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-4 font-mono text-zinc-200 font-bold">
                        {log.quantity} units
                      </td>

                      {/* Notes / Image Proof */}
                      <td className="px-6 py-4 space-y-1 max-w-[240px]">
                        {log.note && (
                          <p className="text-zinc-400 text-xs truncate" title={log.note}>
                            {log.note}
                          </p>
                        )}
                        {log.snapshotUrl ? (
                          <button
                            onClick={() => setActiveZoomUrl(log.snapshotUrl!)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 hover:text-white transition-all text-[10px] font-bold font-mono cursor-pointer"
                          >
                            <FileImage className="size-3 shrink-0" />
                            <span>View Proof Image</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-600 block">No Image uploaded</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- IN-APP IMAGE LIGHTBOX MODAL --- */}
      {activeZoomUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-2xl bg-zinc-950/90 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-zinc-900 border border-zinc-850 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-850 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-zinc-400 font-mono flex items-center gap-1.5">
                <FileImage className="size-4 text-indigo-400" />
                Snapshot Verification Proof Image
              </span>
              <button 
                onClick={() => setActiveZoomUrl(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Image display */}
            <div className="p-6 bg-zinc-950 flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={activeZoomUrl} 
                alt="Movement Snap verification record" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
              />
            </div>

            {/* Bottom bar */}
            <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex justify-end">
              <Button
                onClick={() => setActiveZoomUrl(null)}
                className="bg-zinc-850 text-zinc-300 hover:bg-zinc-800 text-xs font-bold border-none px-5"
              >
                Close View
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
