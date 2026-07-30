"use client";

import React, { useEffect, useState } from "react";
import { collection, onSnapshot, doc, setDoc, query, orderBy } from "firebase/firestore";
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
  Check
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
  virtualFolders: {
    warehouse: string;
    active_events: string;
    archived_events: string;
    quarantine: string;
  };
  createdAt: string;
}

export default function SuperadminPage() {
  const { user, loading: authLoading } = useWorkspaceStore();
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [checkingClaims, setCheckingClaims] = useState(true);

  // Real-time workspaces list
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Invitation Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  
  // Form State
  const [companyName, setCompanyName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [subscriptionTier, setSubscriptionTier] = useState("premium");
  const [expiryDate, setExpiryDate] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Check custom claims & developer bypass
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
        
        // Allowed if custom claim "role" is superadmin OR email is chukwudubem7@gmail.com
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

  // Subscribe to workspaces collection
  useEffect(() => {
    if (!isSuperadmin) return;

    const q = query(collection(db, "workspaces"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Workspace[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Workspace);
      });
      setWorkspaces(list);
      setLoadingWorkspaces(false);
    }, (err) => {
      console.error("Error loading workspaces:", err);
      setLoadingWorkspaces(false);
    });

    return () => unsubscribe();
  }, [isSuperadmin]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  // Create Workspace Submit Handler
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!companyName.trim() || !ownerEmail.trim() || !expiryDate) {
      setFormError("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Generate unique slugified workspace ID
      const baseSlug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const shortHash = Math.floor(1000 + Math.random() * 9000);
      const generatedWorkspaceId = `${baseSlug || "tenant"}-${shortHash}`;

      // 2. Initialize new document
      const workspaceRef = doc(db, "workspaces", generatedWorkspaceId);
      const newWorkspace: Workspace = {
        id: generatedWorkspaceId,
        companyName: companyName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        subscription: {
          isActive: true,
          plan: subscriptionTier,
          validUntil: expiryDate,
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

      // 3. Generate unique invite token and write to invites collection
      const inviteToken = typeof window !== "undefined" && window.crypto && window.crypto.randomUUID 
        ? window.crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

      const inviteRef = doc(db, "invites", inviteToken);
      await setDoc(inviteRef, {
        id: inviteToken,
        workspaceId: generatedWorkspaceId,
        workspaceName: companyName.trim(),
        ownerEmail: ownerEmail.trim().toLowerCase(),
        role: "admin",
        accepted: false,
        createdAt: new Date().toISOString(),
      });

      setFormSuccess(`Successfully registered workspace and created invite!`);
      
      // Construct acceptance link
      const inviteUrl = `${window.location.origin}/accept-invite?token=${inviteToken}`;
      setGeneratedInviteUrl(inviteUrl);
      
      // Reset form
      setCompanyName("");
      setOwnerEmail("");
      setSubscriptionTier("premium");
      setExpiryDate("");
      
      // Close creation modal and open invite links modal
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess("");
        setIsInviteModalOpen(true);
      }, 1000);

    } catch (err: any) {
      console.error("Workspace generation error:", err);
      setFormError(err.message || "An error occurred while creating the workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter workspaces based on search
  const filteredWorkspaces = workspaces.filter(ws => 
    ws.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading indicator for authorization checks
  if (authLoading || checkingClaims) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Verifying Security Access...
        </p>
      </div>
    );
  }

  // Blocking screen if unauthorized
  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        {/* Glow effect background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-red-500/10 blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-md relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500" />
          
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto mb-6">
            <Lock className="size-8 animate-pulse" />
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 mb-4 uppercase tracking-wide">
            Restricted System Directory
          </span>

          <h2 className="text-xl font-bold tracking-tight text-white font-heading mb-3">
            Superadmin Cockpit Locked
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            Your current account credentials do not possess custom superadmin claims. Access is securely blocked.
          </p>

          <div className="flex flex-col gap-3">
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
      </div>
    );
  }

  // Stats calculation
  const totalWorkspaces = workspaces.length;
  const activeSubs = workspaces.filter(ws => ws.subscription?.isActive).length;
  const enterpriseSubs = workspaces.filter(ws => ws.subscription?.plan === "enterprise").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-x-hidden">
      {/* Visual glowing meshes */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black">
            SF
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white font-heading uppercase">
              Sterling Ops Console
            </h1>
            <span className="text-[10px] text-zinc-400 font-mono">Platform Admin Engine</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-semibold text-zinc-200">{user?.email}</span>
            <span className="text-[9px] text-emerald-400 font-mono font-medium">Bypass Admin Active</span>
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

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 z-10 relative">
        
        {/* WELCOME BLOCK */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white font-heading">
              Platform Administration Cockpit
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Initialize new multi-tenant domains, track global workspace logs, and manage organizational virtual operational folder states.
            </p>
          </div>
          <Button 
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-90 shadow-lg shadow-indigo-600/15 h-11"
          >
            <Plus className="size-4 mr-2" />
            Generate Workspace
          </Button>
        </div>

        {/* METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* STAT 1 */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-medium">Total Workspaces</span>
              <h3 className="text-3xl font-black font-heading tracking-tight text-white">
                {totalWorkspaces}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Building className="size-5" />
            </div>
          </div>

          {/* STAT 2 */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-medium">Active Tenants</span>
              <h3 className="text-3xl font-black font-heading tracking-tight text-emerald-400">
                {activeSubs}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="size-5 animate-pulse" />
            </div>
          </div>

          {/* STAT 3 */}
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-zinc-400 font-medium">Enterprise Licenses</span>
              <h3 className="text-3xl font-black font-heading tracking-tight text-cyan-400">
                {enterpriseSubs}
              </h3>
            </div>
            <div className="w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Tag className="size-5" />
            </div>
          </div>
        </div>

        {/* ACTIVE WORKSPACES SECTION */}
        <div className="bg-zinc-900/20 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
          {/* Section Header with Search */}
          <div className="px-6 py-4 border-b border-zinc-800/60 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white font-heading">
                Active Tenant Registries
              </h3>
            </div>
            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Search workspaces..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-9 pr-4 text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto min-h-[250px]">
            {loadingWorkspaces ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
                <RefreshCw className="size-6 animate-spin text-indigo-500" />
                <span>Loading active registrations...</span>
              </div>
            ) : filteredWorkspaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-500 text-sm gap-2">
                <Building className="size-8 text-zinc-600 mb-1" />
                <span>No tenant registries matched your query.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800/60 bg-zinc-900/10 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3.5">Company / Workspace ID</th>
                    <th className="px-6 py-3.5">Owner Contact</th>
                    <th className="px-6 py-3.5">Tier</th>
                    <th className="px-6 py-3.5">Valid Until</th>
                    <th className="px-6 py-3.5">Virtual Folder Registries</th>
                    <th className="px-6 py-3.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {filteredWorkspaces.map((ws) => (
                    <tr key={ws.id} className="hover:bg-zinc-900/30 transition-colors duration-150">
                      {/* Name / ID */}
                      <td className="px-6 py-4 space-y-1">
                        <span className="font-bold text-white text-sm block">
                          {ws.companyName}
                        </span>
                        <code className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-900">
                          {ws.id}
                        </code>
                      </td>

                      {/* Owner email */}
                      <td className="px-6 py-4 text-zinc-300 font-medium">
                        {ws.ownerEmail}
                      </td>

                      {/* Tier badge */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                          ws.subscription?.plan === "enterprise" 
                            ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                            : ws.subscription?.plan === "premium"
                            ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                            : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                        }`}>
                          {ws.subscription?.plan}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-zinc-500" />
                          <span>{ws.subscription?.validUntil}</span>
                        </div>
                      </td>

                      {/* Virtual Folders */}
                      <td className="px-6 py-4 space-y-1 text-[10px]">
                        <div className="flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded font-mono">
                            📁 warehouse
                          </span>
                          <span className="px-1.5 py-0.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded font-mono">
                            📁 active_events
                          </span>
                          <span className="px-1.5 py-0.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded font-mono">
                            📁 archived_events
                          </span>
                          <span className="px-1.5 py-0.5 bg-zinc-950 text-zinc-400 border border-zinc-900 rounded font-mono">
                            📁 quarantine
                          </span>
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                          ws.subscription?.isActive ? "text-emerald-400" : "text-red-400"
                        }`}>
                          <span className={`size-1.5 rounded-full ${ws.subscription?.isActive ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                          {ws.subscription?.isActive ? "Active" : "Suspended"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* GENERATE WORKSPACE GLASSMORPHIC MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          {/* Modal Card */}
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ambient Accent Line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]" />

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Register New Tenant Workspace
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateWorkspace} className="p-6 space-y-4">
              
              {/* Company Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Building className="size-3.5 text-zinc-500" />
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Acme Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Owner Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-zinc-500" />
                  Owner Email <span className="text-red-400">*</span>
                </label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. administrator@acme.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Subscription Tier & Validity Date Picker */}
              <div className="grid grid-cols-2 gap-4">
                {/* Subscription Tier */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Tag className="size-3.5 text-zinc-500" />
                    Subscription Tier
                  </label>
                  <select 
                    value={subscriptionTier}
                    onChange={(e) => setSubscriptionTier(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                    style={{ backgroundImage: "url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px' }}
                  >
                    <option value="basic">Basic</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Expiration Calendar Picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-zinc-500" />
                    Validity Expiration <span className="text-red-400">*</span>
                  </label>
                  <input 
                    type="date" 
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                  />
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
                  <CheckCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
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
                    <>
                      <RefreshCw className="size-4 mr-2 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>
                      Create Workspace
                      <ArrowRight className="size-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* INVITATION GENERATED MODAL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Accent light bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />

            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Workspace Invitation Link
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
                  <span className="font-bold block">Workspace Provisioned Successfully!</span>
                  <p className="text-[11px] text-emerald-300/80 leading-relaxed mt-0.5">
                    We have successfully initialized the new tenant workspace database registries and virtual directories. Please copy and send the link below to the client to complete their onboarding profile setup.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 font-mono">Acceptance Onboarding Link</label>
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
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`px-3 border border-none ${
                      copied 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                        : "bg-indigo-600 hover:bg-indigo-500 text-white"
                    } flex items-center justify-center transition-colors shrink-0`}
                  >
                    {copied ? (
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
                  Dismiss Cockpit
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
