"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, deleteDoc, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { 
  Plus, 
  Search, 
  QrCode, 
  Printer, 
  Box, 
  Layers, 
  Coins, 
  ShieldCheck, 
  AlertTriangle, 
  Activity, 
  RefreshCw,
  Building,
  Tag,
  Scale,
  DollarSign,
  AlertCircle,
  X,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Pencil,
  Trash2
} from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unitOfMeasure: "unit" | "set" | "meter" | "feet";
  replacementValue: number; // in NGN ₦
  condition: "Excellent" | "Good" | "Fair" | "Damaged";
  totalQty: number;
  warehouseQty: number;
  deployedQty: number;
  quarantineQty: number;
  workspaceId: string;
  createdAt: string;
  category?: string;
  warehouseLocation?: string;
}

export default function InventoryPage() {
  const { workspaceId, user, loading: authLoading } = useWorkspaceStore();
  const [userRole, setUserRole] = useState<string>("staff"); // Secure by default

  // Real-time User Role Subscription
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.role || "staff");
      } else {
        setUserRole("staff");
      }
    }, (err) => {
      console.error("Failed to subscribe to user role in inventory:", err);
    });
    return () => unsubscribe();
  }, [user]);

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingItems, setLoadingWorkspaces] = useState(true);

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [activeLabelItem, setActiveLabelItem] = useState<InventoryItem | null>(null);
  
  // Admin Edit Modal State
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editWarehouseLocation, setEditWarehouseLocation] = useState("");
  const [editUnitOfMeasure, setEditUnitOfMeasure] = useState<"unit" | "set" | "meter" | "feet">("unit");
  const [editReplacementValue, setEditReplacementValue] = useState("");
  const [editCondition, setEditCondition] = useState<"Excellent" | "Good" | "Fair" | "Damaged">("Excellent");
  const [editTotalQty, setEditTotalQty] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Admin Delete State
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Item Creation Form state
  const [itemName, setItemName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [unitOfMeasure, setUnitOfMeasure] = useState<"unit" | "set" | "meter" | "feet">("unit");
  const [replacementValue, setReplacementValue] = useState("");
  const [condition, setCondition] = useState<"Excellent" | "Good" | "Fair" | "Damaged">("Excellent");
  const [totalQty, setTotalQty] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Subscribe to inventory collection, strictly filtered by workspaceId (enforcing multi-tenancy)
  useEffect(() => {
    if (authLoading || !workspaceId) return;

    setLoadingWorkspaces(true);
    const q = query(
      collection(db, "inventory"),
      where("workspaceId", "==", workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      // Sort client-side by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(list);
      setLoadingWorkspaces(false);
    }, (err) => {
      console.error("Firestore query error on inventory collection:", err);
      setLoadingWorkspaces(false);
    });

    return () => unsubscribe();
  }, [workspaceId, authLoading]);

  // Form submit handler to register new multi-tenant asset
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!workspaceId) {
      setFormError("Error: Active workspace session not detected.");
      return;
    }

    const isValRequired = userRole === "admin";
    if (!itemName.trim() || !sku.trim() || (isValRequired && !replacementValue) || !totalQty) {
      setFormError("Please populate all required fields.");
      return;
    }

    const qtyNumber = parseInt(totalQty);
    const valueNumber = isValRequired ? parseFloat(replacementValue) : 0;

    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setFormError("Total Quantity must be a valid positive integer.");
      return;
    }

    if (isValRequired && (isNaN(valueNumber) || valueNumber < 0)) {
      setFormError("Replacement Value must be a non-negative number.");
      return;
    }

    // Client-side uniqueness check for SKU inside the active workspace
    const skuConflict = items.some(item => item.sku.toLowerCase() === sku.trim().toLowerCase());
    if (skuConflict) {
      setFormError(`Conflict: SKU "${sku.trim().toUpperCase()}" is already assigned to an asset in this workspace.`);
      return;
    }

    setSubmitting(true);

    try {
      const docId = `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const inventoryRef = doc(db, "inventory", docId);

      const newItem: Omit<InventoryItem, "id"> = {
        name: itemName.trim(),
        sku: sku.trim().toUpperCase(),
        unitOfMeasure,
        replacementValue: valueNumber,
        condition,
        totalQty: qtyNumber,
        warehouseQty: qtyNumber, // Set equal to totalQty on creation
        deployedQty: 0,          // Default initialize to 0
        quarantineQty: 0,        // Default initialize to 0
        workspaceId,             // STStrict multi-tenant security
        createdAt: new Date().toISOString(),
        category: category.trim(),
        warehouseLocation: warehouseLocation.trim()
      };

      await setDoc(inventoryRef, newItem);

      setFormSuccess(`Successfully registered asset: ${sku.trim().toUpperCase()}`);
      
      // Reset form
      setItemName("");
      setSku("");
      setCategory("");
      setWarehouseLocation("");
      setUnitOfMeasure("unit");
      setReplacementValue("");
      setCondition("Excellent");
      setTotalQty("");

      setTimeout(() => {
        setIsNewModalOpen(false);
        setFormSuccess("");
      }, 1500);

    } catch (err: any) {
      console.error("Asset generation failed:", err);
      setFormError(err.message || "An error occurred while creating the asset.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal state pre-population
  const openEditModal = (item: InventoryItem) => {
    setEditItem(item);
    setEditItemName(item.name);
    setEditSku(item.sku);
    setEditCategory(item.category || "");
    setEditWarehouseLocation(item.warehouseLocation || "");
    setEditUnitOfMeasure(item.unitOfMeasure);
    setEditReplacementValue(item.replacementValue.toString());
    setEditCondition(item.condition);
    setEditTotalQty(item.totalQty.toString());
    setEditError("");
    setEditSuccess("");
  };

  // Submit Handler for Asset Edit
  const handleEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !workspaceId) return;

    setEditError("");
    setEditSuccess("");

    if (!editItemName.trim() || !editSku.trim() || !editTotalQty) {
      setEditError("Please populate all required fields.");
      return;
    }

    const qtyNumber = parseInt(editTotalQty);
    const valueNumber = parseFloat(editReplacementValue) || 0;

    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      setEditError("Total Quantity must be a valid positive integer.");
      return;
    }

    if (isNaN(valueNumber) || valueNumber < 0) {
      setEditError("Replacement Value must be a non-negative number.");
      return;
    }

    // SKU uniqueness check across active workspace (excluding current item)
    const skuConflict = items.some(item => item.id !== editItem.id && item.sku.toLowerCase() === editSku.trim().toLowerCase());
    if (skuConflict) {
      setEditError(`Conflict: SKU "${editSku.trim().toUpperCase()}" is already assigned to another asset in this workspace.`);
      return;
    }

    // Verify quantity bounds (cannot reduce below deployed + quarantined sum)
    const deployed = editItem.deployedQty || 0;
    const quarantined = editItem.quarantineQty || 0;
    const calculatedWarehouseQty = qtyNumber - deployed - quarantined;

    if (calculatedWarehouseQty < 0) {
      setEditError(`Quantity Conflict: Reduced Total (${qtyNumber}) cannot support current Deployed (${deployed}) + Quarantined (${quarantined}) units.`);
      return;
    }

    setEditSubmitting(true);

    try {
      const itemRef = doc(db, "inventory", editItem.id);
      
      const updatedFields: Partial<InventoryItem> = {
        name: editItemName.trim(),
        sku: editSku.trim().toUpperCase(),
        category: editCategory.trim(),
        warehouseLocation: editWarehouseLocation.trim(),
        unitOfMeasure: editUnitOfMeasure,
        replacementValue: valueNumber,
        condition: editCondition,
        totalQty: qtyNumber,
        warehouseQty: calculatedWarehouseQty
      };

      await updateDoc(itemRef, updatedFields);

      setEditSuccess("Asset updated successfully!");
      setTimeout(() => {
        setEditItem(null);
        setEditSuccess("");
      }, 1200);

    } catch (err: any) {
      console.error("Asset edit failed:", err);
      setEditError(err.message || "An error occurred while updating the asset.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Submit Handler for Asset Delete
  const handleDeleteAsset = async () => {
    if (!deleteItem || !workspaceId) return;

    setDeleteSubmitting(true);

    try {
      // Safety rule: Cannot delete items currently checked out
      if ((deleteItem.deployedQty || 0) > 0) {
        alert(`Deletion Denied: "${deleteItem.name}" has units currently checked out on active operations.`);
        setDeleteItem(null);
        return;
      }

      const itemRef = doc(db, "inventory", deleteItem.id);
      await deleteDoc(itemRef);

      setDeleteItem(null);
    } catch (err: any) {
      console.error("Asset deletion failed:", err);
      alert(err.message || "An error occurred while deleting the asset.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Filter items based on search query
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render color-coded Condition Badge
  const renderConditionBadge = (cond: InventoryItem["condition"]) => {
    let colorClasses = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    if (cond === "Fair") {
      colorClasses = "bg-amber-500/10 border-amber-500/20 text-amber-400";
    } else if (cond === "Damaged") {
      colorClasses = "bg-red-500/10 border-red-500/20 text-red-400";
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClasses}`}>
        {cond}
      </span>
    );
  };

  // Print Label Handler
  const triggerPrintLabel = () => {
    window.print();
  };

  // Metrics summary
  const totalItemCount = items.length;
  const totalQtySum = items.reduce((sum, item) => sum + item.totalQty, 0);
  const totalQuarantineQty = items.reduce((sum, item) => sum + item.quarantineQty, 0);
  const totalReplValue = items.reduce((sum, item) => sum + (item.replacementValue * item.totalQty), 0);

  if (authLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-zinc-400 text-sm gap-2">
        <RefreshCw className="size-6 animate-spin text-indigo-500" />
        <span>Loading active session...</span>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-white font-heading">No Workspace Session Active</h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm">
          Please log out and sign in with an account associated with a workspace tenant to query operational inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col space-y-8 p-6 md:p-8 bg-zinc-950/20 relative">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white font-heading uppercase">
              Inventory Controls
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Track warehouse operational assets, generate thermal QR labels, and log inventory baselines for workspace: <code className="px-1 py-0.5 rounded bg-zinc-900 text-indigo-300 font-mono text-[10px]">{workspaceId}</code>.
          </p>
        </div>
        <Button 
          onClick={() => setIsNewModalOpen(true)}
          className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-90 shadow-lg shadow-indigo-600/15 h-10 border-none"
        >
          <Plus className="size-4 mr-2" />
          New Asset
        </Button>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div className={`grid grid-cols-1 ${userRole === "admin" ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4 print:hidden`}>
        {/* Metric 1 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Asset SKUs</span>
            <h4 className="text-2xl font-black font-heading tracking-tight text-white">{totalItemCount}</h4>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Box className="size-4.5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Total Units</span>
            <h4 className="text-2xl font-black font-heading tracking-tight text-white">{totalQtySum}</h4>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
            <Activity className="size-4.5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Quarantined</span>
            <h4 className={`text-2xl font-black font-heading tracking-tight ${totalQuarantineQty > 0 ? "text-red-400" : "text-white"}`}>{totalQuarantineQty}</h4>
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
            totalQuarantineQty > 0 
              ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse" 
              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
          }`}>
            <AlertTriangle className="size-4.5" />
          </div>
        </div>

        {/* Metric 4 */}
        {userRole === "admin" && (
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Total Value</span>
              <h4 className="text-2xl font-black font-heading tracking-tight text-cyan-400">
                ₦{totalReplValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Coins className="size-4.5" />
            </div>
          </div>
        )}
      </div>

      {/* DATA TABLE CONTAINER */}
      <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl overflow-hidden shadow-xl print:hidden">
        {/* Table Toolbar */}
        <div className="px-6 py-4 border-b border-zinc-850 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Scale className="size-4.5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-heading">Active Asset Registries</h3>
          </div>
          {/* Search */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search items or SKUs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto min-h-[250px]">
          {loadingItems ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
              <RefreshCw className="size-5 animate-spin text-indigo-500" />
              <span>Querying warehouse records...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
              <Box className="size-8 text-zinc-700 mb-1" />
              <span>No items registered in this workspace inventory yet.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-850 bg-zinc-900/10 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3.5">SKU ID</th>
                  <th className="px-6 py-3.5">Item Name</th>
                  <th className="px-6 py-3.5">UOM</th>
                  {userRole === "admin" && <th className="px-6 py-3.5">Repl. Value</th>}
                  <th className="px-6 py-3.5">Quantities (WH / Dep / Qr)</th>
                  <th className="px-6 py-3.5">Condition</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/40">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-900/20 transition-colors duration-150">
                    {/* SKU */}
                    <td className="px-6 py-4">
                      <code className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/30 border border-indigo-900/30 px-2 py-0.5 rounded">
                        {item.sku}
                      </code>
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4 text-white font-semibold">
                      {item.name}
                    </td>

                    {/* UOM */}
                    <td className="px-6 py-4 text-zinc-400 capitalize">
                      {item.unitOfMeasure}
                    </td>

                    {/* Replacement Value */}
                    {userRole === "admin" && (
                      <td className="px-6 py-4 text-zinc-300">
                        ₦{item.replacementValue.toLocaleString()}
                      </td>
                    )}

                    {/* Quantities (Warehouse, Deployed, Quarantine) */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-[11px]">
                        <span className="font-bold text-white" title="Total">{item.totalQty}</span>
                        <span className="text-zinc-500">U</span>
                        <span className="text-zinc-600">|</span>
                        <span className="text-emerald-400" title="In Warehouse">{item.warehouseQty}wh</span>
                        <span className="text-zinc-600">|</span>
                        <span className="text-cyan-400" title="Deployed">{item.deployedQty}dep</span>
                        <span className="text-zinc-600">|</span>
                        <span className={`font-semibold ${item.quarantineQty > 0 ? "text-red-400" : "text-zinc-500"}`} title="Quarantined">
                          {item.quarantineQty}qu
                        </span>
                      </div>
                    </td>

                    {/* Condition */}
                    <td className="px-6 py-4">
                      {renderConditionBadge(item.condition)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          onClick={() => setActiveLabelItem(item)}
                          variant="ghost"
                          size="xs"
                          className="text-zinc-400 hover:text-white hover:bg-zinc-800 border-zinc-800"
                        >
                          <QrCode className="size-3.5 mr-1" />
                          Print Label
                        </Button>

                        {userRole === "admin" && (
                          <>
                            <Button 
                              onClick={() => openEditModal(item)}
                              variant="ghost"
                              size="xs"
                              className="text-zinc-400 hover:text-indigo-400 hover:bg-indigo-950/20 border-zinc-800"
                            >
                              <Pencil className="size-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              onClick={() => setDeleteItem(item)}
                              variant="ghost"
                              size="xs"
                              className="text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border-zinc-800"
                            >
                              <Trash2 className="size-3.5 mr-1" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* NEW ASSET REGISTRATION DIALOG MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in print:hidden">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top glowing line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Register New Workspace Asset
                </h3>
              </div>
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAsset} className="p-6 space-y-4">
              
              {/* Asset Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Box className="size-3.5 text-zinc-500" />
                  Item Name <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. JBL SRX828SP Active Subwoofer"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* SKU Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-zinc-500" />
                  SKU Alphanumeric <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. SPK-JBL-SRX828"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>

              {/* Category & Warehouse Location */}
              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-zinc-500" />
                    Category
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Audio, Lighting"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Warehouse Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Building className="size-3.5 text-zinc-500" />
                    Warehouse Location
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Shelf A-3, Bin 2"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Unit & Replacement Value */}
              <div className={userRole === "admin" ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                {/* UOM select dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Scale className="size-3.5 text-zinc-500" />
                    Unit of Measure
                  </label>
                  <select 
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="unit">Unit</option>
                    <option value="set">Set</option>
                    <option value="meter">Meter</option>
                    <option value="feet">Feet</option>
                  </select>
                </div>

                {/* Replacement value input */}
                {userRole === "admin" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Coins className="size-3.5 text-zinc-500" />
                      Replacement Value (₦) <span className="text-red-400">*</span>
                    </label>
                    <input 
                      type="number" 
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g. 1500000"
                      value={replacementValue}
                      onChange={(e) => setReplacementValue(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Total Qty & Condition Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Total qty input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Activity className="size-3.5 text-zinc-500" />
                    Total Quantity <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 4"
                    value={totalQty}
                    onChange={(e) => setTotalQty(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Baseline condition radio box/picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-zinc-500" />
                    Baseline Condition
                  </label>
                  <select 
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              {/* Status Feedbacks */}
              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Action trigger buttons */}
              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white h-11"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-95 shadow-lg shadow-indigo-600/10 h-11 border-none"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin text-white" />
                      Registering...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      Register Asset
                      <ArrowRight className="size-4" />
                    </div>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT ASSET DIALOG MODAL */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in print:hidden">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top glowing line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Edit Asset Registry
                </h3>
              </div>
              <button 
                onClick={() => setEditItem(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditAsset} className="p-6 space-y-4">
              
              {/* Asset Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Box className="size-3.5 text-zinc-500" />
                  Item Name <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. JBL SRX828SP Active Subwoofer"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* SKU Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-zinc-500" />
                  SKU Alphanumeric <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. SPK-JBL-SRX828"
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors font-mono"
                />
              </div>

              {/* Category & Warehouse Location */}
              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-zinc-500" />
                    Category
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Audio, Lighting"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Warehouse Location */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Building className="size-3.5 text-zinc-500" />
                    Warehouse Location
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Shelf A-3, Bin 2"
                    value={editWarehouseLocation}
                    onChange={(e) => setEditWarehouseLocation(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Unit & Replacement Value */}
              <div className="grid grid-cols-2 gap-4">
                {/* UOM select dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Scale className="size-3.5 text-zinc-500" />
                    Unit of Measure
                  </label>
                  <select 
                    value={editUnitOfMeasure}
                    onChange={(e) => setEditUnitOfMeasure(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="unit">Unit</option>
                    <option value="set">Set</option>
                    <option value="meter">Meter</option>
                    <option value="feet">Feet</option>
                  </select>
                </div>

                {/* Replacement value input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Coins className="size-3.5 text-zinc-500" />
                    Replacement Value (₦) <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1500000"
                    value={editReplacementValue}
                    onChange={(e) => setEditReplacementValue(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Total Qty & Condition Selection */}
              <div className="grid grid-cols-2 gap-4">
                {/* Total qty input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Activity className="size-3.5 text-zinc-500" />
                    Total Quantity <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 4"
                    value={editTotalQty}
                    onChange={(e) => setEditTotalQty(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Baseline condition picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-zinc-500" />
                    Baseline Condition
                  </label>
                  <select 
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              {/* Status Feedbacks */}
              {editError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Action trigger buttons */}
              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setEditItem(null)}
                  disabled={editSubmitting}
                  className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white h-11"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-95 shadow-lg shadow-indigo-600/10 h-11 border-none"
                >
                  {editSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin text-white" />
                      Saving changes...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      Save Changes
                      <ArrowRight className="size-4" />
                    </div>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ADMIN DELETE CONFIRMATION ALERT DIALOG */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in print:hidden">
          <div className="relative max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Destructive top glowing accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500" />

            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <AlertCircle className="size-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-heading">
                  Confirm Asset Deletion
                </h3>
                <span className="text-[10px] text-zinc-400 font-semibold font-mono">
                  Collection: inventory/{deleteItem.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed mb-6">
              Are you sure you want to permanently delete the asset <strong className="text-white">"{deleteItem.name}"</strong>? This will remove all registry and thermal labels. This action cannot be undone.
            </p>

            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <Button 
                onClick={() => setDeleteItem(null)}
                variant="outline"
                disabled={deleteSubmitting}
                className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteAsset}
                disabled={deleteSubmitting}
                className="flex-1 bg-red-600 text-white font-bold hover:bg-red-700 h-10 border-none shadow-lg shadow-red-600/10"
              >
                {deleteSubmitting ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <RefreshCw className="size-3.5 animate-spin text-white" />
                    Deleting...
                  </div>
                ) : (
                  "Delete Asset"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PIXEL-PERFECT 50mm x 25mm THERMAL QR LABEL MODAL PREVIEW */}
      {activeLabelItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in print:bg-white print:backdrop-blur-none print:absolute print:inset-0">
          
          {/* Main Dialog Panel (hidden when printing) */}
          <div className="relative max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-300 print:hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-heading uppercase">
                  Thermal Label Preview
                </h3>
              </div>
              <button 
                onClick={() => setActiveLabelItem(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Sub-label explanation */}
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Standard 50mm x 25mm industrial barcode roll simulation. Rendered in pixel-perfect high-definition SVG vector format.
            </p>

            {/* 1. THERMAL ROLL PREVIEW FRAME (EXACTLY 50mm x 25mm PHYSICAL MEASUREMENT) */}
            <div className="flex items-center justify-center bg-zinc-950 py-10 rounded-xl border border-zinc-850/80 mb-6">
              <div 
                id="thermal-label-frame"
                className="bg-white text-black p-2 border border-zinc-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] overflow-hidden flex items-center justify-between box-border rounded select-none select-all relative print:border-none print:shadow-none print:m-0"
                style={{ 
                  width: "50mm", 
                  height: "25mm",
                  maxWidth: "50mm",
                  maxHeight: "25mm",
                }}
              >
                {/* Left side text columns */}
                <div className="flex flex-col justify-between h-full max-w-[62%] select-none">
                  {/* Category icon + Item Name Group */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Box className="size-3.5 text-black shrink-0" />
                      <span className="text-[7.5px] uppercase tracking-wide text-zinc-500 font-bold font-mono">
                        Asset Item
                      </span>
                    </div>
                    {/* Item Name (Clipped to prevent box-overflow) */}
                    <h5 
                      className="text-[9.5px] font-black leading-tight text-black line-clamp-2 uppercase break-words pr-0.5 tracking-tight font-heading"
                      title={activeLabelItem.name}
                    >
                      {activeLabelItem.name}
                    </h5>
                  </div>
                  
                  {/* SKU code text */}
                  <code className="text-[7.5px] font-mono font-black text-black leading-none bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">
                    {activeLabelItem.sku}
                  </code>
                </div>

                {/* Right side interactive SVG-rendered QR Code column */}
                <div className="flex items-center justify-center shrink-0 w-[30%]">
                  <QRCodeSVG 
                    value={JSON.stringify({ 
                      wId: activeLabelItem.workspaceId, 
                      itemId: activeLabelItem.id, 
                      sku: activeLabelItem.sku 
                    })} 
                    size={48} 
                    level="M" 
                    includeMargin={false}
                    bgColor="#ffffff" 
                    fgColor="#000000" 
                  />
                </div>
              </div>
            </div>

            {/* Print trigger CTA */}
            <div className="flex gap-3 pt-4 border-t border-zinc-800">
              <Button 
                onClick={() => setActiveLabelItem(null)}
                variant="outline"
                className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white h-10"
              >
                Close Preview
              </Button>
              <Button 
                onClick={triggerPrintLabel}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-95 shadow-lg h-10 border-none"
              >
                <Printer className="size-4 mr-1.5 animate-pulse" />
                Print Label
              </Button>
            </div>

          </div>

          {/* 2. PRINT-SPECIFIC CSS WRAPPER (Renders ONLY the raw label container during physical print) */}
          <div className="hidden print:flex print:fixed print:inset-0 print:items-center print:justify-center print:bg-white print:z-[9999]">
            <div 
              className="bg-white text-black p-2 flex items-center justify-between box-border"
              style={{ 
                width: "50mm", 
                height: "25mm",
                border: "none",
                margin: "0",
              }}
            >
              {/* Text metadata */}
              <div className="flex flex-col justify-between h-full max-w-[62%]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <Box className="size-3 text-black shrink-0" />
                    <span className="text-[7.5px] uppercase tracking-wide text-zinc-500 font-bold font-mono">
                      Asset Item
                    </span>
                  </div>
                  <h5 className="text-[9.5px] font-black leading-tight text-black line-clamp-2 uppercase break-words pr-0.5 tracking-tight font-heading">
                    {activeLabelItem.name}
                  </h5>
                </div>
                <code className="text-[7.5px] font-mono font-black text-black leading-none bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">
                  {activeLabelItem.sku}
                </code>
              </div>

              {/* QR Code */}
              <div className="flex items-center justify-center shrink-0 w-[30%]">
                <QRCodeSVG 
                  value={JSON.stringify({ 
                    wId: activeLabelItem.workspaceId, 
                    itemId: activeLabelItem.id, 
                    sku: activeLabelItem.sku 
                  })} 
                  size={48} 
                  level="M" 
                  bgColor="#ffffff" 
                  fgColor="#000000" 
                />
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Global CSS Inject to configure print-layout sizes strictly */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          /* Keep only our printable label containers visible and centered */
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 25mm !important;
            width: 50mm !important;
          }
          .fixed.inset-0, .fixed.inset-0 * {
            visibility: visible !important;
          }
          /* Hide all other elements inside the layout container */
          .fixed.inset-0 > div:not(.print\\:flex) {
            display: none !important;
            visibility: hidden !important;
          }
          .print\\:flex, .print\\:flex * {
            visibility: visible !important;
            display: flex !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            margin: 0 !important;
            padding: 2px !important;
            width: 50mm !important;
            height: 25mm !important;
          }
        }
      `}</style>

    </div>
  );
}
