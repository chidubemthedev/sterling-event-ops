"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  Building,
  Tag,
  Scale,
  AlertCircle,
  X,
  CheckCircle,
  ArrowRight,
  Pencil,
  Trash2,
  Filter,
  Check
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

const DEFAULT_CATEGORIES = [
  "All Categories",
  "Audio",
  "Lighting",
  "Staging",
  "Furniture",
  "Power & Rigging",
  "Video & LED"
];

export default function InventoryPage() {
  const { workspaceId, user, loading: authLoading } = useWorkspaceStore();
  const [userRole, setUserRole] = useState<string>("staff"); // Secure default

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
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [loadingItems, setLoadingItems] = useState(true);

  // Pagination state
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset pagination when search query or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

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

    setLoadingItems(true);
    const q = query(
      collection(db, "inventory"),
      where("workspaceId", "==", workspaceId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: InventoryItem[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as InventoryItem);
      });
      // Sort client-side by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(list);
      setLoadingItems(false);
    }, (err) => {
      console.error("Firestore query error on inventory collection:", err);
      setLoadingItems(false);
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

    const isValRequired = userRole === "admin" || userRole === "superadmin";
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
        warehouseQty: qtyNumber, // Equal to totalQty initially
        deployedQty: 0,
        quarantineQty: 0,
        workspaceId,             // Multi-tenant isolation
        createdAt: new Date().toISOString(),
        category: category.trim() || "General",
        warehouseLocation: warehouseLocation.trim() || "Main Warehouse"
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
      }, 1200);

    } catch (err: any) {
      console.error("Asset generation failed:", err);
      setFormError(err.message || "An error occurred while creating the asset.");
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item: InventoryItem) => {
    setEditItem(item);
    setEditItemName(item.name);
    setEditSku(item.sku);
    setEditCategory(item.category || "");
    setEditWarehouseLocation(item.warehouseLocation || "");
    setEditUnitOfMeasure(item.unitOfMeasure);
    setEditReplacementValue(item.replacementValue?.toString() || "0");
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
        category: editCategory.trim() || "General",
        warehouseLocation: editWarehouseLocation.trim() || "Main Warehouse",
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
      }, 1000);

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

  // Compute category options combining defaults and existing item categories
  const dynamicCategories = [
    "All Categories",
    ...Array.from(new Set([
      ...DEFAULT_CATEGORIES.filter(c => c !== "All Categories"),
      ...items.map(i => i.category).filter(Boolean) as string[]
    ]))
  ];

  // Filter items based on search query and category filter
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.warehouseLocation && item.warehouseLocation.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = 
      selectedCategory === "All Categories" ||
      (item.category && item.category.toLowerCase() === selectedCategory.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Client-side pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Render color-coded Condition Badge
  const renderConditionBadge = (cond: InventoryItem["condition"]) => {
    let colorClasses = "bg-emerald-50 border-emerald-200/80 text-emerald-800";
    if (cond === "Good") {
      colorClasses = "bg-blue-50 border-blue-200/80 text-blue-800";
    } else if (cond === "Fair") {
      colorClasses = "bg-amber-50 border-amber-200/80 text-amber-800";
    } else if (cond === "Damaged") {
      colorClasses = "bg-rose-50 border-rose-200/80 text-rose-800";
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

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  if (authLoading) {
    return (
      <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center">
        <div className="size-10 rounded-full border-3 border-[#800080]/20 border-t-[#800080] animate-spin" />
        <p className="mt-4 text-xs font-semibold tracking-wide text-neutral-500 font-sans">
          Loading inventory records...
        </p>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
        <div className="size-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 font-sans">No Workspace Session Active</h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          Please sign in with an account associated with an active workspace to access equipment inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* --- PAGE HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 border border-purple-200/80 text-[#800080] uppercase tracking-wider">
              EQUIPMENT INVENTORY
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Asset Catalog
          </h1>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            Manage rental equipment, generate thermal QR tags, track asset condition, and monitor warehouse stock levels.
          </p>
        </div>

        <Button 
          onClick={() => setIsNewModalOpen(true)}
          className="bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl shadow-xs h-10 px-4 cursor-pointer self-start md:self-auto"
        >
          <Plus className="size-4 mr-2" />
          + Add New Asset
        </Button>
      </div>

      {/* --- METRIC SUMMARY CARDS --- */}
      <div className={`grid grid-cols-1 ${isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4 print:hidden`}>
        
        {/* Metric 1: Unique SKUs */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Unique SKUs</span>
            <h4 className="text-3xl font-bold text-neutral-900 tracking-tight">{totalItemCount}</h4>
          </div>
          <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center shrink-0">
            <Box className="size-5" />
          </div>
        </div>

        {/* Metric 2: Total Item Quantity */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Total Item Quantity</span>
            <h4 className="text-3xl font-bold text-neutral-900 tracking-tight">{totalQtySum}</h4>
          </div>
          <div className="size-11 rounded-xl bg-[#ffd700]/15 border border-[#ffd700]/40 text-[#800080] flex items-center justify-center shrink-0">
            <Layers className="size-5" />
          </div>
        </div>

        {/* Metric 3: In Maintenance / Missing */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">In Maintenance / Missing</span>
            <h4 className={`text-3xl font-bold tracking-tight ${totalQuarantineQty > 0 ? "text-rose-600" : "text-neutral-900"}`}>
              {totalQuarantineQty}
            </h4>
          </div>
          <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 border ${
            totalQuarantineQty > 0 
              ? "bg-rose-50 border-rose-100 text-rose-600" 
              : "bg-purple-50 border-purple-100 text-[#800080]"
          }`}>
            <AlertTriangle className="size-5" />
          </div>
        </div>

        {/* Metric 4: Total Catalog Worth (Role Guarded: Admin Only) */}
        {isAdmin && (
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Total Catalog Worth</span>
              <h4 className="text-2xl lg:text-3xl font-bold text-neutral-900 tracking-tight truncate">
                ₦{totalReplValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
            </div>
            <div className="size-11 rounded-xl bg-[#ffd700]/20 border border-[#ffd700]/50 text-[#800080] flex items-center justify-center shrink-0">
              <Coins className="size-5 text-[#800080]" />
            </div>
          </div>
        )}
      </div>

      {/* --- SEARCH & CATEGORY FILTER BAR --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        
        {/* Search Input */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
          <Input 
            type="text" 
            placeholder="Search by asset name, SKU, or location..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-50/60 border-neutral-200 rounded-xl pl-10 pr-4 text-xs h-10 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-[#800080]"
          />
        </div>

        {/* Category Filter Pills / Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="size-4 text-neutral-400 shrink-0" />
          <div className="relative w-full sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 outline-none focus:border-[#800080] transition-colors cursor-pointer appearance-none"
              style={{
                backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                backgroundSize: '16px'
              }}
            >
              {dynamicCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* --- INVENTORY TABLE CONTAINER --- */}
      <div className="bg-white border border-neutral-200/80 rounded-xl shadow-xs overflow-hidden print:hidden">
        
        {/* Table Header / Title Bar */}
        <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Box className="size-4 text-[#800080]" />
            <h3 className="text-sm font-bold text-neutral-900">
              Asset Records
            </h3>
            <span className="text-xs text-neutral-500 font-medium">
              ({filteredItems.length} {filteredItems.length === 1 ? "item" : "items"})
            </span>
          </div>

          {selectedCategory !== "All Categories" && (
            <Badge variant="purple" className="text-[10px]">
              Filtered: {selectedCategory}
            </Badge>
          )}
        </div>

        {/* Table Data Outlet */}
        <div className="overflow-x-auto min-h-[300px]">
          {loadingItems ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-500 text-xs gap-3">
              <div className="size-8 rounded-full border-2 border-[#800080]/20 border-t-[#800080] animate-spin" />
              <span>Querying warehouse records...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="size-12 rounded-full bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center mb-3">
                <Box className="size-6" />
              </div>
              {items.length === 0 ? (
                <>
                  <h4 className="text-sm font-bold text-neutral-900">No inventory items added yet</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    Click <strong>"+ Add New Asset"</strong> to register your first piece of equipment.
                  </p>
                  <Button
                    onClick={() => setIsNewModalOpen(true)}
                    className="mt-4 bg-[#800080] hover:bg-[#660066] text-white text-xs rounded-xl shadow-xs"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    + Add New Asset
                  </Button>
                </>
              ) : (
                <>
                  <h4 className="text-sm font-bold text-neutral-900">No matching assets found</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                    No equipment matches your search query or selected category filter.
                  </p>
                  <Button
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("All Categories");
                    }}
                    variant="outline"
                    className="mt-4 border-neutral-200 text-xs rounded-xl"
                  >
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="px-6 py-3.5">SKU ID</th>
                  <th className="px-6 py-3.5">Item Name</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">UOM</th>
                  {isAdmin && <th className="px-6 py-3.5">Repl. Value</th>}
                  <th className="px-6 py-3.5">Quantities (Total / WH / Dep / Maint)</th>
                  <th className="px-6 py-3.5">Condition</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/70 bg-white">
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors duration-150">
                    
                    {/* SKU */}
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-[#800080] bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md">
                        {item.sku}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-6 py-4">
                      <span className="font-semibold text-neutral-900 block">{item.name}</span>
                      {item.warehouseLocation && (
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                          <Building className="size-3 text-neutral-400" />
                          {item.warehouseLocation}
                        </span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200/60">
                        {item.category || "General"}
                      </span>
                    </td>

                    {/* UOM */}
                    <td className="px-6 py-4 text-neutral-600 capitalize">
                      {item.unitOfMeasure}
                    </td>

                    {/* Replacement Value (Role Guarded: Admin Only) */}
                    {isAdmin && (
                      <td className="px-6 py-4 text-neutral-800 font-medium">
                        ₦{item.replacementValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    )}

                    {/* Quantities (Warehouse, Deployed, Quarantine) */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-bold text-neutral-900" title="Total Units">{item.totalQty}</span>
                        <span className="text-neutral-400">total</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-emerald-700 font-semibold" title="In Warehouse">{item.warehouseQty} wh</span>
                        <span className="text-neutral-300">·</span>
                        <span className="text-purple-700 font-semibold" title="Currently Deployed">{item.deployedQty} dep</span>
                        <span className="text-neutral-300">·</span>
                        <span className={`font-semibold ${item.quarantineQty > 0 ? "text-rose-600" : "text-neutral-400"}`} title="In Maintenance">
                          {item.quarantineQty} maint
                        </span>
                      </div>
                    </td>

                    {/* Condition */}
                    <td className="px-6 py-4">
                      {renderConditionBadge(item.condition)}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* Printable QR Code Label Button */}
                        <Button 
                          onClick={() => setActiveLabelItem(item)}
                          variant="outline"
                          size="xs"
                          className="border-neutral-200 text-neutral-700 hover:bg-neutral-100 h-8 px-2.5 rounded-lg text-xs font-medium cursor-pointer"
                        >
                          <QrCode className="size-3.5 mr-1 text-[#800080]" />
                          QR Label
                        </Button>

                        {/* Admin Action Buttons (Role Guarded: Admin Only) */}
                        {isAdmin && (
                          <>
                            <Button 
                              onClick={() => openEditModal(item)}
                              variant="ghost"
                              size="xs"
                              className="text-neutral-600 hover:text-[#800080] hover:bg-purple-50 h-8 w-8 p-0 rounded-lg cursor-pointer"
                              title="Edit Asset"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button 
                              onClick={() => setDeleteItem(item)}
                              variant="ghost"
                              size="xs"
                              className="text-neutral-600 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 p-0 rounded-lg cursor-pointer"
                              title="Delete Asset"
                            >
                              <Trash2 className="size-3.5" />
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

        {/* Pagination Footer */}
        {filteredItems.length > 0 && (
          <div className="flex items-center justify-between border-t border-neutral-200/80 px-6 py-4 bg-white rounded-b-xl">
            {/* Entry counter */}
            <div className="text-xs text-neutral-500 font-medium">
              Showing{" "}
              <span className="font-semibold text-neutral-900">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>
              –
              <span className="font-semibold text-neutral-900">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-neutral-900">
                {filteredItems.length}
              </span>{" "}
              total items
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 text-xs border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </Button>
              <span className="text-xs text-neutral-600 font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 px-3 text-xs border-neutral-200 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* --- NEW ASSET REGISTRATION DIALOG MODAL --- */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in print:hidden">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-purple-50 text-[#800080] border border-purple-100 flex items-center justify-center">
                  <Box className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Add New Equipment Asset
                </h3>
              </div>
              <button 
                onClick={() => setIsNewModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAsset} className="p-6 space-y-4 text-xs">
              
              {/* Asset Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Box className="size-3.5 text-neutral-400" />
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="text" 
                  required
                  placeholder="e.g. JBL SRX828SP Dual 18&quot; Subwoofer"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                />
              </div>

              {/* SKU Code */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-neutral-400" />
                  SKU Alphanumeric <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="text" 
                  required
                  placeholder="e.g. SPK-JBL-SRX828"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs font-mono uppercase focus-visible:ring-[#800080]"
                />
              </div>

              {/* Category & Warehouse Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-neutral-400" />
                    Category
                  </label>
                  <Input 
                    type="text" 
                    placeholder="e.g. Audio, Lighting"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Building className="size-3.5 text-neutral-400" />
                    Warehouse Location
                  </label>
                  <Input 
                    type="text" 
                    placeholder="e.g. Rack A-3, Bin 2"
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>
              </div>

              {/* Unit of Measure & Replacement Value */}
              <div className={isAdmin ? "grid grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Scale className="size-3.5 text-neutral-400" />
                    Unit of Measure
                  </label>
                  <select 
                    value={unitOfMeasure}
                    onChange={(e) => setUnitOfMeasure(e.target.value as any)}
                    className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl px-3 h-10 text-xs text-neutral-900 outline-none focus:border-[#800080] transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="unit">Unit</option>
                    <option value="set">Set</option>
                    <option value="meter">Meter</option>
                    <option value="feet">Feet</option>
                  </select>
                </div>

                {isAdmin && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                      <Coins className="size-3.5 text-neutral-400" />
                      Replacement Value (₦) <span className="text-rose-500">*</span>
                    </label>
                    <Input 
                      type="number" 
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g. 1500000"
                      value={replacementValue}
                      onChange={(e) => setReplacementValue(e.target.value)}
                      className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                    />
                  </div>
                )}
              </div>

              {/* Total Qty & Condition Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-neutral-400" />
                    Total Quantity <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 4"
                    value={totalQty}
                    onChange={(e) => setTotalQty(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-neutral-400" />
                    Baseline Condition
                  </label>
                  <select 
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as any)}
                    className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl px-3 h-10 text-xs text-neutral-900 outline-none focus:border-[#800080] transition-colors cursor-pointer appearance-none"
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
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Action trigger buttons */}
              <div className="pt-3 flex gap-3 border-t border-neutral-200/80">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewModalOpen(false)}
                  disabled={submitting}
                  className="flex-1 border-neutral-200 text-neutral-600 hover:bg-neutral-50 h-10 rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 rounded-xl shadow-xs"
                >
                  {submitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Registering...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
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

      {/* --- ADMIN EDIT ASSET DIALOG MODAL --- */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in print:hidden">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-purple-50 text-[#800080] border border-purple-100 flex items-center justify-center">
                  <Pencil className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Edit Equipment Asset
                </h3>
              </div>
              <button 
                onClick={() => setEditItem(null)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditAsset} className="p-6 space-y-4 text-xs">
              
              {/* Asset Name */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Box className="size-3.5 text-neutral-400" />
                  Item Name <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="text" 
                  required
                  placeholder="e.g. JBL SRX828SP Dual 18&quot; Subwoofer"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                />
              </div>

              {/* SKU Code */}
              <div className="space-y-1.5">
                <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Tag className="size-3.5 text-neutral-400" />
                  SKU Alphanumeric <span className="text-rose-500">*</span>
                </label>
                <Input 
                  type="text" 
                  required
                  placeholder="e.g. SPK-JBL-SRX828"
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value)}
                  className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs font-mono uppercase focus-visible:ring-[#800080]"
                />
              </div>

              {/* Category & Warehouse Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-neutral-400" />
                    Category
                  </label>
                  <Input 
                    type="text" 
                    placeholder="e.g. Audio, Lighting"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Building className="size-3.5 text-neutral-400" />
                    Warehouse Location
                  </label>
                  <Input 
                    type="text" 
                    placeholder="e.g. Rack A-3, Bin 2"
                    value={editWarehouseLocation}
                    onChange={(e) => setEditWarehouseLocation(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>
              </div>

              {/* Unit of Measure & Replacement Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Scale className="size-3.5 text-neutral-400" />
                    Unit of Measure
                  </label>
                  <select 
                    value={editUnitOfMeasure}
                    onChange={(e) => setEditUnitOfMeasure(e.target.value as any)}
                    className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl px-3 h-10 text-xs text-neutral-900 outline-none focus:border-[#800080] transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="unit">Unit</option>
                    <option value="set">Set</option>
                    <option value="meter">Meter</option>
                    <option value="feet">Feet</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Coins className="size-3.5 text-neutral-400" />
                    Replacement Value (₦) <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    type="number" 
                    required
                    min="0"
                    step="0.01"
                    placeholder="e.g. 1500000"
                    value={editReplacementValue}
                    onChange={(e) => setEditReplacementValue(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>
              </div>

              {/* Total Qty & Condition Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <Layers className="size-3.5 text-neutral-400" />
                    Total Quantity <span className="text-rose-500">*</span>
                  </label>
                  <Input 
                    type="number" 
                    required
                    min="1"
                    placeholder="e.g. 4"
                    value={editTotalQty}
                    onChange={(e) => setEditTotalQty(e.target.value)}
                    className="bg-neutral-50/60 border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-neutral-700 flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5 text-neutral-400" />
                    Baseline Condition
                  </label>
                  <select 
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value as any)}
                    className="w-full bg-neutral-50/60 border border-neutral-200 rounded-xl px-3 h-10 text-xs text-neutral-900 outline-none focus:border-[#800080] transition-colors cursor-pointer appearance-none"
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
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Action trigger buttons */}
              <div className="pt-3 flex gap-3 border-t border-neutral-200/80">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setEditItem(null)}
                  disabled={editSubmitting}
                  className="flex-1 border-neutral-200 text-neutral-600 hover:bg-neutral-50 h-10 rounded-xl"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 rounded-xl shadow-xs"
                >
                  {editSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Saving changes...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
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

      {/* --- ADMIN DELETE CONFIRMATION ALERT DIALOG --- */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in print:hidden">
          <div className="relative max-w-sm w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="size-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                <AlertCircle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Confirm Asset Deletion
                </h3>
                <span className="text-[10px] text-neutral-500 font-mono">
                  SKU: {deleteItem.sku}
                </span>
              </div>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed mb-6">
              Are you sure you want to permanently delete the asset <strong className="text-neutral-900">"{deleteItem.name}"</strong>? This will remove all registry and thermal labels. This action cannot be undone.
            </p>

            <div className="flex gap-3 pt-3 border-t border-neutral-200/80">
              <Button 
                onClick={() => setDeleteItem(null)}
                variant="outline"
                disabled={deleteSubmitting}
                className="flex-1 border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleDeleteAsset}
                disabled={deleteSubmitting}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium h-10 rounded-xl text-xs shadow-xs"
              >
                {deleteSubmitting ? (
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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

      {/* --- 50mm x 25mm THERMAL QR LABEL MODAL PREVIEW --- */}
      {activeLabelItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in print:bg-white print:backdrop-blur-none print:absolute print:inset-0">
          
          {/* Main Dialog Panel (hidden when printing) */}
          <div className="relative max-w-sm w-full bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xl animate-in zoom-in-95 duration-200 print:hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="size-7 rounded-lg bg-purple-50 text-[#800080] border border-purple-100 flex items-center justify-center">
                  <QrCode className="size-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Thermal Label Preview (50mm x 25mm)
                </h3>
              </div>
              <button 
                onClick={() => setActiveLabelItem(null)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Sub-label explanation */}
            <p className="text-xs text-neutral-500 mb-5 leading-relaxed">
              Standard 50mm x 25mm industrial barcode roll simulation. Rendered in high-definition vector SVG format.
            </p>

            {/* 1. THERMAL ROLL PREVIEW FRAME (EXACTLY 50mm x 25mm) */}
            <div className="flex items-center justify-center bg-neutral-100/80 py-8 rounded-xl border border-neutral-200 mb-5">
              <div 
                id="thermal-label-frame"
                className="bg-white text-black p-2 border border-neutral-300 shadow-sm overflow-hidden flex items-center justify-between box-border rounded select-none select-all relative print:border-none print:shadow-none print:m-0"
                style={{ 
                  width: "50mm", 
                  height: "25mm",
                  maxWidth: "50mm",
                  maxHeight: "25mm",
                }}
              >
                {/* Left side text columns */}
                <div className="flex flex-col justify-between h-full max-w-[62%] select-none">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <Box className="size-3 text-black shrink-0" />
                      <span className="text-[7.5px] uppercase tracking-wide text-neutral-500 font-bold font-mono">
                        Asset Item
                      </span>
                    </div>
                    {/* Item Name */}
                    <h5 
                      className="text-[9.5px] font-black leading-tight text-black line-clamp-2 uppercase break-words pr-0.5 tracking-tight"
                      title={activeLabelItem.name}
                    >
                      {activeLabelItem.name}
                    </h5>
                  </div>
                  
                  {/* SKU code text */}
                  <code className="text-[7.5px] font-mono font-black text-black leading-none bg-neutral-100 px-1 py-0.5 rounded border border-neutral-200">
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
            <div className="flex gap-3 pt-3 border-t border-neutral-200/80">
              <Button 
                onClick={() => setActiveLabelItem(null)}
                variant="outline"
                className="flex-1 border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-10 rounded-xl text-xs"
              >
                Close Preview
              </Button>
              <Button 
                onClick={triggerPrintLabel}
                className="flex-1 bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 rounded-xl shadow-xs text-xs"
              >
                <Printer className="size-3.5 mr-1.5" />
                Print Label
              </Button>
            </div>

          </div>

          {/* 2. PRINT-SPECIFIC CSS WRAPPER (Renders ONLY the raw label during physical print) */}
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
                  <h5 className="text-[9.5px] font-black leading-tight text-black line-clamp-2 uppercase break-words pr-0.5 tracking-tight">
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

      {/* Global CSS for 50mm x 25mm thermal print layout */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
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
