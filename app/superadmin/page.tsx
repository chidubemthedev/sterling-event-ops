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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Building,
  Users,
  Calendar,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  X,
  Sparkles,
  Search,
  Lock,
  LogOut,
  RefreshCw,
  Copy,
  Check,
  Edit3,
  Activity,
  Shield,
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

const ITEMS_PER_PAGE = 10;

export default function SuperadminPage() {
  const { user, loading: authLoading } = useWorkspaceStore();
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [checkingClaims, setCheckingClaims] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"workspaces" | "users">(
    "workspaces"
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

  // Pagination State
  const [workspacePage, setWorkspacePage] = useState(1);
  const [userPage, setUserPage] = useState(1);

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

  // Reset pagination on filter or search changes
  useEffect(() => {
    setWorkspacePage(1);
  }, [workspaceSearch, planFilter, statusFilter]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userStatusFilter]);

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
      }
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
      }
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

  // 1. Provision / Onboard New Workspace Handler
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
      const generatedWorkspaceId = `${baseSlug || "workspace"}-${shortHash}`;

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
        `Workspace successfully provisioned! Ready to share onboarding link.`
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
      }, 1000);
    } catch (err: any) {
      console.error("Workspace provision error:", err);
      setCreateError(
        err.message || "Failed to provision workspace records."
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
        "Workspace company name and expiration date are required."
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
        { merge: true }
      );

      setEditSuccess("Workspace configuration updated successfully.");

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
    currentStatus: boolean
  ) => {
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { isActive: !currentStatus }, { merge: true });
    } catch (err) {
      console.error("Failed to toggle suspension status on user:", err);
    }
  };

  // 4. User Role Correction Action
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, { role: newRole }, { merge: true });
    } catch (err) {
      console.error("Failed to update user role:", err);
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
    ws: Workspace
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

  // Workspace Pagination Slices
  const totalWorkspacePages =
    Math.ceil(filteredWorkspaces.length / ITEMS_PER_PAGE) || 1;
  const paginatedWorkspaces = filteredWorkspaces.slice(
    (workspacePage - 1) * ITEMS_PER_PAGE,
    workspacePage * ITEMS_PER_PAGE
  );
  const workspaceStart =
    filteredWorkspaces.length === 0
      ? 0
      : (workspacePage - 1) * ITEMS_PER_PAGE + 1;
  const workspaceEnd = Math.min(
    workspacePage * ITEMS_PER_PAGE,
    filteredWorkspaces.length
  );

  // User Pagination Slices
  const totalUserPages =
    Math.ceil(filteredUsers.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * ITEMS_PER_PAGE,
    userPage * ITEMS_PER_PAGE
  );
  const userStart =
    filteredUsers.length === 0 ? 0 : (userPage - 1) * ITEMS_PER_PAGE + 1;
  const userEnd = Math.min(
    userPage * ITEMS_PER_PAGE,
    filteredUsers.length
  );

  // Security authorization waiting block
  if (authLoading || checkingClaims) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f6f1e5] text-neutral-900 z-50">
        <div className="size-12 rounded-full border-3 border-[#800080]/20 border-t-[#800080] animate-spin" />
        <p className="mt-6 text-sm font-semibold tracking-wide text-neutral-600 animate-pulse">
          Authenticating Platform Credentials...
        </p>
      </div>
    );
  }

  // Access Denied screen
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f6f1e5] p-4">
        <div className="max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl p-8 text-center shadow-sm relative">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto mb-5">
            <Lock className="size-7" />
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 mb-3 uppercase tracking-wider">
            Restricted System Directory
          </span>

          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 mb-2">
            Super Admin Access Required
          </h2>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6">
            Your current account credentials do not possess authorized super admin
            privileges. Access to this platform governance console is restricted.
          </p>

          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11 rounded-xl font-medium"
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
    (ws) => ws.subscription?.isActive && getWorkspaceStatus(ws) === "Active"
  ).length;
  const totalUsers = globalUsers.length;
  const suspendedUsers = globalUsers.filter((u) => u.isActive === false).length;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-neutral-900 flex flex-col font-sans">
      {/* TOP HEADER NAVIGATION */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-200/80 px-6 sm:px-8 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="size-9 rounded-xl bg-[#220022] text-[#ffd700] font-bold flex items-center justify-center border border-white/10 shadow-xs">
            SE
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-neutral-900 uppercase leading-none">
              Sterling EventOps
            </h1>
            <span className="text-[11px] text-neutral-500 font-medium">
              Platform Governance Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-purple-50 text-[#800080] text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-200">
            <Shield className="size-3.5 text-[#800080]" />
            <span>{user?.email}</span>
          </div>

          <Button
            onClick={handleSignOut}
            variant="outline"
            size="sm"
            className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-xs font-medium h-9 px-3.5"
          >
            <LogOut className="size-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-8 py-8 space-y-8">
        {/* MASTER HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
          <div>
            <Badge
              variant="outline"
              className="bg-purple-50 text-[#800080] border-purple-200 text-[11px] font-semibold uppercase tracking-wider mb-2 px-2.5 py-0.5 rounded-full"
            >
              PLATFORM GOVERNANCE
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              Super Admin Command Center
            </h2>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed max-w-2xl">
              Manage client workspaces, subscription lifecycles, and user access
              across all accounts.
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
            className="bg-[#800080] hover:bg-[#660066] text-white font-medium h-11 px-5 rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-colors shrink-0"
          >
            <Plus className="size-4" />
            <span>Onboard New Workspace</span>
          </Button>
        </div>

        {/* METRIC SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Total Workspaces */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Total Workspaces
              </span>
              <h3 className="text-3xl font-bold text-neutral-900">
                {totalWorkspaces}
              </h3>
            </div>
            <div className="size-11 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center shrink-0 border border-purple-100">
              <Building className="size-5" />
            </div>
          </div>

          {/* Active Subscriptions */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Active Subscriptions
              </span>
              <h3 className="text-3xl font-bold text-emerald-600">
                {activeSubs}
              </h3>
            </div>
            <div className="size-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Activity className="size-5" />
            </div>
          </div>

          {/* Platform Users */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Platform Users
              </span>
              <h3 className="text-3xl font-bold text-neutral-900">
                {totalUsers}
              </h3>
            </div>
            <div className="size-11 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center shrink-0 border border-purple-100">
              <Users className="size-5" />
            </div>
          </div>

          {/* Suspended Accounts */}
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Suspended Accounts
              </span>
              <h3 className="text-3xl font-bold text-rose-600">
                {suspendedUsers}
              </h3>
            </div>
            <div className="size-11 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
              <ShieldAlert className="size-5" />
            </div>
          </div>
        </div>

        {/* TAB SWITCH HEADERS */}
        <div className="flex border-b border-neutral-200/80 gap-6">
          <button
            onClick={() => setActiveTab("workspaces")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "workspaces"
                ? "border-[#800080] text-[#800080]"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Client Workspaces ({totalWorkspaces})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "users"
                ? "border-[#800080] text-[#800080]"
                : "border-transparent text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Global User Registries ({totalUsers})
          </button>
        </div>

        {/* TAB INTERFACES WINDOW */}
        <div className="space-y-6">
          {/* ==================== TAB 1: WORKSPACE MANAGEMENT ==================== */}
          {activeTab === "workspaces" && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-neutral-200/80 p-4 rounded-xl shadow-xs">
                <span className="text-xs text-neutral-600 font-medium">
                  Overview of all registered client organizations and current access states.
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  {/* Subscription Plan Filter Selector */}
                  <div className="relative">
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-700 font-medium outline-none cursor-pointer appearance-none pr-8 min-w-[130px] focus:border-[#800080] transition-colors shadow-xs"
                      style={{
                        backgroundImage:
                          "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 10px center",
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
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-700 font-medium outline-none cursor-pointer appearance-none pr-8 min-w-[130px] focus:border-[#800080] transition-colors shadow-xs"
                      style={{
                        backgroundImage:
                          "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 10px center",
                        backgroundSize: "14px",
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Search Query Input */}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                    <Input
                      type="text"
                      placeholder="Search company, ID, owner..."
                      value={workspaceSearch}
                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-[#800080] focus-visible:border-[#800080] shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Workspaces Table Container */}
              <div className="overflow-x-auto bg-white border border-neutral-200/80 rounded-xl shadow-sm">
                <div className="min-h-[250px]">
                  {loadingWorkspaces ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-xs text-neutral-500">
                      <RefreshCw className="size-5 animate-spin text-[#800080]" />
                      <span>Fetching workspace directories...</span>
                    </div>
                  ) : filteredWorkspaces.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-xs text-neutral-500 font-medium">
                      <Building className="size-8 text-neutral-400 mb-2" />
                      <span>No workspaces matched query filters.</span>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="sticky top-0 bg-neutral-50/90 backdrop-blur-sm z-10 border-b border-neutral-200 text-neutral-600 uppercase text-xs font-semibold">
                        <TableRow className="border-b border-neutral-200/80">
                          <TableHead className="px-6 py-3.5">Company Details</TableHead>
                          <TableHead className="px-6 py-3.5">Workspace ID</TableHead>
                          <TableHead className="px-6 py-3.5">Subscription Plan</TableHead>
                          <TableHead className="px-6 py-3.5">Expiration Date</TableHead>
                          <TableHead className="px-6 py-3.5">Status</TableHead>
                          <TableHead className="px-6 py-3.5 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-neutral-100 text-xs font-medium">
                        {paginatedWorkspaces.map((ws) => {
                          const activeState =
                            ws.subscription?.isActive !== false;
                          const computedStatus = getWorkspaceStatus(ws);

                          return (
                            <TableRow
                              key={ws.id}
                              className="hover:bg-neutral-50/60 transition-colors"
                            >
                              {/* Company Name / Email */}
                              <TableCell className="px-6 py-4">
                                <div className="space-y-0.5">
                                  <span className="text-neutral-900 font-semibold block text-sm">
                                    {ws.companyName}
                                  </span>
                                  <span className="text-xs text-neutral-500 block font-mono">
                                    {ws.ownerEmail}
                                  </span>
                                </div>
                              </TableCell>

                              {/* Workspace ID */}
                              <TableCell className="px-6 py-4">
                                <code className="text-xs font-mono text-neutral-600 bg-neutral-100 px-2 py-1 rounded border border-neutral-200">
                                  {ws.id}
                                </code>
                              </TableCell>

                              {/* Plan Tier Badge */}
                              <TableCell className="px-6 py-4">
                                <Badge
                                  variant="outline"
                                  className={`capitalize text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                    ws.subscription?.plan === "enterprise"
                                      ? "bg-purple-50 border-purple-200 text-[#800080]"
                                      : ws.subscription?.plan === "premium"
                                        ? "bg-amber-50 border-amber-200 text-amber-800"
                                        : "bg-neutral-100 border-neutral-200 text-neutral-700"
                                  }`}
                                >
                                  {ws.subscription?.plan || "Premium"}
                                </Badge>
                              </TableCell>

                              {/* Expiration date */}
                              <TableCell className="px-6 py-4 text-neutral-600 text-xs">
                                <div className="flex items-center gap-1.5 font-mono">
                                  <Calendar className="size-3.5 text-neutral-400" />
                                  <span>
                                    {ws.subscription?.validUntil || "N/A"}
                                  </span>
                                </div>
                              </TableCell>

                              {/* Operational Status */}
                              <TableCell className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                    computedStatus === "Suspended"
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : computedStatus === "Expired"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {computedStatus}
                                </span>
                              </TableCell>

                              {/* Edit triggers */}
                              <TableCell className="px-6 py-4 text-right">
                                <Button
                                  onClick={() => {
                                    setEditWorkspaceId(ws.id);
                                    setEditCompanyName(ws.companyName);
                                    setEditSubscriptionTier(
                                      ws.subscription?.plan || "premium"
                                    );
                                    setEditExpiryDate(
                                      ws.subscription?.validUntil || ""
                                    );
                                    setEditIsActive(activeState);
                                    setEditError("");
                                    setEditSuccess("");
                                    setIsEditModalOpen(true);
                                  }}
                                  variant="outline"
                                  className="h-8 border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-lg text-xs font-medium px-3"
                                >
                                  <Edit3 className="size-3.5 mr-1" /> Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination Footer Bar */}
                {!loadingWorkspaces && filteredWorkspaces.length > 0 && (
                  <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 bg-white rounded-b-xl text-xs text-neutral-500">
                    <div>
                      Showing {workspaceStart}–{workspaceEnd} of{" "}
                      {filteredWorkspaces.length} workspaces
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setWorkspacePage((p) => Math.max(1, p - 1))
                        }
                        disabled={workspacePage === 1}
                        className="h-8 border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs px-3 rounded-lg"
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium text-neutral-600 px-2">
                        Page {workspacePage} of {totalWorkspacePages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setWorkspacePage((p) =>
                            Math.min(totalWorkspacePages, p + 1)
                          )
                        }
                        disabled={
                          workspacePage === totalWorkspacePages ||
                          filteredWorkspaces.length === 0
                        }
                        className="h-8 border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs px-3 rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== TAB 2: GLOBAL USER DIRECTORY ==================== */}
          {activeTab === "users" && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-neutral-200/80 p-4 rounded-xl shadow-xs">
                <span className="text-xs text-neutral-600 font-medium">
                  Overview of all registered user profiles and system access permissions.
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  {/* Access Status Filter Selector */}
                  <div className="relative">
                    <select
                      value={userStatusFilter}
                      onChange={(e) => setUserStatusFilter(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-700 font-medium outline-none cursor-pointer appearance-none pr-8 min-w-[130px] focus:border-[#800080] transition-colors shadow-xs"
                      style={{
                        backgroundImage:
                          "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23737373%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 10px center",
                        backgroundSize: "14px",
                      }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>

                  {/* Search Query Input */}
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                    <Input
                      type="text"
                      placeholder="Search names, emails, roles..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl py-2 pl-9 pr-4 text-xs text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-[#800080] focus-visible:border-[#800080] shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Users Table Container */}
              <div className="overflow-x-auto bg-white border border-neutral-200/80 rounded-xl shadow-sm">
                <div className="min-h-[250px]">
                  {loadingUsers ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2 text-xs text-neutral-500">
                      <RefreshCw className="size-5 animate-spin text-[#800080]" />
                      <span>Fetching platform users...</span>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-xs text-neutral-500 font-medium">
                      <Users className="size-8 text-neutral-400 mb-2" />
                      <span>No user accounts matched query filters.</span>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="sticky top-0 bg-neutral-50/90 backdrop-blur-sm z-10 border-b border-neutral-200 text-neutral-600 uppercase text-xs font-semibold">
                        <TableRow className="border-b border-neutral-200/80">
                          <TableHead className="px-6 py-3.5">User Profile</TableHead>
                          <TableHead className="px-6 py-3.5">Workspace Affiliation</TableHead>
                          <TableHead className="px-6 py-3.5">Assigned Role</TableHead>
                          <TableHead className="px-6 py-3.5">Access Status</TableHead>
                          <TableHead className="px-6 py-3.5 text-right">Account Controls</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-neutral-100 text-xs font-medium">
                        {paginatedUsers.map((u) => {
                          const activeState = u.isActive !== false;
                          const isSelf = u.id === user?.uid;

                          return (
                            <TableRow
                              key={u.id}
                              className="hover:bg-neutral-50/60 transition-colors"
                            >
                              {/* Name / Email */}
                              <TableCell className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="size-8 rounded-full bg-purple-50 text-[#800080] border border-purple-200 flex items-center justify-center text-xs font-bold uppercase select-none">
                                    {u.name?.substring(0, 2) || "U"}
                                  </div>
                                  <div>
                                    <span className="text-neutral-900 font-semibold block text-sm">
                                      {u.name || "Unnamed User"}{" "}
                                      {isSelf && (
                                        <span className="text-[10px] text-neutral-400 font-normal">
                                          (You)
                                        </span>
                                      )}
                                    </span>
                                    <span className="text-xs text-neutral-500 block font-mono">
                                      {u.email}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Workspace Slug */}
                              <TableCell className="px-6 py-4">
                                <code className="text-xs font-mono text-neutral-600 bg-neutral-100 px-2 py-1 rounded border border-neutral-200">
                                  {u.workspaceId || "Global Root"}
                                </code>
                              </TableCell>

                              {/* Role Selector override dropdown */}
                              <TableCell className="px-6 py-4">
                                {isSelf ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-purple-50 border-purple-200 text-[#800080] font-semibold text-xs px-2.5 py-0.5 rounded-full"
                                  >
                                    {u.role || "superadmin"}
                                  </Badge>
                                ) : (
                                  <select
                                    value={u.role || "staff"}
                                    onChange={(e) =>
                                      handleUpdateUserRole(u.id, e.target.value)
                                    }
                                    className="bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-700 font-medium outline-none cursor-pointer focus:border-[#800080]"
                                  >
                                    <option value="staff">Staff Operator</option>
                                    <option value="admin">Admin</option>
                                    <option value="superadmin">Super Admin</option>
                                  </select>
                                )}
                              </TableCell>

                              {/* Status badge */}
                              <TableCell className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                    activeState
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border-rose-200"
                                  }`}
                                >
                                  {activeState ? "Active" : "Suspended"}
                                </span>
                              </TableCell>

                              {/* Toggle switch controls */}
                              <TableCell className="px-6 py-4 text-right">
                                {isSelf ? (
                                  <span className="text-xs text-neutral-400 italic">
                                    Protected Account
                                  </span>
                                ) : (
                                  <div className="flex justify-end items-center gap-2.5">
                                    <span className="text-xs text-neutral-500 font-medium">
                                      {activeState ? "Allow Access" : "Suspended"}
                                    </span>

                                    {/* Toggle Switch */}
                                    <button
                                      onClick={() =>
                                        handleToggleUserActive(
                                          u.id,
                                          activeState
                                        )
                                      }
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                                        activeState
                                          ? "bg-[#800080]"
                                          : "bg-neutral-300"
                                      }`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                                          activeState
                                            ? "translate-x-4"
                                            : "translate-x-0"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Pagination Footer Bar */}
                {!loadingUsers && filteredUsers.length > 0 && (
                  <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-4 bg-white rounded-b-xl text-xs text-neutral-500">
                    <div>
                      Showing {userStart}–{userEnd} of {filteredUsers.length}{" "}
                      users
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                        disabled={userPage === 1}
                        className="h-8 border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs px-3 rounded-lg"
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium text-neutral-600 px-2">
                        Page {userPage} of {totalUserPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setUserPage((p) => Math.min(totalUserPages, p + 1))
                        }
                        disabled={
                          userPage === totalUserPages ||
                          filteredUsers.length === 0
                        }
                        className="h-8 border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs px-3 rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAL: ONBOARD NEW WORKSPACE ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center">
                  <Building className="size-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Onboard New Workspace
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionWorkspace} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-xs font-semibold text-neutral-700">
                  Company / Organization Name
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  required
                  placeholder="e.g. Sterling Premier Events"
                  value={createCompanyName}
                  onChange={(e) => setCreateCompanyName(e.target.value)}
                  className="bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-[#800080] focus-visible:border-[#800080] h-11 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ownerEmail" className="text-xs font-semibold text-neutral-700">
                  Owner Email Address
                </Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  required
                  placeholder="e.g. director@events.com"
                  value={createOwnerEmail}
                  onChange={(e) => setCreateOwnerEmail(e.target.value)}
                  className="bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-[#800080] focus-visible:border-[#800080] h-11 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="subscriptionPlan" className="text-xs font-semibold text-neutral-700">
                    Subscription Tier
                  </Label>
                  <select
                    id="subscriptionPlan"
                    value={createSubscriptionTier}
                    onChange={(e) => setCreateSubscriptionTier(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-700 font-medium outline-none cursor-pointer focus:border-[#800080] h-11"
                  >
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiryDate" className="text-xs font-semibold text-neutral-700">
                    Expiration Date
                  </Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    required
                    value={createExpiryDate}
                    onChange={(e) => setCreateExpiryDate(e.target.value)}
                    className="bg-white border-neutral-200 text-neutral-900 focus-visible:ring-[#800080] focus-visible:border-[#800080] h-11 rounded-xl text-xs cursor-pointer"
                  />
                </div>
              </div>

              {createError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {createSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}

              <div className="pt-3 flex gap-3 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-1/2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11 rounded-xl text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submittingWorkspace}
                  className="w-1/2 bg-[#800080] hover:bg-[#660066] text-white font-medium h-11 rounded-xl shadow-xs text-xs transition-colors cursor-pointer"
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

      {/* ================= MODAL: EDIT WORKSPACE CONFIGURATION ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center">
                  <Building className="size-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Edit Workspace Configuration
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkspaceEdit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-500">
                  Workspace ID
                </Label>
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={editWorkspaceId}
                  className="bg-neutral-50 border-neutral-200 text-neutral-500 h-11 rounded-xl text-xs font-mono select-all cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="editCompanyName" className="text-xs font-semibold text-neutral-700">
                  Company / Organization Name
                </Label>
                <Input
                  id="editCompanyName"
                  type="text"
                  required
                  placeholder="e.g. Sterling Premier Events"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="bg-white border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-[#800080] focus-visible:border-[#800080] h-11 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="editPlan" className="text-xs font-semibold text-neutral-700">
                    Subscription Tier
                  </Label>
                  <select
                    id="editPlan"
                    value={editSubscriptionTier}
                    onChange={(e) => setEditSubscriptionTier(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-700 font-medium outline-none cursor-pointer focus:border-[#800080] h-11"
                  >
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="editExpiry" className="text-xs font-semibold text-neutral-700">
                    Expiration Date
                  </Label>
                  <Input
                    id="editExpiry"
                    type="date"
                    required
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="bg-white border-neutral-200 text-neutral-900 focus-visible:ring-[#800080] focus-visible:border-[#800080] h-11 rounded-xl text-xs cursor-pointer"
                  />
                </div>
              </div>

              {/* Status Lock Switch */}
              <div className="bg-neutral-50 border border-neutral-200/80 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-bold text-neutral-900 block">
                    Workspace Account Access
                  </span>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Setting this to suspended immediately restricts access for all users in this workspace.
                  </p>
                </div>

                {/* Switch button */}
                <button
                  type="button"
                  onClick={() => setEditIsActive(!editIsActive)}
                  className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 outline-none ${
                    editIsActive ? "bg-[#800080]" : "bg-neutral-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                      editIsActive ? "translate-x-4.5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {editError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {editSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              <div className="pt-3 flex gap-3 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11 rounded-xl text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEditWorkspace}
                  className="w-1/2 bg-[#800080] hover:bg-[#660066] text-white font-medium h-11 rounded-xl shadow-xs text-xs transition-colors cursor-pointer"
                >
                  {savingEditWorkspace ? (
                    <RefreshCw className="size-4 animate-spin mx-auto" />
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: INVITATION LINK COPY CONFIRMATION ================= */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/40 animate-in fade-in">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">
                  Onboarding Invitation Link
                </h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-start gap-2.5">
                <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <span className="font-bold block">
                    Workspace Successfully Provisioned!
                  </span>
                  <p className="text-[11px] text-emerald-700 leading-relaxed mt-0.5">
                    Share the invitation link below with the workspace administrator to allow them to complete onboarding.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">
                  Invite Link URL
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="flex-1 bg-neutral-50 border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-700 font-mono select-all h-11"
                  />
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteUrl);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2000);
                    }}
                    className={`h-11 px-4 rounded-xl transition-colors shrink-0 ${
                      copiedInvite
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-[#800080] hover:bg-[#660066] text-white"
                    }`}
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
                  variant="outline"
                  className="w-full border-neutral-200 text-neutral-700 hover:bg-neutral-50 h-11 rounded-xl text-xs font-medium"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
