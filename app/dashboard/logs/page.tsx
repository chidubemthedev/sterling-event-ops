"use client";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { db } from "@/lib/firebase/config";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  History, 
  Search, 
  Clock, 
  User, 
  FileText, 
  Filter, 
  RefreshCw, 
  X,
  FileImage,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PackageCheck,
  Undo2,
  TrendingDown
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

const ITEMS_PER_PAGE = 10;

export default function AuditLogsPage() {
  const { workspaceId } = useWorkspaceStore();

  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

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

  // Reset page when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, actionFilter]);

  // Filter logs based on search and action type
  const filteredLogs = logs.filter((log) => {
    const queryLower = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !queryLower ||
      (log.itemName && log.itemName.toLowerCase().includes(queryLower)) ||
      (log.itemSku && log.itemSku.toLowerCase().includes(queryLower)) ||
      (log.actionedByName && log.actionedByName.toLowerCase().includes(queryLower)) ||
      (log.note && log.note.toLowerCase().includes(queryLower));

    let matchesAction = true;
    if (actionFilter === "checkout") {
      matchesAction = log.actionType.toUpperCase() === "CHECKOUT";
    } else if (actionFilter === "return") {
      matchesAction = log.actionType.toUpperCase() === "RETURN";
    } else if (actionFilter === "damage") {
      matchesAction = ["DAMAGE", "DAMAGED", "QUARANTINE"].includes(log.actionType.toUpperCase());
    } else if (actionFilter === "correction") {
      matchesAction = ["AUDIT_CORRECTION", "CORRECTION"].includes(log.actionType.toUpperCase());
    }

    return matchesSearch && matchesAction;
  });

  // Pagination calculation
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  return (
    <div className="space-y-8 font-sans">
      
      {/* --- 1. PAGE HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#800080] border border-purple-200 mb-2">
            CHAIN OF CUSTODY
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Audit Trail Logs
          </h1>
          <p className="text-sm text-neutral-500 mt-1 font-normal">
            Complete timestamped record of asset checkouts, returns, condition reports, and inventory adjustments.
          </p>
        </div>
      </div>

      {/* --- 2. FILTER & SEARCH BAR CONTAINER --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input 
            type="text" 
            placeholder="Search by asset name, SKU, operator email, or notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-neutral-50/60 border-neutral-200 rounded-xl pl-10 pr-4 text-xs h-10 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-[#800080]"
          />
        </div>

        {/* Action Type Filter Dropdown */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
          <span className="text-xs font-medium text-neutral-600 flex items-center gap-1.5 shrink-0 select-none">
            <Filter className="size-3.5 text-neutral-400" /> Filter Actions:
          </span>
          
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            aria-label="Filter Actions"
            className="bg-neutral-50/60 border border-neutral-200 rounded-xl px-3.5 h-10 text-xs text-neutral-800 font-medium outline-none focus:border-[#800080] transition-colors cursor-pointer min-w-[160px]"
          >
            <option value="all">All Actions</option>
            <option value="checkout">Checkout (Dispatch)</option>
            <option value="return">Return (Scan-In)</option>
            <option value="damage">Maintenance / Damage</option>
            <option value="correction">Audit Adjustment</option>
          </select>
        </div>
      </div>

      {/* --- 3. LOGS TABLE CONTAINER --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[320px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-xs text-neutral-500">
              <RefreshCw className="size-6 animate-spin text-[#800080]" />
              <span className="font-medium">Streaming system audit records...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="size-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                <History className="size-6 text-neutral-400" />
              </div>
              <h4 className="text-sm font-bold text-neutral-900">No logs found</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-md">
                No audit logs recorded yet. Operations logged via camera scanner or checkout will appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase text-xs font-semibold">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Operator</th>
                  <th className="px-6 py-3.5">Asset Detail</th>
                  <th className="px-6 py-3.5">Action Type</th>
                  <th className="px-6 py-3.5">Quantity</th>
                  <th className="px-6 py-3.5">Snapshot / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/80">
                {paginatedLogs.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = isNaN(date.getTime()) 
                    ? "N/A" 
                    : date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  const actionUpper = (log.actionType || "").toUpperCase();

                  return (
                    <tr key={log.id} className="hover:bg-neutral-50/60 text-neutral-800 text-xs transition-colors">
                      
                      {/* Timestamp */}
                      <td className="px-6 py-4 text-neutral-500 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-neutral-400 shrink-0" />
                          <span>{formattedTime}</span>
                        </div>
                      </td>

                      {/* Operator Name */}
                      <td className="px-6 py-4 text-neutral-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-neutral-400 shrink-0" />
                          <span>{log.actionedByName || "Staff Operator"}</span>
                        </div>
                      </td>

                      {/* Item details */}
                      <td className="px-6 py-4 space-y-1">
                        <span className="text-neutral-900 font-semibold block leading-normal">{log.itemName}</span>
                        <code className="bg-neutral-100 text-neutral-700 border border-neutral-200 font-mono text-xs px-2 py-0.5 rounded-md inline-block">
                          {log.itemSku}
                        </code>
                      </td>

                      {/* Action Badge */}
                      <td className="px-6 py-4">
                        {actionUpper === "CHECKOUT" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#800080] border border-purple-200">
                            Checkout
                          </span>
                        ) : actionUpper === "RETURN" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Return
                          </span>
                        ) : ["DAMAGE", "DAMAGED", "QUARANTINE"].includes(actionUpper) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Damage / Quarantine
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            Audit Adjustment
                          </span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-4 font-mono text-neutral-900 font-bold">
                        {log.quantity} {log.quantity === 1 ? "unit" : "units"}
                      </td>

                      {/* Notes / Image Proof */}
                      <td className="px-6 py-4 space-y-1 max-w-[260px]">
                        {log.note && (
                          <p className="text-neutral-600 text-xs truncate" title={log.note}>
                            {log.note}
                          </p>
                        )}
                        {log.snapshotUrl ? (
                          <button
                            onClick={() => setActiveZoomUrl(log.snapshotUrl!)}
                            className="text-xs text-[#800080] hover:text-[#660066] font-medium inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0"
                          >
                            <FileImage className="size-3.5 shrink-0" />
                            <span>View Proof Image</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-neutral-400 block">No photo proof</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* --- 4. TABLE PAGINATION FOOTER --- */}
        {!loading && totalItems > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200/80 px-6 py-4 bg-white rounded-b-xl">
            {/* Left: Counter Text */}
            <span className="text-xs text-neutral-500 font-medium">
              Showing {startIndex + 1}–{endIndex} of {totalItems} {totalItems === 1 ? "log" : "logs"}
            </span>

            {/* Right: Navigation Controls */}
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl h-8 px-3 text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-3.5 mr-1" />
                Previous
              </Button>

              <span className="text-xs font-semibold text-neutral-700">
                Page {currentPage} of {totalPages}
              </span>

              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl h-8 px-3 text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="size-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* --- 5. IN-APP IMAGE LIGHTBOX MODAL --- */}
      {activeZoomUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/50 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <FileImage className="size-4 text-[#800080]" />
                Snapshot Verification Proof Image
              </span>
              <button 
                onClick={() => setActiveZoomUrl(null)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Image display */}
            <div className="p-6 bg-neutral-100 flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={activeZoomUrl} 
                alt="Movement snap verification record" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
              />
            </div>

            {/* Bottom bar */}
            <div className="p-4 border-t border-neutral-200/80 bg-neutral-50/50 flex justify-end">
              <Button
                onClick={() => setActiveZoomUrl(null)}
                variant="outline"
                className="border-neutral-200 text-neutral-700 hover:bg-neutral-100 text-xs font-medium rounded-xl h-9 px-5 cursor-pointer"
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
