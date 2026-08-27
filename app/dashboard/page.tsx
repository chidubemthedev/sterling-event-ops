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
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Boxes,
  Calendar,
  History,
  Coins,
  AlertTriangle,
  Wrench,
  Plus,
  QrCode,
  CalendarPlus,
  TrendingDown,
  User,
  Clock,
  ChevronRight,
  Lock,
  RefreshCw,
  X,
  ShieldAlert,
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
    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);
          const role = data.role?.toLowerCase() || "staff";
          setIsAdmin(
            role === "admin" ||
              role === "superadmin" ||
              user.email === "chukwudubem7@gmail.com"
          );
        } else {
          setProfile({ name: "Workspace Member", role: "Staff" });
          setIsAdmin(user.email === "chukwudubem7@gmail.com");
        }
        setLoadingProfile(false);
      },
      (err) => {
        console.error("Dashboard profile lookup failed:", err);
        setLoadingProfile(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Real-time Subscription to Workspace Inventory, Events, and Movement Logs
  useEffect(() => {
    if (!workspaceId) return;

    setLoadingData(true);

    // A. Sub to Inventory collection
    const qInv = query(
      collection(db, "inventory"),
      where("workspaceId", "==", workspaceId)
    );
    const unsubscribeInv = onSnapshot(
      qInv,
      (snapshot) => {
        const items: InventoryItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as InventoryItem);
        });
        setInventoryList(items);
      },
      (err) => {
        console.error("Dashboard inventory sub error:", err);
      }
    );

    // B. Sub to Events collection
    const qEvents = query(
      collection(db, "events"),
      where("workspaceId", "==", workspaceId)
    );
    const unsubscribeEvents = onSnapshot(
      qEvents,
      (snapshot) => {
        const evs: EventItem[] = [];
        snapshot.forEach((d) => {
          evs.push({ id: d.id, ...d.data() } as EventItem);
        });
        setEventsList(evs);
      },
      (err) => {
        console.error("Dashboard events sub error:", err);
      }
    );

    // C. Sub to recent 5 Movement Logs
    const qLogs = query(
      collection(db, "movement_logs"),
      where("workspaceId", "==", workspaceId),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsubscribeLogs = onSnapshot(
      qLogs,
      (snapshot) => {
        const logs: MovementLog[] = [];
        snapshot.forEach((d) => {
          logs.push({ id: d.id, ...d.data() } as MovementLog);
        });
        setLogsList(logs);
        setLoadingData(false);
      },
      (err) => {
        console.error("Dashboard logs sub error:", err);
        setLoadingData(false);
      }
    );

    return () => {
      unsubscribeInv();
      unsubscribeEvents();
      unsubscribeLogs();
    };
  }, [workspaceId]);

  // --- 6 OPERATIONAL METRIC CALCULATIONS ---

  // Metric 1: Total Items in Inventory
  const totalItemsCount = inventoryList.length;

  // Metric 2: Total Asset Value (₦) - Visible to ADMIN only
  const totalAssetValue = inventoryList.reduce((acc, item) => {
    const qty = item.totalQty || 0;
    const val = item.replacementValue || 0;
    return acc + qty * val;
  }, 0);

  // Metric 3: Items Currently Deployed
  const totalItemsDeployed = eventsList.reduce((acc, ev) => {
    if (!ev.itemsAllocated) return acc;
    const deployedInEvent = Object.values(ev.itemsAllocated).reduce(
      (sum, alloc) => {
        const checkedOut = alloc.qtyCheckedOut || 0;
        const returned = alloc.qtyReturned || 0;
        const damaged = alloc.qtyDamaged || 0;
        const missing = alloc.qtyMissing || 0;
        const activeInField = checkedOut - (returned + damaged + missing);
        return sum + (activeInField > 0 ? activeInField : 0);
      },
      0
    );
    return acc + deployedInEvent;
  }, 0);

  // Metric 4: Damaged / Missing Items
  const damagedOrMissingCount = inventoryList.filter((item) => {
    const isQuarantined = (item.quarantineQty || 0) > 0;
    const isDamaged = item.condition?.toLowerCase() === "damaged";
    return isQuarantined || isDamaged;
  }).length;

  // Metric 5: Total Losses Recorded (₦) - ADMIN only
  const totalLossesValue = inventoryList.reduce((acc, item) => {
    const qQty = item.quarantineQty || 0;
    const val = item.replacementValue || 0;
    return acc + qQty * val;
  }, 0);

  // Metric 6: Items Needing Service / Audit (not audited in 30+ days or Fair condition)
  const itemsNeedingServiceCount = inventoryList.filter((item) => {
    if (item.condition?.toLowerCase() !== "fair") return false;

    const auditDateStr = item.lastAudited || item.updatedAt || item.createdAt;
    if (!auditDateStr) return true;

    const auditDate = new Date(auditDateStr);
    if (isNaN(auditDate.getTime())) return true;

    const daysSinceAudit =
      (Date.now() - auditDate.getTime()) / (1000 * 60 * 60 * 24);
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
      (item) =>
        item.sku.toUpperCase() === scanSkuInput.trim().toUpperCase() ||
        item.id === scanSkuInput.trim()
    );

    if (!match) {
      setScanError(
        `No item matching SKU/ID "${scanSkuInput}" found in current inventory.`
      );
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200/80 pb-6">
        <div>
          <Badge
            variant="outline"
            className="bg-purple-50 text-[#800080] border-purple-200 text-[11px] font-semibold uppercase tracking-wider mb-2 px-2.5 py-0.5 rounded-full"
          >
            OPERATIONAL OVERVIEW
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Welcome Back, {profile?.name || "Member"}
          </h1>
          <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
            Real-time equipment tracking, active event allocations, and audit
            activity.
          </p>
        </div>
      </div>

      {/* --- QUICK ACTION BUTTONS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Action 1: Add Asset */}
        <Button
          variant="outline"
          onClick={() => handleQuickAction("/dashboard/inventory")}
          className="h-11 bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <Plus className="size-4 text-[#800080]" />
          <span>+ Add Asset</span>
        </Button>

        {/* Action 2: Plan New Event */}
        <Button
          variant="outline"
          onClick={() => handleQuickAction("/dashboard/events")}
          className="h-11 bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
        >
          <CalendarPlus className="size-4 text-[#800080]" />
          <span>📅 Plan New Event</span>
        </Button>

        {/* Action 3: Launch Camera Scanner */}
        <Button
          onClick={() => {
            setScanError("");
            setScannedItem(null);
            setScanSkuInput("");
            setIsScannerOpen(true);
          }}
          className="h-11 bg-[#800080] hover:bg-[#660066] text-white text-xs font-medium rounded-xl flex items-center justify-center gap-2 shadow-xs border-none cursor-pointer transition-colors"
        >
          <QrCode className="size-4" />
          <span>📷 Launch Camera Scanner</span>
        </Button>
      </div>

      {/* --- SIX-METRIC OPERATIONAL DASHBOARD GRID --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Total Asset Lines */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
              Total Asset Lines
            </span>
            <h3 className="text-3xl font-bold text-neutral-900 leading-none">
              {totalItemsCount}
            </h3>
            <span className="text-xs text-neutral-400 block">
              Registered unique inventory items
            </span>
          </div>
          <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center shrink-0 shadow-xs">
            <Boxes className="size-5" />
          </div>
        </div>

        {/* Card 2: Total Asset Value (₦) - ADMIN ONLY */}
        {isAdmin ? (
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Total Asset Value (₦)
              </span>
              <h3 className="text-2xl sm:text-3xl font-bold text-emerald-600 leading-none">
                ₦{totalAssetValue.toLocaleString("en-US")}
              </h3>
              <span className="text-xs text-neutral-400 block">
                Combined catalog replacement worth
              </span>
            </div>
            <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center shrink-0 shadow-xs">
              <Coins className="size-5" />
            </div>
          </div>
        ) : (
          <div className="bg-neutral-50/70 border border-neutral-200/60 rounded-xl p-5 shadow-xs flex items-center justify-between select-none">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block">
                Total Asset Value (₦)
              </span>
              <div className="flex items-center gap-1.5 text-neutral-500 py-1">
                <Lock className="size-3.5 text-neutral-400" />
                <span className="text-xs font-semibold">
                  Admin Permission Required
                </span>
              </div>
              <span className="text-xs text-neutral-400 block">
                Combined catalog replacement worth
              </span>
            </div>
            <div className="size-11 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-400 flex items-center justify-center shrink-0">
              <Lock className="size-4" />
            </div>
          </div>
        )}

        {/* Card 3: Currently Deployed */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
              Currently Deployed
            </span>
            <h3 className="text-3xl font-bold text-[#800080] leading-none">
              {totalItemsDeployed}
            </h3>
            <span className="text-xs text-neutral-400 block">
              Active items assigned to live events
            </span>
          </div>
          <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="size-5" />
          </div>
        </div>

        {/* Card 4: Damaged / Missing Items */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Damaged / Missing
              </span>
              {damagedOrMissingCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-700">
                  QUARANTINED
                </span>
              )}
            </div>
            <h3
              className={`text-3xl font-bold leading-none ${
                damagedOrMissingCount > 0
                  ? "text-rose-600"
                  : "text-neutral-900"
              }`}
            >
              {damagedOrMissingCount}
            </h3>
            <span className="text-xs text-neutral-400 block">
              Units quarantined out of service
            </span>
          </div>
          <div
            className={`size-11 rounded-xl flex items-center justify-center shrink-0 border ${
              damagedOrMissingCount > 0
                ? "bg-rose-50 border-rose-100 text-rose-600"
                : "bg-purple-50 border-purple-100 text-[#800080]"
            }`}
          >
            <ShieldAlert className="size-5" />
          </div>
        </div>

        {/* Card 5: Total Financial Loss (₦) - ADMIN ONLY */}
        {isAdmin ? (
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Total Financial Loss (₦)
              </span>
              <h3
                className={`text-2xl sm:text-3xl font-bold leading-none ${
                  totalLossesValue > 0
                    ? "text-rose-600"
                    : "text-neutral-900"
                }`}
              >
                ₦{totalLossesValue.toLocaleString("en-US")}
              </h3>
              <span className="text-xs text-neutral-400 block">
                Value of damaged/missing assets
              </span>
            </div>
            <div
              className={`size-11 rounded-xl flex items-center justify-center shrink-0 border ${
                totalLossesValue > 0
                  ? "bg-rose-50 border-rose-100 text-rose-600"
                  : "bg-purple-50 border-purple-100 text-[#800080]"
              }`}
            >
              <TrendingDown className="size-5" />
            </div>
          </div>
        ) : (
          <div className="bg-neutral-50/70 border border-neutral-200/60 rounded-xl p-5 shadow-xs flex items-center justify-between select-none">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider block">
                Total Financial Loss (₦)
              </span>
              <div className="flex items-center gap-1.5 text-neutral-500 py-1">
                <Lock className="size-3.5 text-neutral-400" />
                <span className="text-xs font-semibold">
                  Admin Permission Required
                </span>
              </div>
              <span className="text-xs text-neutral-400 block">
                Value of damaged/missing assets
              </span>
            </div>
            <div className="size-11 rounded-xl bg-neutral-100 border border-neutral-200 text-neutral-400 flex items-center justify-center shrink-0">
              <Lock className="size-4" />
            </div>
          </div>
        )}

        {/* Card 6: Items Needing Audit */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Items Needing Audit
              </span>
              {itemsNeedingServiceCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-200 text-amber-700">
                  NEEDS AUDIT
                </span>
              )}
            </div>
            <h3
              className={`text-3xl font-bold leading-none ${
                itemsNeedingServiceCount > 0
                  ? "text-amber-600"
                  : "text-neutral-900"
              }`}
            >
              {itemsNeedingServiceCount}
            </h3>
            <span className="text-xs text-neutral-400 block">
              Assets not verified in 30+ days
            </span>
          </div>
          <div
            className={`size-11 rounded-xl flex items-center justify-center shrink-0 border ${
              itemsNeedingServiceCount > 0
                ? "bg-amber-50 border-amber-100 text-amber-600"
                : "bg-purple-50 border-purple-100 text-[#800080]"
            }`}
          >
            <Wrench className="size-5" />
          </div>
        </div>
      </div>

      {/* --- RECENT MOVEMENT ACTIVITY STREAM --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="size-5 text-[#800080]" />
            <h3 className="text-sm font-bold text-neutral-900">
              Recent Asset Movements
            </h3>
          </div>
          <Button
            onClick={() => handleQuickAction("/dashboard/logs")}
            variant="ghost"
            size="sm"
            className="text-xs text-[#800080] hover:text-[#660066] hover:bg-purple-50 h-8 font-medium cursor-pointer"
          >
            <span>View All Audit Logs →</span>
          </Button>
        </div>

        {/* Live logs list Table */}
        <div className="overflow-x-auto">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-xs text-neutral-500">
              <RefreshCw className="size-5 animate-spin text-[#800080]" />
              <span>Fetching movement logs feed...</span>
            </div>
          ) : logsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-xs text-neutral-500 font-medium px-4 text-center">
              <History className="size-8 text-neutral-300 mb-1" />
              <span>
                No asset movements recorded yet. Use the camera scanner or
                checkout workflow to log item activity.
              </span>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-neutral-50 text-neutral-600 uppercase text-xs font-semibold">
                <TableRow className="border-b border-neutral-200/80">
                  <TableHead className="px-6 py-3.5">Timestamp</TableHead>
                  <TableHead className="px-6 py-3.5">Actioned By</TableHead>
                  <TableHead className="px-6 py-3.5">Asset / SKU</TableHead>
                  <TableHead className="px-6 py-3.5">Movement Type</TableHead>
                  <TableHead className="px-6 py-3.5">Quantity</TableHead>
                  <TableHead className="px-6 py-3.5">Operational Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-neutral-100 text-xs font-medium">
                {logsList.map((log) => {
                  const date = new Date(log.createdAt);
                  const formattedTime = isNaN(date.getTime())
                    ? "N/A"
                    : date.toLocaleDateString() +
                      " " +
                      date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                  return (
                    <TableRow
                      key={log.id}
                      className="hover:bg-neutral-50/60 transition-colors"
                    >
                      {/* Timestamp */}
                      <TableCell className="px-6 py-4 text-neutral-500 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-3.5 text-neutral-400 shrink-0" />
                          <span>{formattedTime}</span>
                        </div>
                      </TableCell>

                      {/* Actioned By */}
                      <TableCell className="px-6 py-4 text-neutral-800">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-neutral-400 shrink-0" />
                          <span>{log.actionedByName}</span>
                        </div>
                      </TableCell>

                      {/* Asset / SKU */}
                      <TableCell className="px-6 py-4 space-y-0.5">
                        <span className="text-neutral-900 font-semibold block">
                          {log.itemName}
                        </span>
                        <code className="text-[11px] font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                          {log.itemSku}
                        </code>
                      </TableCell>

                      {/* Movement Type */}
                      <TableCell className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            log.actionType === "CHECKOUT"
                              ? "bg-purple-50 border-purple-200 text-[#800080]"
                              : log.actionType === "RETURN"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : log.actionType === "DAMAGE"
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : "bg-neutral-100 border-neutral-200 text-neutral-700"
                          }`}
                        >
                          {log.actionType}
                        </span>
                      </TableCell>

                      {/* Quantity */}
                      <TableCell className="px-6 py-4 font-mono text-neutral-900 font-bold">
                        {log.quantity}
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="px-6 py-4 text-neutral-500 max-w-[200px] truncate">
                        {log.note || "N/A"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* --- UNIVERSAL SCANNER DIALOG OVERLAY MODAL --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center">
                  <QrCode className="size-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Universal Camera Scanner
                </h3>
              </div>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Scan description */}
              <p className="text-neutral-500 text-xs leading-relaxed">
                Scan or enter any inventory asset barcode / SKU string below to
                pull live quantity, condition status, and replacement value.
              </p>

              {/* Form Input */}
              <form onSubmit={handleUniversalScan} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 block">
                    Manual SKU / Asset ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="e.g. SKU-STG-1004"
                      value={scanSkuInput}
                      onChange={(e) => setScanSkuInput(e.target.value)}
                      className="flex-1 bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-[#800080] transition-colors h-11"
                    />
                    <Button
                      type="submit"
                      className="bg-[#800080] hover:bg-[#660066] text-white font-medium text-xs h-11 px-4 rounded-xl border-none cursor-pointer"
                    >
                      Process Scan
                    </Button>
                  </div>
                </div>
              </form>

              {/* Scan error banner */}
              {scanError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Matched item detail card */}
              {scannedItem && (
                <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl p-4 space-y-3">
                  {/* Title & Badge */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-medium text-neutral-400 block">
                        Matched Catalog Asset
                      </span>
                      <h4 className="text-sm font-bold text-neutral-900">
                        {scannedItem.name}
                      </h4>
                      <code className="text-xs font-mono text-[#800080] mt-0.5 block">
                        {scannedItem.sku}
                      </code>
                    </div>

                    <Badge
                      variant="outline"
                      className={`capitalize text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        scannedItem.condition?.toLowerCase() === "excellent" ||
                        scannedItem.condition?.toLowerCase() === "good"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : scannedItem.condition?.toLowerCase() === "fair"
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-rose-50 border-rose-200 text-rose-700"
                      }`}
                    >
                      {scannedItem.condition}
                    </Badge>
                  </div>

                  {/* Qty and metrics grid */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-200/60 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-neutral-500 font-medium block">
                        Total Quantity
                      </span>
                      <span className="text-neutral-900 font-bold block">
                        {scannedItem.totalQty} {scannedItem.unitOfMeasure}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-neutral-500 font-medium block">
                        Quarantine / Locked
                      </span>
                      <span
                        className={`font-bold block ${
                          scannedItem.quarantineQty &&
                          scannedItem.quarantineQty > 0
                            ? "text-rose-600"
                            : "text-neutral-700"
                        }`}
                      >
                        {scannedItem.quarantineQty || 0} units
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-neutral-500 font-medium block">
                          Replacement Value
                        </span>
                        <span className="text-emerald-700 font-bold block">
                          ₦{scannedItem.replacementValue.toLocaleString()}
                        </span>
                      </div>
                    )}

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-neutral-500 font-medium block">
                        Last Audit Check
                      </span>
                      <span className="text-neutral-600 block truncate">
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
                      variant="outline"
                      className="border-purple-200 text-[#800080] hover:bg-purple-50 h-8 text-xs font-medium rounded-lg"
                    >
                      Go to Catalog Item
                      <ChevronRight className="size-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Close */}
              <div className="border-t border-neutral-100 pt-3">
                <Button
                  onClick={() => setIsScannerOpen(false)}
                  variant="outline"
                  className="w-full border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11 rounded-xl text-xs font-medium cursor-pointer"
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
