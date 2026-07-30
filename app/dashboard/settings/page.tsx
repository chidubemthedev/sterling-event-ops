"use client";

import React, { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { db } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Building,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard,
  User,
  Users,
  UserPlus,
  Copy,
  Check,
  Shield,
  RefreshCw,
  Sliders,
  Tag,
  QrCode,
  Layout,
  X,
  Plus,
  Trash2,
  ChevronRight,
  Sparkles,
  ToggleLeft,
  AlertTriangle,
} from "lucide-react";

interface WorkspaceConfig {
  companyName: string;
  supportEmail: string;
  contactPhone: string;
  address: string;
  categoryTags: string[];
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
}

export default function SettingsPage() {
  const { workspaceId, user } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<"profile" | "team" | "thermal">(
    "profile",
  );

  // Profile Form States
  const [companyName, setCompanyName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [subscription, setSubscription] = useState<any>(null);

  // Status indicators
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Team Directory States
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Invite Modal States
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Thermal/Asset Default States
  const [categories, setCategories] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsSuccess, setDefaultsSuccess] = useState("");

  // Current Operator authorization role
  const [currentUserRole, setCurrentUserRole] = useState("staff");

  // Load active user's role
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCurrentUserRole(snap.data().role || "staff");
      }
    });
  }, [user]);

  // 1. Fetch Workspace Profile & Defaults
  useEffect(() => {
    if (!workspaceId) return;

    const wsRef = doc(db, "workspaces", workspaceId);
    const unsubscribe = onSnapshot(wsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCompanyName(data.companyName || "");
        setSupportEmail(data.supportEmail || "");
        setContactPhone(data.contactPhone || "");
        setAddress(data.address || "");
        setSubscription(data.subscription || null);
        setCategories(
          data.categoryTags || [
            "Audio",
            "Lighting",
            "Furniture",
            "Staging",
            "Video",
          ],
        );
      }
    });

    return () => unsubscribe();
  }, [workspaceId]);

  // 2. Fetch Team Directory List
  useEffect(() => {
    if (!workspaceId) return;

    setLoadingTeam(true);
    const q = query(
      collection(db, "users"),
      where("workspaceId", "==", workspaceId),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: TeamMember[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as TeamMember);
        });
        setTeam(list);
        setLoadingTeam(false);
      },
      (err) => {
        console.error("Team loading failed:", err);
        setLoadingTeam(false);
      },
    );

    return () => unsubscribe();
  }, [workspaceId]);

  // Save profile submission
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    setSavingProfile(true);
    setProfileSuccess("");
    setProfileError("");

    try {
      const wsRef = doc(db, "workspaces", workspaceId);
      await setDoc(
        wsRef,
        {
          companyName: companyName.trim(),
          supportEmail: supportEmail.trim(),
          contactPhone: contactPhone.trim(),
          address: address.trim(),
        },
        { merge: true },
      );

      setProfileSuccess("Company profile successfully updated!");
    } catch (err: any) {
      console.error("Failed to save workspace profile:", err);
      setProfileError(
        err.message || "An unexpected error occurred saving configurations.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Process Invite Generation
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    if (!inviteName.trim() || !inviteEmail.trim()) {
      return;
    }

    setSendingInvite(true);

    try {
      // Secure crypto token or fallback
      const token = window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      const inviteRef = doc(db, "invites", token);
      await setDoc(inviteRef, {
        id: token,
        workspaceId: workspaceId,
        workspaceName: companyName || "Our Organization",
        ownerEmail: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        accepted: false,
        createdAt: new Date().toISOString(),
      });

      const inviteLink = `${window.location.origin}/accept-invite?token=${token}`;
      setGeneratedLink(inviteLink);
    } catch (err) {
      console.error("Failed to generate invite token:", err);
    } finally {
      setSendingInvite(false);
    }
  };

  // Toggle Account Status (Admin privilege action)
  const handleToggleActive = async (
    memberId: string,
    currentStatus: boolean,
  ) => {
    if (currentUserRole !== "admin" && currentUserRole !== "superadmin") return;
    try {
      const ref = doc(db, "users", memberId);
      await setDoc(ref, { isActive: !currentStatus }, { merge: true });
    } catch (err) {
      console.error("Failed to toggle member active state:", err);
    }
  };

  // Switch Member Role (Admin privilege action)
  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (currentUserRole !== "admin" && currentUserRole !== "superadmin") return;
    try {
      const ref = doc(db, "users", memberId);
      await setDoc(ref, { role: newRole }, { merge: true });
    } catch (err) {
      console.error("Failed to change member role:", err);
    }
  };

  // Add category tag
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const tag = newTagInput.trim();
    if (categories.includes(tag)) {
      setNewTagInput("");
      return;
    }
    setCategories([...categories, tag]);
    setNewTagInput("");
  };

  // Remove category tag
  const handleRemoveTag = (tagToRemove: string) => {
    setCategories(categories.filter((c) => c !== tagToRemove));
  };

  // Save inventory configuration defaults
  const handleSaveDefaults = async () => {
    if (!workspaceId) return;

    setSavingDefaults(true);
    setDefaultsSuccess("");

    try {
      const ref = doc(db, "workspaces", workspaceId);
      await setDoc(ref, { categoryTags: categories }, { merge: true });
      setDefaultsSuccess("Inventory category tags synchronized successfully!");
    } catch (err) {
      console.error("Failed to save inventory defaults:", err);
    } finally {
      setSavingDefaults(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isOperatorAdmin =
    currentUserRole === "admin" || currentUserRole === "superadmin";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-6">
        <div>
          <span className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-wider block">
            Workspace Configuration Center
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white font-heading mt-1">
            Workspace Administration Settings
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed">
            Manage company details, onboard warehouse crew, control platform
            accesses, and configure hardware QR properties.
          </p>
        </div>
      </div>

      {/* --- TAB CONTROL SEGMENTS --- */}
      <div className="flex border-b border-zinc-850 gap-2.5">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-5 py-3 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer ${
            activeTab === "profile"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Company Profile & Billing
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`px-5 py-3 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer ${
            activeTab === "team"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Team & Staff Directory
        </button>
        <button
          onClick={() => setActiveTab("thermal")}
          className={`px-5 py-3 text-xs font-bold font-sans border-b-2 transition-all cursor-pointer ${
            activeTab === "thermal"
              ? "border-indigo-500 text-white"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Thermal QR Label Defaults
        </button>
      </div>

      {/* --- CONTENT WINDOW OUTLET --- */}
      <div className="space-y-6">
        {/* ================= TAB 1: PROFILE & BILLING ================= */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column: Form */}
            <div className="lg:col-span-2 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-[-30px] left-[-30px] w-20 h-20 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />

              <div className="flex items-center gap-2.5 mb-6">
                <Building className="size-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-heading uppercase">
                  Company Identity Profiles
                </h3>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Organization / Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-colors"
                  />
                </div>

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Support Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Mail className="size-3.5 text-zinc-500" /> Support
                      Contact Email
                    </label>
                    <input
                      type="email"
                      required
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-colors"
                    />
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Phone className="size-3.5 text-zinc-500" /> Contact Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Warehouse Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-zinc-500" /> Address /
                    Primary Warehouse Location
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Error Banner */}
                {profileError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 animate-bounce" />
                    <span>{profileError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {profileSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                    <CheckCircle className="size-4 shrink-0 mt-0.5" />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                {/* Save button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 px-6 rounded-xl text-xs border-none cursor-pointer"
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                        Synchronizing profiles...
                      </>
                    ) : (
                      "Save Profile Preferences"
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Right Column: Billing View */}
            <div className="bg-zinc-900/30 border border-zinc-850 rounded-2xl p-6 backdrop-blur-md space-y-5 relative overflow-hidden">
              {/* Glow corner */}
              <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-purple-500/5 blur-xl pointer-events-none" />

              <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-850">
                <CreditCard className="size-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white font-heading uppercase">
                  Active License Subscription
                </h3>
              </div>

              {/* Status parameters */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                    Plan Tier
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white uppercase font-heading">
                      {subscription?.plan || "Premium SaaS"}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono">
                      {subscription?.isActive !== false
                        ? "Active License"
                        : "Suspended"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                    Expiration / Renewal Cycle
                  </span>
                  <span className="text-xs font-mono text-zinc-300 block font-semibold">
                    {subscription?.validUntil || "N/A"}
                  </span>
                </div>

                {/* Read only info block notice */}
                <div className="bg-indigo-500/5 border border-indigo-500/15 text-indigo-400 rounded-xl p-3.5 text-[11px] leading-relaxed flex gap-2">
                  <ShieldCheck className="size-4 shrink-0 mt-0.5 text-indigo-500" />
                  <span>
                    <strong>Administrative Notice:</strong> Subscription
                    licenses, payment tiers, and billing periods are locked and
                    managed solely by Sterling EventOps support.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: TEAM MANAGEMENT ================= */}
        {activeTab === "team" && (
          <div className="space-y-6">
            {/* Header controls block */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                  Team Roster Configuration
                </span>
                <h3 className="text-sm font-bold text-zinc-200 mt-0.5 font-heading">
                  Workspace Access Control List
                </h3>
              </div>

              <Button
                onClick={() => {
                  setGeneratedLink("");
                  setInviteName("");
                  setInviteEmail("");
                  setInviteRole("staff");
                  setInviteModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 px-4 rounded-xl text-xs border-none flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="size-4" />
                <span>Onboard Crew Member</span>
              </Button>
            </div>

            {/* Team Members List Table */}
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto min-h-[250px]">
                {loadingTeam ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2 text-xs text-zinc-500 font-mono">
                    <RefreshCw className="size-5 animate-spin text-indigo-500 mb-1" />
                    <span>Loading directory registry...</span>
                  </div>
                ) : team.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-xs text-zinc-500 font-semibold">
                    <Users className="size-8 text-zinc-600 mb-1" />
                    <span>No members registered in this workspace yet.</span>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-850 bg-zinc-900/10 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email Contact</th>
                        <th className="px-6 py-4">Platform Role</th>
                        <th className="px-6 py-4">Access Status</th>
                        {isOperatorAdmin && (
                          <th className="px-6 py-4 text-right">
                            Administrative Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40 font-medium">
                      {team.map((member) => {
                        const isSelf = member.id === user?.uid;
                        const activeState = member.isActive !== false;

                        return (
                          <tr
                            key={member.id}
                            className="hover:bg-zinc-900/20 transition-colors"
                          >
                            {/* Full Name */}
                            <td className="px-6 py-4 text-zinc-200">
                              <div className="flex items-center gap-2">
                                <div className="size-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10.5px] font-black text-indigo-400 uppercase select-none">
                                  {member.name?.substring(0, 2)}
                                </div>
                                <span className="font-bold">
                                  {member.name}{" "}
                                  {isSelf && (
                                    <span className="text-[9px] text-zinc-500 font-mono ml-1.5">
                                      (Self)
                                    </span>
                                  )}
                                </span>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                              {member.email}
                            </td>

                            {/* Role badge */}
                            <td className="px-6 py-4">
                              {isOperatorAdmin && !isSelf ? (
                                <select
                                  value={member.role || "staff"}
                                  onChange={(e) =>
                                    handleRoleChange(member.id, e.target.value)
                                  }
                                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-300 font-semibold outline-none cursor-pointer"
                                >
                                  <option value="staff">Staff Operator</option>
                                  <option value="admin">Admin</option>
                                </select>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                                    member.role === "admin" ||
                                    member.role === "superadmin"
                                      ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                                      : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                                  }`}
                                >
                                  {member.role || "Staff"}
                                </span>
                              )}
                            </td>

                            {/* Access status */}
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

                            {/* Administrative Toggles */}
                            {isOperatorAdmin && (
                              <td className="px-6 py-4 text-right">
                                {isSelf ? (
                                  <span className="text-[10px] text-zinc-600 font-mono italic">
                                    Self protected
                                  </span>
                                ) : (
                                  <div className="flex justify-end items-center gap-2">
                                    <span className="text-[9.5px] text-zinc-500 font-bold uppercase font-mono mr-1">
                                      {activeState
                                        ? "Allow Access"
                                        : "Suspended"}
                                    </span>

                                    {/* Quick interactive Switch Toggle */}
                                    <button
                                      onClick={() =>
                                        handleToggleActive(
                                          member.id,
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
                            )}
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

        {/* ================= TAB 3: THERMAL QR LABELS ================= */}
        {activeTab === "thermal" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start animate-in fade-in duration-200">
            {/* Custom category default lists */}
            <div className="lg:col-span-3 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 md:p-8 backdrop-blur-md space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-850">
                <Tag className="size-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white font-heading uppercase">
                    Inventory Category Tags
                  </h3>
                  <p className="text-[10.5px] text-zinc-500">
                    Configure global organizational groups for warehouse
                    products.
                  </p>
                </div>
              </div>

              {/* Tag Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">
                  Add New Category Tag
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Video, Rigging, Networking"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-white outline-none transition-colors"
                  />
                  <Button
                    onClick={handleAddTag}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-10 px-4 border-none flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              </div>

              {/* Tag badges map */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                  Active Category Tags ({categories.length})
                </span>
                <div className="flex flex-wrap gap-2 bg-zinc-950/60 border border-zinc-850 p-4 rounded-xl min-h-[80px]">
                  {categories.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 group hover:border-red-500/30 hover:text-red-400 transition-all select-none"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <X className="size-3 shrink-0" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Defaults synchronizer banner */}
              {defaultsSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs flex items-center gap-2">
                  <CheckCircle className="size-4 shrink-0" />
                  <span>{defaultsSuccess}</span>
                </div>
              )}

              {/* Action */}
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSaveDefaults}
                  disabled={savingDefaults}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 px-5 rounded-xl text-xs border-none cursor-pointer"
                >
                  {savingDefaults ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                      Saving preferences...
                    </>
                  ) : (
                    "Save Category Defaults"
                  )}
                </Button>
              </div>
            </div>

            {/* Dimensional qr thermal preview */}
            <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-850 rounded-2xl p-6 backdrop-blur-md space-y-5 relative overflow-hidden">
              <div className="absolute top-[-30px] right-[-30px] w-20 h-20 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />

              <div className="flex items-center gap-2.5 pb-4 border-b border-zinc-850">
                <QrCode className="size-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white font-heading uppercase">
                    Thermal Printer preview
                  </h3>
                  <p className="text-[10.5px] text-zinc-500">
                    Standard 50mm x 25mm label dimensions.
                  </p>
                </div>
              </div>

              {/* Real size bounding shell preview */}
              <div className="space-y-4">
                <span className="text-[10px] text-zinc-500 font-bold block uppercase tracking-wider">
                  Asset barcode sticker output
                </span>

                {/* sticker mockup */}
                <div className="flex items-center justify-center p-8 bg-zinc-950 rounded-xl border border-zinc-850">
                  <div className="w-[200px] h-[100px] bg-white text-black p-3.5 rounded flex items-center justify-between border-2 border-dashed border-zinc-400 relative shadow-2xl">
                    {/* Tiny info text left */}
                    <div className="flex flex-col justify-between h-full select-none">
                      <div>
                        <span className="text-[8px] font-black uppercase font-mono tracking-tight leading-none text-zinc-500 block">
                          {companyName || "STERLING EVENTOPS"}
                        </span>
                        <h4 className="text-[10px] font-black tracking-tight leading-snug mt-0.5 max-w-[110px] truncate">
                          Stage Audio Mic
                        </h4>
                      </div>

                      <div>
                        <span className="text-[7px] text-zinc-500 font-bold block leading-none">
                          ASSET ID / SKU
                        </span>
                        <span className="text-[8px] font-mono font-extrabold leading-none block mt-0.5">
                          SKU-STG-1049
                        </span>
                      </div>
                    </div>

                    {/* QR Code mockup right */}
                    <div className="size-14 border border-zinc-300 p-1 flex items-center justify-center bg-zinc-50 shrink-0">
                      <div className="size-full flex flex-wrap gap-[2px] items-center justify-center">
                        {/* Fake pixels of qr */}
                        {Array.from({ length: 16 }).map((_, i) => (
                          <div
                            key={i}
                            className={`size-2 shrink-0 ${
                              i % 3 === 0 ||
                              i === 4 ||
                              i === 7 ||
                              i === 11 ||
                              i === 15
                                ? "bg-black"
                                : "bg-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Edge dimensional indicators */}
                    <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 h-3 border-l border-zinc-400" />
                    <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[6px] font-bold text-zinc-400 rotate-90 leading-none">
                      25mm
                    </span>

                    <div className="absolute bottom-[-2px] left-1/2 -translate-x-1/2 w-6 border-b border-zinc-400" />
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[6px] font-bold text-zinc-400 leading-none">
                      50mm
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-950/60 border border-zinc-850 p-4 rounded-xl space-y-1.5 text-[11px] leading-relaxed text-zinc-400">
                  <p>
                    <strong>High-Definition Printing:</strong> Every generated
                    inventory record contains dynamic print endpoints optimized
                    for direct ZPL or PDF streaming to industrial thermal
                    barcode hardware.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= ONBOARDING / STAFF INVITATION DIALOG MODAL ================= */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top lightbar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">
                  Onboard Warehouse Staff
                </h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* If link generated, display the link and copy action */}
              {generatedLink ? (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 p-4 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="size-4 shrink-0 text-indigo-400" />
                      <span>Security Invitation Token Built!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Copy and send this unique onboarding invitation link to
                      the staff member. Clicking it will allow them to securely
                      register and activate their account.
                    </p>
                  </div>

                  {/* Copy Link field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                      Acceptance Invitation Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-[11px] text-zinc-300 outline-none select-all"
                      />
                      <Button
                        onClick={handleCopyLink}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-10 w-10 p-0 border-none shrink-0"
                      >
                        {copiedLink ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 flex gap-3">
                    <Button
                      onClick={() => setGeneratedLink("")}
                      className="w-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold h-11 border-none text-xs"
                    >
                      Onboard Another Member
                    </Button>
                    <Button
                      onClick={() => setInviteModalOpen(false)}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 border-none text-xs"
                    >
                      Finished Onboarding
                    </Button>
                  </div>
                </div>
              ) : (
                /* Otherwise display Form */
                <form onSubmit={handleGenerateInvite} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Staff Full Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Crew"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      Staff Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                    />
                  </div>

                  {/* Role Selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">
                      System Permission Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 font-semibold outline-none cursor-pointer"
                    >
                      <option value="staff">
                        Staff Operator (Warehouse & Audits)
                      </option>
                      <option value="admin">
                        Administrator (Inventory, Events, Settings)
                      </option>
                    </select>
                  </div>

                  {/* Submit */}
                  <div className="pt-4 border-t border-zinc-800 flex gap-3">
                    <Button
                      type="button"
                      onClick={() => setInviteModalOpen(false)}
                      className="w-full bg-zinc-850 text-zinc-300 hover:bg-zinc-800 font-bold h-11 border-none text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={sendingInvite}
                      className="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold h-11 rounded-xl border-none shadow-lg shadow-indigo-600/10 text-xs flex items-center justify-center gap-1"
                    >
                      {sendingInvite ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          Building credentials...
                        </>
                      ) : (
                        "Generate Invitation Link"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CheckCircleProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

function CheckCircle({ className, ...props }: CheckCircleProps) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
