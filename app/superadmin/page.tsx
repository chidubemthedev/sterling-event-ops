"use client";

import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Layers,
  Users,
  Calendar,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Building,
  Mail,
  Tag,
  X,
  Clock,
  ArrowRight,
  Sparkles,
  Search,
  Lock,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  Edit3,
  ToggleLeft,
  UserCheck,
  Settings,
  Shield,
  Activity,
} from "lucide-react";
import { signOut } from "firebase/auth";

interface Workspace {
  id: string;
  companyName: string;
  ownerEmail: string;
  subscription: {
    isActive: boolean;
    plan: string;
    validUntil: string;
  };
  virtualFolders?: {
    warehouse: string;
    active_events: string;
    archived_events: string;
    quarantine: string;
  };
  createdAt: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  workspaceId: string;
  isActive?: boolean;
  createdAt?: string;
}

export default function SuperadminPage() {
  const { user, loading: authLoading } = useWorkspaceStore();
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [checkingClaims, setCheckingClaims] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"workspaces" | "users">(
    "workspaces",
  );

  // Real-time collections lists
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [globalUsers, setGlobalUsers] = useState<UserProfile[]>([]);

  // Search parameters
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userStatusFilter, setUserStatusFilter] = useState("all");

  // Loading indicators
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Workspace Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingWorkspace, setSubmittingWorkspace] = useState(false);
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createOwnerEmail, setCreateOwnerEmail] = useState("");
  const [createSubscriptionTier, setCreateSubscriptionTier] =
    useState("premium");
  const [createExpiryDate, setCreateExpiryDate] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Invitation Success Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Workspace EDIT Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingEditWorkspace, setSavingWorkspaceEdit] = useState(false);
  const [editWorkspaceId, setEditWorkspaceId] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editSubscriptionTier, setEditSubscriptionTier] = useState("premium");
  const [editExpiryDate, setEditExpiryDate] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // Check custom claims & developer email bypass
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsSuperadmin(false);
      setCheckingClaims(false);
      return;
    }

    const checkClaims = async () => {
      try {
        setCheckingClaims(true);
        const tokenResult = await user.getIdTokenResult();

        const hasClaim = tokenResult.claims.role === "superadmin";
        const isBypassEmail = user.email === "chukwudubem7@gmail.com";

        if (hasClaim || isBypassEmail) {
          setIsSuperadmin(true);
        } else {
          setIsSuperadmin(false);
        }
      } catch (error) {
        console.error("Error reading ID token claims:", error);
        setIsSuperadmin(false);
      } finally {
        setCheckingClaims(false);
      }
    };

    checkClaims();
  }, [user, authLoading]);

  // Real-time workspaces snapshot listener
  useEffect(() => {
    if (!isSuperadmin) return;

    const q = query(collection(db, "workspaces"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Workspace[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Workspace);
        });
        setWorkspaces(list);
        setLoadingWorkspaces(false);
      },
      (err) => {
        console.error("Error loading workspaces real-time snapshot:", err);
        setLoadingWorkspaces(false);
      },
    );

    return () => unsubscribe();
  }, [isSuperadmin]);

  // Real-time global users snapshot listener (Cross-Tenant)
  useEffect(() => {
    if (!isSuperadmin) return;

    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as UserProfile);
        });
        setGlobalUsers(list);
        setLoadingUsers(false);
      },
      (err) => {
        console.error("Error loading cross-tenant user registries:", err);
        setLoadingUsers(false);
      },
    );

    return () => unsubscribe();
  }, [isSuperadmin]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  // 1. Provision New Workspace Handler
  const handleProvisionWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    if (
      !createCompanyName.trim() ||
      !createOwnerEmail.trim() ||
      !createExpiryDate
    ) {
      setCreateError("Please fill out all required fields.");
      return;
    }

    setSubmittingWorkspace(true);

    try {
      // Slugified unique workspace ID creation
      const baseSlug = createCompanyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const shortHash = Math.floor(1000 + Math.random() * 9000);
      const generatedWorkspaceId = `${baseSlug || "tenant"}-${shortHash}`;

      // Initialize the workspace document structure
      const workspaceRef = doc(db, "workspaces", generatedWorkspaceId);
      const newWorkspace: Workspace = {
        id: generatedWorkspaceId,
        companyName: createCompanyName.trim(),
        ownerEmail: createOwnerEmail.trim().toLowerCase(),
        subscription: {
          isActive: true,
          plan: createSubscriptionTier,
          validUntil: createExpiryDate,
        },
        virtualFolders: {
          warehouse: `/workspaces/${generatedWorkspaceId}/warehouse`,
          active_events: `/workspaces/${generatedWorkspaceId}/active_events`,
          archived_events: `/workspaces/${generatedWorkspaceId}/archived_events`,
          quarantine: `/workspaces/${generatedWorkspaceId}/quarantine`,
        },
        createdAt: new Date().toISOString(),
      };

      await setDoc(workspaceRef, newWorkspace);

      // Construct dynamic unique cryptographical invite token
      const inviteToken =
        typeof window !== "undefined" &&
        window.crypto &&
        window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);

      const inviteRef = doc(db, "invites", inviteToken);
      await setDoc(inviteRef, {
        id: inviteToken,
        workspaceId: generatedWorkspaceId,
        workspaceName: createCompanyName.trim(),
        ownerEmail: createOwnerEmail.trim().toLowerCase(),
        role: "admin",
        accepted: false,
        createdAt: new Date().toISOString(),
      });

      setCreateSuccess(
        `Successfully registered new domain and built security invitation!`,
      );
      const inviteUrl = `${window.location.origin}/accept-invite?token=${inviteToken}`;
      setGeneratedInviteUrl(inviteUrl);

      // Reset forms
      setCreateCompanyName("");
      setCreateOwnerEmail("");
      setCreateSubscriptionTier("premium");
      setCreateExpiryDate("");

      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess("");
        setIsInviteModalOpen(true);
      }, 1200);
    } catch (err: any) {
      console.error("Workspace provision error:", err);
      setCreateError(
        err.message || "Failed to provision workspace database records.",
      );
    } finally {
      setSubmittingWorkspace(false);
    }
  };

  // 2. Edit Workspace Submit Handler
  const handleSaveWorkspaceEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");

    if (!editCompanyName.trim() || !editExpiryDate) {
      setEditError(
        "Workspace company name and expiration date are required parameters.",
      );
      return;
    }

    setSavingWorkspaceEdit(true);

    try {
      const workspaceRef = doc(db, "workspaces", editWorkspaceId);
      await setDoc(
        workspaceRef,
        {
          companyName: editCompanyName.trim(),
          subscription: {
            isActive: editIsActive,
            plan: editSubscriptionTier,
            validUntil: editExpiryDate,
          },
        },
        { merge: true },
      );

      setEditSuccess("Workspace configuration synced successfully.");

      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess("");
      }, 1000);
    } catch (err: any) {
      console.error("Error editing workspace metrics:", err);
      setEditError(err.message || "Failed to save workspace modifications.");
    } finally {
      setSavingWorkspaceEdit(false);
    }
  };

  // 3. User Directories Control Suspensions
  const handleToggleUserActive = async (
    userId: string,
    currentStatus: boolean,
  ) => {
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { isActive: !currentStatus }, { merge: true });
    } catch (err) {
      console.error("Failed override suspension toggle on user:", err);
    }
  };

  // 4. User Role Correction Action
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { role: newRole }, { merge: true });
    } catch (err) {
      console.error("Failed to correct operator role:", err);
    }
  };

  // Helper to safely parse dates across strings, timestamps, and numbers
  const parseExpiryDateHelper = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val === "object" && val !== null) {
      if (typeof val.toDate === "function") return val.toDate();
      if (typeof val.seconds === "number") return new Date(val.seconds * 1000);
    }
    if (typeof val === "string") {
      let formattedVal = val;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        formattedVal = `${val}T23:59:59`;
      }
      const d = new Date(formattedVal);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // 1. Dynamic Status Calculation hierarchical resolver
  const getWorkspaceStatus = (
    ws: Workspace,
  ): "Suspended" | "Expired" | "Active" => {
    const sub = ws.subscription || {};
    const isActive = sub.isActive !== false;
    if (!isActive) return "Suspended";

    if (sub.validUntil) {
      const parsedExpiry = parseExpiryDateHelper(sub.validUntil);
      if (parsedExpiry && parsedExpiry.getTime() < Date.now()) {
        return "Expired";
      }
    }

    return "Active";
  };

  // Active parameters filter combining text search, plan filter, and dynamic status filter
  const filteredWorkspaces = workspaces.filter((ws) => {
    // A. Text query matching
    const matchesSearch =
      ws.companyName.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      ws.id.toLowerCase().includes(workspaceSearch.toLowerCase()) ||
      ws.ownerEmail.toLowerCase().includes(workspaceSearch.toLowerCase());

    if (!matchesSearch) return false;

    // B. Subscription plan filtering
    if (planFilter !== "all") {
      const currentPlan = ws.subscription?.plan?.toLowerCase() || "basic";
      if (currentPlan !== planFilter.toLowerCase()) return false;
    }

    // C. Dynamic computed status filtering
    if (statusFilter !== "all") {
      const computedStatus = getWorkspaceStatus(ws).toLowerCase();
      if (computedStatus !== statusFilter.toLowerCase()) return false;
    }

    return true;
  });

  const filteredUsers = globalUsers.filter((u) => {
    // A. Text query matching
    const matchesSearch =
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.workspaceId.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.role?.toLowerCase().includes(userSearch.toLowerCase());

    if (!matchesSearch) return false;

    // B. Access Status filtering
    if (userStatusFilter !== "all") {
      const isSuspended = u.isActive === false;
      if (userStatusFilter === "Active" && isSuspended) return false;
      if (userStatusFilter === "Suspended" && !isSuspended) return false;
    }

    return true;
  });

  // Security authorization waiting block
  if (authLoading || checkingClaims) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-50">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Authenticating Global Systems...
        </p>
      </div>
    );
  }

  // Access Denied screen
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-red-500/10 blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-md relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500" />

          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto mb-6">
            <Lock className="size-8" />
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 mb-4 uppercase tracking-wide">
            Restricted System Directory
          </span>

          <h2 className="text-xl font-bold tracking-tight text-white font-heading mb-3">
            Superadmin Cockpit Locked
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Your current account credentials do not possess custom superadmin
            claims. Access is securely blocked.
          </p>

          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white h-11"
          >
            <LogOut className="size-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Overall Statistics Calculators
  const totalWorkspaces = workspaces.length;
  const activeSubs = workspaces.filter(
    (ws) => ws.subscription?.isActive,
  ).length;
  const totalUsers = globalUsers.length;
  const suspendedUsers = globalUsers.filter((u) => u.isActive === false).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* Visual background atmospheric mesh */}
      <div className="absolute top-[-10%] right-[-10%] w-[550px] h-[550px] rounded-full bg-indigo-500/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[550px] h-[550px] rounded-full bg-cyan-500/5 blur-[130px] pointer-events-none" />

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 border-b border-zinc-850 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-indigo-500/15">
            SF
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-tight text-white font-heading uppercase leading-none">
              Sterling Ops Console
            </h1>
            <span className="text-[9px] text-indigo-400 font-mono tracking-wider font-bold">
              Platform Super Admin Control
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-zinc-200">
              {user?.email}
            </span>
            <span className="text-[9px] text-emerald-400 font-mono font-medium flex items-center justify-end gap-1">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
              Bypass Superadmin Active
            </span>
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white hover:bg-zinc-900 border-zinc-800"
          >
            <LogOut className="size-4 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 z-10 relative">
        {/* MASTER HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
          <div>
            <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">
              Global Platform Command Center
            </span>
            <h2 className="text-2xl font-black tracking-tight text-white font-heading mt-1">
              Super Admin Platform Cockpit
            </h2>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed max-w-2xl font-medium">
              Provision new client organizations on-demand, manage subscription
              licenses globally, suspend compromised domains, and override
              operator access states.
            </p>
          </div>

          <Button
            onClick={() => {
              setCreateCompanyName("");
              setCreateOwnerEmail("");
              setCreateSubscriptionTier("premium");
              setCreateExpiryDate("");
              setIsCreateModalOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 px-5 rounded-xl border-none shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Provision New Workspace</span>
          </Button>
        </div>

        {/* METRICS ROOM */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          {/* Workspaces */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 backdrop-blur-md flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-[-20px] left-[-20px] w-12 h-12 rounded-full bg-indigo-500/5 blur-lg pointer-events-none" />
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                Total Clients
              </span>
              <h3 className="text-2xl font-black font-heading text-white">
                {totalWorkspaces}
              </h3>
            </div>
            <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Building className="size-4.5" />
            </div>
          </div>

          {/* Active domains */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 backdrop-blur-md flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-[-20px] left-[-20px] w-12 h-12 rounded-full bg-emerald-500/5 blur-lg pointer-events-none" />
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                Active Licenses
              </span>
              <h3 className="text-2xl font-black font-heading text-emerald-400">
                {activeSubs}
              </h3>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Activity className="size-4.5 animate-pulse" />
            </div>
          </div>

          {/* Users */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 backdrop-blur-md flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-[-20px] left-[-20px] w-12 h-12 rounded-full bg-purple-500/5 blur-lg pointer-events-none" />
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                Global Operators
              </span>
              <h3 className="text-2xl font-black font-heading text-white">
                {totalUsers}
              </h3>
            </div>
            <div className="size-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Users className="size-4.5" />
            </div>
          </div>

          {/* Suspended accounts */}
          <div className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 backdrop-blur-md flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-[-20px] left-[-20px] w-12 h-12 rounded-full bg-red-500/5 blur-lg pointer-events-none" />
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">
                Suspended Profiles
              </span>
              <h3 className="text-2xl font-black font-heading text-red-400">
                {suspendedUsers}
              </h3>
            </div>
            <div className="size-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="size-4.5" />
            </div>
          </div>
        </div>

        {/* TAB SWITCH HEADERS */}
        <div className="flex border-b border-zinc-850 gap-2.5">
          <button
            onClick={() => setActiveTab("workspaces")}
            className={`px-5 py-3 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer ${
              activeTab === "workspaces"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Client Workspaces ({totalWorkspaces})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-3 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer ${
              activeTab === "users"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Global User Registries ({totalUsers})
          </button>
        </div>

        {/* TAB INTERFACES WINDOW */}
        <div className="space-y-6">
          {/* ==================== TAB 1: WORKSPACE MANAGEMENT ==================== */}
          {activeTab === "workspaces" && (
            <div className="space-y-5">
              {/* Header block with search */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/30 border border-zinc-850 p-4 rounded-xl backdrop-blur-md">
                <span className="text-xs text-zinc-400 font-semibold">
                  Active Client Registry list and real-time subscription
                  parameters.
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  {/* Subscription Plan Filter Selector */}
                  <div className="relative">
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-semibold outline-none cursor-pointer appearance-none pr-8 min-w-[120px]"
                      style={{
                        backgroundImage:
                          "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 8px center",
                        backgroundSize: "14px",
                      }}
                    >
                      <option value="all">All Plans</option>
                      <option value="trial">Trial</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>

                  {/* Service Status Filter Selector */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-semibold outline-none cursor-pointer appearance-none pr-8 min-w-[120px]"
                      style={{
                        backgroundImage:
                          "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 8px center",
                        backgroundSize: "14px",
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Search Query bar */}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500 animate-pulse" />
                    <input
                      type="text"
                      placeholder="Search company, ID..."
                      value={workspaceSearch}
                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Workspaces Table */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto min-h-[250px]">
                  {loadingWorkspaces ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-xs text-zinc-500 font-mono">
                      <RefreshCw className="size-5 animate-spin text-indigo-500" />
                      <span>Fetching tenant data pools...</span>
                    </div>
                  ) : filteredWorkspaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-xs text-zinc-500 font-semibold">
                      <Building className="size-8 text-zinc-600 mb-1" />
                      <span>No workspaces matched query configurations.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-850 bg-zinc-900/10 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="px-6 py-4">Company Details</th>
                          <th className="px-6 py-4">Workspace ID</th>
                          <th className="px-6 py-4">Subscription Plan</th>
                          <th className="px-6 py-4">Expiration Date</th>
                          <th className="px-6 py-4">Service Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40 font-medium">
                        {filteredWorkspaces.map((ws) => {
                          const activeState =
                            ws.subscription?.isActive !== false;

                          return (
                            <tr
                              key={ws.id}
                              className="hover:bg-zinc-900/20 transition-colors"
                            >
                              {/* Company Name / Email */}
                              <td className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <span className="text-white font-bold block text-sm">
                                    {ws.companyName}
                                  </span>
                                  <span className="text-[10.5px] text-zinc-500 block font-mono">
                                    {ws.ownerEmail}
                                  </span>
                                </div>
                              </td>

                              {/* Workspace ID */}
                              <td className="px-6 py-4">
                                <code className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-850">
                                  {ws.id}
                                </code>
                              </td>

                              {/* Plan Tier Badge */}
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                    ws.subscription?.plan === "enterprise"
                                      ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                      : ws.subscription?.plan === "premium"
                                        ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                                  }`}
                                >
                                  {ws.subscription?.plan || "Premium"} Tier
                                </span>
                              </td>

                              {/* Expiration date */}
                              <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="size-3.5 text-zinc-500" />
                                  <span>
                                    {ws.subscription?.validUntil || "N/A"}
                                  </span>
                                </div>
                              </td>

                              {/* Operational Status */}
                              <td className="px-6 py-4">
                                {(() => {
                                  const computedStatus = getWorkspaceStatus(ws);
                                  return (
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                        computedStatus === "Suspended"
                                          ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                                          : computedStatus === "Expired"
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                      }`}
                                    >
                                      {computedStatus}
                                    </span>
                                  );
                                })()}
                              </td>

                              {/* Edit triggers */}
                              <td className="px-6 py-4 text-right">
                                <Button
                                  onClick={() => {
                                    setEditWorkspaceId(ws.id);
                                    setEditCompanyName(ws.companyName);
                                    setEditSubscriptionTier(
                                      ws.subscription?.plan || "premium",
                                    );
                                    setEditExpiryDate(
                                      ws.subscription?.validUntil || "",
                                    );
                                    setEditIsActive(activeState);
                                    setEditError("");
                                    setEditSuccess("");
                                    setIsEditModalOpen(true);
                                  }}
                                  className="h-8 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 rounded-lg text-xs"
                                >
                                  <Edit3 className="size-3.5 mr-1" /> Edit
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: GLOBAL USER DIRECTORY ==================== */}
          {activeTab === "users" && (
            <div className="space-y-5">
              {/* Header block search */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-900/30 border border-zinc-850 p-4 rounded-xl backdrop-blur-md">
                <span className="text-xs text-zinc-400 font-semibold">
                  Real-time listing of all platform accounts and operator roles.
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  {/* Access Status Filter Selector */}
                  <div className="relative">
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-semibold outline-none cursor-pointer appearance-none pr-8 min-w-[120px]"
                      style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '14px' }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Search Query bar */}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-zinc-500 animate-pulse" />
                    <input
                      type="text"
                      placeholder="Search names, emails, roles..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto min-h-[250px]">
                  {loadingUsers ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-xs text-zinc-500 font-mono">
                      <RefreshCw className="size-5 animate-spin text-indigo-500" />
                      <span>Fetching operator directories...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-xs text-zinc-500 font-semibold">
                      <Users className="size-8 text-zinc-600 mb-1" />
                      <span>No registered user profiles matched query.</span>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-850 bg-zinc-900/10 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="px-6 py-4">User Profile</th>
                          <th className="px-6 py-4">Workspace ID Belonging</th>
                          <th className="px-6 py-4">System Role Override</th>
                          <th className="px-6 py-4">Access Status</th>
                          <th className="px-6 py-4 text-right">
                            Superadmin Control overrides
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/40 font-medium">
                        {filteredUsers.map((u) => {
                          const activeState = u.isActive !== false;
                          const isSelf = u.id === user?.uid;

                          return (
                            <tr
                              key={u.id}
                              className="hover:bg-zinc-900/20 transition-colors"
                            >
                              {/* Name / Email */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400 uppercase select-none">
                                    {u.name?.substring(0, 2) || "OP"}
                                  </div>
                                  <div>
                                    <span className="text-zinc-200 font-bold block text-xs">
                                      {u.name}{" "}
                                      {isSelf && (
                                        <span className="text-[9px] text-zinc-500 font-mono italic">
                                          (You)
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">
                                      {u.email}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Workspace Slug */}
                              <td className="px-6 py-4">
                                <code className="text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-850">
                                  {u.workspaceId || "Global Root"}
                                </code>
                              </td>

                              {/* Role Selector override dropdown */}
                              <td className="px-6 py-4">
                                {isSelf ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border bg-purple-500/10 border-purple-500/20 text-purple-400">
                                    {u.role || "superadmin"}
                                  </span>
                                ) : (
                                  <select
                                    value={u.role || "staff"}
                                    onChange={(e) =>
                                      handleUpdateUserRole(u.id, e.target.value)
                                    }
                                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 font-semibold outline-none cursor-pointer"
                                  >
                                    <option value="staff">
                                      Staff Operator
                                    </option>
                                    <option value="admin">Admin</option>
                                    <option value="superadmin">
                                      Super Admin
                                    </option>
                                  </select>
                                )}
                              </td>

                              {/* Status badge */}
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                    activeState
                                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                      : "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                                  }`}
                                >
                                  {activeState ? "Active" : "Suspended"}
                                </span>
                              </td>

                              {/* Toggle switch controls override */}
                              <td className="px-6 py-4 text-right">
                                {isSelf ? (
                                  <span className="text-[10px] text-zinc-600 font-mono italic">
                                    Protected Root
                                  </span>
                                ) : (
                                  <div className="flex justify-end items-center gap-2">
                                    <span className="text-[9px] text-zinc-500 font-bold uppercase font-mono mr-1">
                                      {activeState
                                        ? "Allow Access"
                                        : "Suspended"}
                                    </span>

                                    {/* Quick interactive Switch Toggle */}
                                    <button
                                      onClick={() =>
                                        handleToggleUserActive(
                                          u.id,
                                          activeState,
                                        )
                                      }
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                                        activeState
                                          ? "bg-indigo-600"
                                          : "bg-zinc-800"
                                      }`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                                          activeState
                                            ? "translate-x-4"
                                            : "translate-x-0"
                                        }`}
                                      />
                                    </button>
                                  </div>
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
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAL: PROVISION / CREATE NEW TENANT ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ambient Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]" />

            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Register New Tenant Workspace
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionWorkspace} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={createCompanyName}
                  onChange={(e) => setCreateCompanyName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Owner Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. administrator@acme.com"
                  value={createOwnerEmail}
                  onChange={(e) => setCreateOwnerEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Subscription Tier
                  </label>
                  <select
                    value={createSubscriptionTier}
                    onChange={(e) => setCreateSubscriptionTier(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-300 font-semibold outline-none cursor-pointer"
                  >
                    <option value="trial">Trial Play</option>
                    <option value="basic">Basic Tier</option>
                    <option value="premium">Premium Tier</option>
                    <option value="enterprise">Enterprise Tier</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Validity Expiration
                  </label>
                  <input
                    type="date"
                    required
                    value={createExpiryDate}
                    onChange={(e) => setCreateExpiryDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {createSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-[50%] bg-zinc-850 text-zinc-300 hover:bg-zinc-800 font-bold h-11 border-none text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingWorkspace}
                  className="w-[50%] bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl border-none shadow-lg text-xs"
                >
                  {submittingWorkspace ? (
                    <RefreshCw className="size-4 animate-spin mx-auto" />
                  ) : (
                    "Create Workspace"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT WORKSPACE MODAL ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />

            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Edit Workspace Configuration
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspaceEdit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-450">
                  Workspace ID
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={editWorkspaceId}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-3.5 py-2.5 text-xs text-zinc-500 outline-none select-all font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Company Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Subscription Tier
                  </label>
                  <select
                    value={editSubscriptionTier}
                    onChange={(e) => setEditSubscriptionTier(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-zinc-300 font-semibold outline-none cursor-pointer"
                  >
                    <option value="trial">Trial Play</option>
                    <option value="basic">Basic Tier</option>
                    <option value="premium">Premium Tier</option>
                    <option value="enterprise">Enterprise Tier</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Validity Expiration
                  </label>
                  <input
                    type="date"
                    required
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  />
                </div>
              </div>

              {/* Status Lock Switch */}
              <div className="bg-zinc-950/60 border border-zinc-850 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-1 pr-4">
                  <span className="text-xs font-bold text-white block">
                    Workspace Account Status
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Toggling this to suspended state locks out all workspace
                    accounts instantly globally.
                  </p>
                </div>

                {/* Switch button */}
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                    editIsActive ? "bg-indigo-600" : "bg-zinc-850"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                      editIsActive ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {editError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-[50%] bg-zinc-850 text-zinc-300 hover:bg-zinc-800 font-bold h-11 border-none text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEditWorkspace}
                  className="w-[50%] bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 rounded-xl border-none shadow-lg text-xs"
                >
                  {savingEditWorkspace ? (
                    <RefreshCw className="size-4 animate-spin mx-auto" />
                  ) : (
                    "Save Configurations"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: INVITATION LINK COPY CONFIRMATION ================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />

            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Onboarding Invitation Link
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs flex items-start gap-2.5">
                <CheckCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    Workspace Database Registers Formulated!
                  </span>
                  <p className="text-[11px] text-emerald-300/80 leading-relaxed mt-0.5">
                    We have successfully provisioned the new tenant workspace
                    documents and folders. Please send the following acceptance
                    token URL to the client.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 font-mono">
                  Invite Link URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono select-all outline-none"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteUrl);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2000);
                    }}
                    className={`px-3 border border-none ${
                      copiedInvite
                        ? "bg-emerald-600 hover:bg-emerald-500"
                        : "bg-indigo-600 hover:bg-indigo-500"
                    } text-white flex items-center justify-center transition-colors shrink-0`}
                  >
                    {copiedInvite ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white font-bold h-11 border-none"
                >
                  Dismiss Modals
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
