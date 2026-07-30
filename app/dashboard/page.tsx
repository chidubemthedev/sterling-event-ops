"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  getDoc
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  Calendar,
  History,
  ShieldAlert,
  Coins,
  AlertOctagon,
  Wrench,
  Layers,
  Sparkles,
  ArrowRight,
  Plus,
  QrCode,
  CalendarPlus,
  TrendingDown,
  User,
  Clock,
  ChevronRight,
  Eye,
  Lock,
  Search,
  CheckCircle,
  X
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  totalQty: number;
  quarantineQty?: number;
  condition: string;
  replacementValue: number;
  unitOfMeasure: string;
  lastAudited?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface EventItem {
  id: string;
  name: string;
  workspaceId: string;
  status: string;
  itemsAllocated: {
    [itemId: string]: {
      qtyCheckedOut: number;
      qtyReturned: number;
      qtyDamaged: number;
      qtyMissing: number;
    };
  };
}

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
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, workspaceId } = useWorkspaceStore();

  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Firestore lists
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [logsList, setLogsList] = useState<MovementLog[]>([]);

  // Subscriptions loading
  const [loadingData, setLoadingData] = useState(true);

  // Universal Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const [scanError, setScanError] = useState("");
  const [scanSkuInput, setScanSkuInput] = useState("");

  // 1. Fetch User Profile & Role Authorization Check
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        const role = data.role?.toLowerCase() || "staff";
        setIsAdmin(role === "admin" || role === "superadmin" || user.email === "chukwudubem7@gmail.com");
      } else {
        setProfile({ name: "Workspace Member", role: "Staff" });
        setIsAdmin(user.email === "chukwudubem7@gmail.com");
      }
      setLoadingProfile(false);
    }, (err) => {
      console.error("Dashboard profile lookup failed:", err);
      setLoadingProfile(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 2. Real-time Subscription to Workspace Inventory, Events, and Movement Logs
  useEffect(() => {
    if (!workspaceId) return;

    setLoadingData(true);

    // A. Sub to Inventory collection
    const qInv = query(collection(db, "inventory"), where("workspaceId", "==", workspaceId));
    const unsubscribeInv = onSnapshot(qInv, (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as InventoryItem);
      });
      setInventoryList(items);
    }, (err) => {
      console.error("Dashboard inventory sub error:", err);
    });

    // B. Sub to Events collection
    const qEvents = query(collection(db, "events"), where("workspaceId", "==", workspaceId));
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      const evs: EventItem[] = [];
      snapshot.forEach((d) => {
        evs.push({ id: d.id, ...d.data() } as EventItem);
      });
      setEventsList(evs);
    }, (err) => {
      console.error("Dashboard events sub error:", err);
    });

    // C. Sub to recent 5 Movement Logs
    const qLogs = query(
      collection(db, "movement_logs"),
      where("workspaceId", "==", workspaceId),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logs: MovementLog[] = [];
      snapshot.forEach((d) => {
        logs.push({ id: d.id, ...d.data() } as MovementLog);
      });
      setLogsList(logs);
      setLoadingData(false);
    }, (err) => {
      console.error("Dashboard logs sub error:", err);
      setLoadingData(false);
    });

    return () => {
      unsubscribeInv();
      unsubscribeEvents();
      unsubscribeLogs();
    };
  }, [workspaceId]);

  // --- 6 OPERATIONAL METRIC CALCULATIONS ---

  // Metric 1: Total Items in Inventory (Count of unique SKUs / inventory records)
  const totalItemsCount = inventoryList.length;

  // Metric 2: Total Asset Value (₦) - Visible to ADMIN only
  const totalAssetValue = inventoryList.reduce((acc, item) => {
    const qty = item.totalQty || 0;
    const val = item.replacementValue || 0;
    return acc + (qty * val);
  }, 0);

  // Metric 3: Items Currently Deployed (Sum of quantities currently active in the field across all event maps)
  const totalItemsDeployed = eventsList.reduce((acc, ev) => {
    if (!ev.itemsAllocated) return acc;
    const deployedInEvent = Object.values(ev.itemsAllocated).reduce((sum, alloc) => {
      const checkedOut = alloc.qtyCheckedOut || 0;
      const returned = alloc.qtyReturned || 0;
      const damaged = alloc.qtyDamaged || 0;
      const missing = alloc.qtyMissing || 0;
      const activeInField = checkedOut - (returned + damaged + missing);
      return sum + (activeInField > 0 ? activeInField : 0);
    }, 0);
    return acc + deployedInEvent;
  }, 0);

  // Metric 4: Damaged / Missing Items (Count where quarantineQty > 0 or condition is Damaged)
  const damagedOrMissingCount = inventoryList.filter((item) => {
    const isQuarantined = (item.quarantineQty || 0) > 0;
    const isDamaged = item.condition?.toLowerCase() === "damaged";
    return isQuarantined || isDamaged;
  }).length;

  // Metric 5: Total Losses Recorded (₦) - Sum of replacement values of quarantined quantities - ADMIN only
  const totalLossesValue = inventoryList.reduce((acc, item) => {
    const qQty = item.quarantineQty || 0;
    const val = item.replacementValue || 0;
    return acc + (qQty * val);
  }, 0);

  // Metric 6: Items Needing Service - marked as "Fair" condition and not audited in 30+ days
  const itemsNeedingServiceCount = inventoryList.filter((item) => {
    if (item.condition?.toLowerCase() !== "fair") return false;

    // Check last audited timestamp (fallback to updatedAt or createdAt)
    const auditDateStr = item.lastAudited || item.updatedAt || item.createdAt;
    if (!auditDateStr) return true; // Never audited counts as needing audit/service

    const auditDate = new Date(auditDateStr);
    if (isNaN(auditDate.getTime())) return true;

    const daysSinceAudit = (Date.now() - auditDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceAudit > 30;
  }).length;

  // Manual SKU Universal Scanner handler
  const handleUniversalScan = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError("");
    setScannedItem(null);

    if (!scanSkuInput.trim()) {
      setScanError("Please enter a valid SKU string.");
      return;
    }

    const match = inventoryList.find(
      (item) => item.sku.toUpperCase() === scanSkuInput.trim().toUpperCase() || item.id === scanSkuInput.trim()
    );

    if (!match) {
      setScanError(`No item matching SKU/ID "${scanSkuInput}" found in current inventory.`);
    } else {
      setScannedItem(match);
    }
  };

  const handleQuickAction = (route: string) => {
    router.push(route);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* HEADER SECTION WITH USER GREETING */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">
            Operational Overview Room
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white font-heading mt-1">
            Welcome Back, {profile?.name || "Member"}!
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed">
            Monitor real-time equipment allocations, check immutable audit logs, and trigger quick scan operations below.
          </p>
        </div>

        {/* Local Clock */}
        <div className="flex items-center gap-2.5 px-4 py-2 bg-zinc-900/40 border border-zinc-850 rounded-xl max-w-fit select-none">
          <Clock className="size-4 text-zinc-500 animate-pulse" />
          <span className="text-[11px] font-mono text-zinc-300 font-medium">
            System Live Node Active
          </span>
        </div>
      </div>

      {/* --- QUICK ACTION BAR --- */}
      <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 backdrop-blur-md space-y-3.5 relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />

        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
          Platform Quick Commands Bar
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Action 1 */}
          <Button
            onClick={() => handleQuickAction("/dashboard/inventory")}
            className="h-11 bg-zinc-950 hover:bg-indigo-950/20 text-zinc-300 border border-zinc-850 hover:border-indigo-900/30 text-xs font-bold rounded-xl flex items-center justify-center gap-2"
          >
            <Plus className="size-4.5 text-indigo-400" />
            <span>Add Asset Catalog</span>
          </Button>

          {/* Action 2 */}
          <Button
            onClick={() => handleQuickAction("/dashboard/events")}
            className="h-11 bg-zinc-950 hover:bg-indigo-950/20 text-zinc-300 border border-zinc-850 hover:border-indigo-900/30 text-xs font-bold rounded-xl flex items-center justify-center gap-2"
          >
            <CalendarPlus className="size-4.5 text-indigo-400" />
            <span>Create Event Domain</span>
          </Button>

          {/* Action 3 */}
          <Button
            onClick={() => {
              setScanError("");
              setScannedItem(null);
              setScanSkuInput("");
              setIsScannerOpen(true);
            }}
            className="h-11 bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 border-none cursor-pointer"
          >
            <QrCode className="size-4.5" />
            <span>Launch Universal Scanner</span>
          </Button>
        </div>
      </div>

      {/* --- SIX-METRIC OPERATIONAL DASHBOARD GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Card 1: Total Items in Inventory */}
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between hover:border-zinc-800 transition-all duration-200">
          <div className="space-y-1.5">
            <span className="text-[10.5px] text-zinc-400 font-semibold block uppercase tracking-wider">
              Total Assets Lines
            </span>
            <h3 className="text-3xl font-black font-heading text-white leading-none">
              {totalItemsCount}
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono block">Registered unique SKUs</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
            <Boxes className="size-5" />
          </div>
        </div>

        {/* Card 2: Total Asset Value (₦) - ADMIN ONLY */}
        {isAdmin ? (
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between hover:border-zinc-800 transition-all duration-200 animate-in fade-in">
            <div className="space-y-1.5">
              <span className="text-[10.5px] text-zinc-400 font-semibold block uppercase tracking-wider">
                Total Assets Value
              </span>
              <h3 className="text-2xl font-black font-heading text-emerald-400 leading-none">
                ₦{totalAssetValue.toLocaleString("en-US")}
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono block">Combined acquisition net worth</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
              <Coins className="size-5" />
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-zinc-850/60 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between select-none opacity-60">
            <div className="space-y-1.5">
              <span className="text-[10.5px] text-zinc-500 font-semibold block uppercase tracking-wider">
                Total Assets Value
              </span>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Lock className="size-4 text-zinc-500" />
                <span className="text-[11px] font-bold">Admin Permission Required</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-850 text-zinc-600 flex items-center justify-center">
              <Lock className="size-4" />
            </div>
          </div>
        )}

        {/* Card 3: Items Currently Deployed */}
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between hover:border-zinc-800 transition-all duration-200">
          <div className="space-y-1.5">
            <span className="text-[10.5px] text-zinc-400 font-semibold block uppercase tracking-wider">
              Currently Deployed
            </span>
            <h3 className="text-3xl font-black font-heading text-indigo-400 leading-none">
              {totalItemsDeployed}
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono block">Units active in field operations</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-inner">
            <Calendar className="size-5" />
          </div>
        </div>

        {/* Card 4: Damaged / Missing Items */}
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between hover:border-zinc-800 transition-all duration-200">
          <div className="space-y-1.5">
            <span className="text-[10.5px] text-zinc-400 font-semibold block uppercase tracking-wider flex items-center gap-1.5">
              Quarantine / Damaged
              {damagedOrMissingCount > 0 && (
                <span className="animate-ping size-1.5 rounded-full bg-red-500 shrink-0" />
              )}
            </span>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-3xl font-black font-heading leading-none ${damagedOrMissingCount > 0 ? "text-red-400" : "text-white"}`}>
                {damagedOrMissingCount}
              </h3>
              {damagedOrMissingCount > 0 && (
                <span className="text-[9px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold font-mono">
                  RISK HIGH
                </span>
              )}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">Units locked out of service</span>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner border ${
            damagedOrMissingCount > 0 
              ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse" 
              : "bg-zinc-950 border-zinc-850 text-zinc-500"
          }`}>
            <AlertOctagon className="size-5" />
          </div>
        </div>

        {/* Card 5: Total Losses Recorded (₦) - ADMIN ONLY */}
        {isAdmin ? (
          <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between hover:border-zinc-800 transition-all duration-200 animate-in fade-in">
            <div className="space-y-1.5">
              <span className="text-[10.5px] text-zinc-400 font-semibold block uppercase tracking-wider">
                Total Losses Value
              </span>
              <h3 className={`text-2xl font-black font-heading leading-none ${totalLossesValue > 0 ? "text-red-400" : "text-white"}`}>
                ₦{totalLossesValue.toLocaleString("en-US")}
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono block">Financial risk quarantined</span>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner border ${
              totalLossesValue > 0 
                ? "bg-red-500/10 border-red-500/20 text-red-400" 
                : "bg-zinc-950 border-zinc-850 text-zinc-500"
            }`}>
              <TrendingDown className="size-5" />
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/10 border border-zinc-850/60 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between select-none opacity-60">
            <div className="space-y-1.5">
              <span className="text-[10.5px] text-zinc-500 font-semibold block uppercase tracking-wider">
                Total Losses Value
              </span>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <Lock className="size-4 text-zinc-500" />
                <span className="text-[11px] font-bold">Admin Permission Required</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-850 text-zinc-600 flex items-center justify-center">
              <Lock className="size-4" />
            </div>
          </div>
        )}

        {/* Card 6: Items Needing Service */}
        <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-5 backdrop-blur-sm flex items-center justify-between hover:border-zinc-800 transition-all duration-200">
          <div className="space-y-1.5">
            <span className="text-[10.5px] text-zinc-400 font-semibold block uppercase tracking-wider flex items-center gap-1.5">
              Overdue Audits
              {itemsNeedingServiceCount > 0 && (
                <span className="animate-ping size-1.5 rounded-full bg-amber-500 shrink-0" />
              )}
            </span>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-3xl font-black font-heading leading-none ${itemsNeedingServiceCount > 0 ? "text-amber-400" : "text-white"}`}>
                {itemsNeedingServiceCount}
              </h3>
              {itemsNeedingServiceCount > 0 && (
                <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold font-mono">
                  FAIR COND
                </span>
              )}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">Not audited in 30+ days</span>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner border ${
            itemsNeedingServiceCount > 0 
              ? "bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse" 
              : "bg-zinc-950 border-zinc-850 text-zinc-500"
          }`}>
            <Wrench className="size-5" />
          </div>
        </div>

      </div>

      {/* --- RECENT MOVEMENT ACTIVITY STREAM --- */}
      <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-850/60 bg-zinc-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="size-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-heading">
              Recent Field Movement Stream (Last 5)
            </h3>
          </div>
          <Button
            onClick={() => handleQuickAction("/dashboard/logs")}
            variant="ghost"
            size="sm"
            className="text-[10.5px] text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-850/40 h-8 font-bold"
          >
            <span>View All Logs</span>
            <ChevronRight className="size-3.5 ml-1" />
          </Button>
        </div>

        {/* Live logs list Table */}
        <div className="overflow-x-auto">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-xs text-zinc-500 font-mono">
              <RefreshCw className="size-5 animate-spin text-indigo-500" />
              <span>Streaming movements log feed...</span>
            </div>
          ) : logsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-xs text-zinc-500 font-medium">
              <History className="size-6 text-zinc-600 mb-1" />
              <span>No asset movement entries recorded yet.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-900/10 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Actioned By</th>
                  <th className="px-6 py-3.5">Asset / SKU</th>
                  <th className="px-6 py-3.5">Movement Type</th>
                  <th className="px-6 py-3.5">Quantity</th>
                  <th className="px-6 py-3.5">Operational Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/40 font-medium">
                {logsList.map((log) => {
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

                      {/* Actioned By */}
                      <td className="px-6 py-4 text-zinc-200">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-zinc-500 shrink-0" />
                          <span>{log.actionedByName}</span>
                        </div>
                      </td>

                      {/* Asset / SKU */}
                      <td className="px-6 py-4 space-y-0.5">
                        <span className="text-zinc-200 font-bold block leading-normal">{log.itemName}</span>
                        <code className="text-[9.5px] font-mono text-zinc-500 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-900">
                          {log.itemSku}
                        </code>
                      </td>

                      {/* Movement Type */}
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
                        {log.quantity}
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-4 text-zinc-400 max-w-[200px] truncate">
                        {log.note || "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- UNIVERSAL SCANNER DIALOG OVERLAY MODAL --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top lightbar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Universal Scanner Terminal
                </h3>
              </div>
              <button 
                onClick={() => setIsScannerOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              {/* Scan description */}
              <p className="text-zinc-400 text-xs leading-relaxed">
                Scan or enter any inventory asset item barcode / SKU string below to pull live quantity, current condition states, and financial acquisition valuations instantly.
              </p>

              {/* Form Input */}
              <form onSubmit={handleUniversalScan} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">Manual SKU / Asset ID</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. SKU-STG-1004"
                      value={scanSkuInput}
                      onChange={(e) => setScanSkuInput(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-850 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-700 outline-none focus:border-indigo-500 transition-colors"
                    />
                    <Button 
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-10 px-4 border-none"
                    >
                      Process Scan
                    </Button>
                  </div>
                </div>
              </form>

              {/* Scan error banner */}
              {scanError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertOctagon className="size-4 shrink-0 mt-0.5 animate-bounce" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Matched item detail card */}
              {scannedItem && (
                <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-4.5 space-y-3.5 animate-in slide-in-from-top-2">
                  
                  {/* Title & Badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono text-zinc-500">Matched Catalog Asset</span>
                      <h4 className="text-sm font-bold text-white tracking-tight">{scannedItem.name}</h4>
                      <code className="text-[9.5px] font-mono text-indigo-400 mt-0.5 block">{scannedItem.sku}</code>
                    </div>

                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border ${
                      scannedItem.condition?.toLowerCase() === "excellent" || scannedItem.condition?.toLowerCase() === "good"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : scannedItem.condition?.toLowerCase() === "fair"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                    }`}>
                      {scannedItem.condition}
                    </span>
                  </div>

                  {/* Qty and metrics grid */}
                  <div className="grid grid-cols-2 gap-3.5 pt-3.5 border-t border-zinc-900 text-xs">
                    
                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-zinc-500 font-semibold block uppercase tracking-wider">Total Quantity</span>
                      <span className="text-zinc-200 font-mono font-bold block">{scannedItem.totalQty} {scannedItem.unitOfMeasure}</span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-zinc-500 font-semibold block uppercase tracking-wider">Quarantine / Locked</span>
                      <span className={`font-mono font-bold block ${scannedItem.quarantineQty && scannedItem.quarantineQty > 0 ? "text-red-400" : "text-zinc-400"}`}>
                        {scannedItem.quarantineQty || 0} units
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-zinc-500 font-semibold block uppercase tracking-wider">Replacement Worth</span>
                      <span className="text-emerald-400 font-mono font-bold block">₦{scannedItem.replacementValue.toLocaleString()}</span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[9.5px] text-zinc-500 font-semibold block uppercase tracking-wider">Last Audit Check</span>
                      <span className="text-zinc-400 font-mono block truncate max-w-[150px]">
                        {scannedItem.lastAudited || "Never Audited"}
                      </span>
                    </div>

                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      onClick={() => {
                        setIsScannerOpen(false);
                        router.push(`/dashboard/inventory`);
                      }}
                      className="bg-indigo-600/15 text-indigo-400 hover:bg-indigo-600/25 border-none h-8 text-[10.5px] font-bold"
                    >
                      Go to Catalog Item
                      <ChevronRight className="size-3.5 ml-1" />
                    </Button>
                  </div>

                </div>
              )}

              {/* Close */}
              <div className="border-t border-zinc-800 pt-4 flex gap-3">
                <Button 
                  onClick={() => setIsScannerOpen(false)}
                  className="w-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold h-11 border-none text-xs"
                >
                  Close Terminal
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

interface RefreshCwProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

function RefreshCw({ className, ...props }: RefreshCwProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
