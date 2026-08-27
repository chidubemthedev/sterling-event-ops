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
  setDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import {
  Building,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  CreditCard,
  Users,
  UserPlus,
  Copy,
  Check,
  RefreshCw,
  Tag,
  QrCode,
  X,
  Plus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ShieldAlert,
} from "lucide-react";

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

  // Thermal / Asset Default States
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
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setCurrentUserRole(snap.data().role || "staff");
      }
    });
    return () => unsubscribe();
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

      setProfileSuccess("Company profile details successfully saved!");
      setTimeout(() => setProfileSuccess(""), 4000);
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
    if (
      currentUserRole !== "admin" &&
      currentUserRole !== "superadmin" &&
      user?.email !== "chukwudubem7@gmail.com"
    )
      return;
    try {
      const ref = doc(db, "users", memberId);
      await setDoc(ref, { isActive: !currentStatus }, { merge: true });
    } catch (err) {
      console.error("Failed to toggle member active state:", err);
    }
  };

  // Switch Member Role (Admin privilege action)
  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (
      currentUserRole !== "admin" &&
      currentUserRole !== "superadmin" &&
      user?.email !== "chukwudubem7@gmail.com"
    )
      return;
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
      setDefaultsSuccess("Inventory category tags saved successfully!");
      setTimeout(() => setDefaultsSuccess(""), 4000);
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
    currentUserRole === "admin" ||
    currentUserRole === "superadmin" ||
    user?.email === "chukwudubem7@gmail.com";

  return (
    <div className="space-y-8 font-sans">
      {/* --- 1. PAGE HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200/80">
        <div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#800080] border border-purple-200 mb-2">
            WORKSPACE SETTINGS
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            Workspace Administration
          </h1>
          <p className="text-sm text-neutral-500 mt-1 font-normal">
            Manage company profile details, onboard warehouse staff, assign team
            permissions, and customize default QR tag sizes.
          </p>
        </div>
      </div>

      {/* --- 2. TAB NAVIGATION BAR --- */}
      <div className="bg-white border border-neutral-200/80 p-1.5 rounded-xl shadow-xs inline-flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === "profile"
              ? "bg-[#800080] text-white shadow-xs font-semibold"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
          }`}
        >
          <Building className="size-3.5" />
          <span>Company Profile & Billing</span>
        </button>

        <button
          onClick={() => setActiveTab("team")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === "team"
              ? "bg-[#800080] text-white shadow-xs font-semibold"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
          }`}
        >
          <Users className="size-3.5" />
          <span>Team & Staff Directory</span>
        </button>

        <button
          onClick={() => setActiveTab("thermal")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === "thermal"
              ? "bg-[#800080] text-white shadow-xs font-semibold"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
          }`}
        >
          <QrCode className="size-3.5" />
          <span>Thermal QR Label Defaults</span>
        </button>
      </div>

      {/* --- 3. TAB CONTENT --- */}
      <div>
        {/* ================= TAB 1: COMPANY PROFILE & BILLING ================= */}
        {activeTab === "profile" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Column (Span 2): Profile Form Card */}
            <div className="lg:col-span-2 bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-100">
                <div className="size-9 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center border border-purple-100">
                  <Building className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Company Details
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Update your public organization name, contact lines, and
                    primary warehouse location.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700">
                    Organization / Workspace Name
                  </label>
                  <Input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Apex Event Productions"
                    className="bg-white border-neutral-200 rounded-xl h-10 text-xs text-neutral-900 focus-visible:ring-[#800080]"
                  />
                </div>

                {/* Contact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Support Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                      <Mail className="size-3.5 text-neutral-400" /> Support
                      Contact Email
                    </label>
                    <Input
                      type="email"
                      required
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="support@company.com"
                      className="bg-white border-neutral-200 rounded-xl h-10 text-xs text-neutral-900 focus-visible:ring-[#800080]"
                    />
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                      <Phone className="size-3.5 text-neutral-400" /> Contact
                      Phone
                    </label>
                    <Input
                      type="text"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="bg-white border-neutral-200 rounded-xl h-10 text-xs text-neutral-900 focus-visible:ring-[#800080]"
                    />
                  </div>
                </div>

                {/* Warehouse Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-neutral-400" /> Address /
                    Primary Warehouse Location
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Warehouse 4B, 120 Logistics Way, Austin, TX"
                    className="w-full bg-white border border-neutral-200 focus:border-[#800080] focus:ring-1 focus:ring-[#800080] rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 outline-none transition-colors resize-none leading-relaxed"
                  />
                </div>

                {/* Error Banner */}
                {profileError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{profileError}</span>
                  </div>
                )}

                {/* Success Banner */}
                {profileSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{profileSuccess}</span>
                  </div>
                )}

                {/* Save Button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 px-6 rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                        Saving Details...
                      </>
                    ) : (
                      "Save Profile Details"
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Right Column (Span 1): Current Subscription Card */}
            <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-100">
                <div className="size-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60">
                  <CreditCard className="size-5 text-[#800080]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Current Subscription
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Account tier and platform capabilities
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Plan Tier */}
                <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/60 space-y-1.5">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
                    Plan Tier
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-neutral-900">
                      {subscription?.plan || "Enterprise Pro"}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#800080] border border-purple-200">
                      {subscription?.isActive !== false
                        ? "Active License"
                        : "Suspended"}
                    </span>
                  </div>
                </div>

                {/* Renewal Cycle */}
                <div className="p-4 rounded-xl bg-neutral-50/70 border border-neutral-200/60 space-y-1.5">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-neutral-400" /> Renewal
                    Date
                  </span>
                  <span className="text-sm font-medium text-neutral-800 font-mono block">
                    {subscription?.validUntil || "December 31, 2026"}
                  </span>
                </div>

                {/* Administrative Notice Box */}
                <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl text-xs text-neutral-600 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[#800080] font-semibold text-xs">
                    <ShieldCheck className="size-4 shrink-0" />
                    <span>Administrative Notice</span>
                  </div>
                  <p className="leading-relaxed text-neutral-600">
                    Subscription tier, billing cycles, and feature access are
                    managed directly by Sterling EventOps Super Admin.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: TEAM & STAFF DIRECTORY ================= */}
        {activeTab === "team" && (
          <div className="space-y-6">
            {/* Team Directory Container */}
            <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-6">
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-neutral-100">
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Workspace Team Members
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Manage staff roles, operational permissions, and active
                    login privileges across the workspace.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setGeneratedLink("");
                    setInviteName("");
                    setInviteEmail("");
                    setInviteRole("staff");
                    setInviteModalOpen(true);
                  }}
                  className="bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 px-4 rounded-xl text-xs shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="size-4" />
                  <span>+ Invite Staff Member</span>
                </Button>
              </div>

              {/* Team Table */}
              <div className="border border-neutral-200/80 rounded-xl overflow-hidden">
                <div className="overflow-x-auto min-h-[240px]">
                  {loadingTeam ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-xs text-neutral-500">
                      <RefreshCw className="size-5 animate-spin text-[#800080]" />
                      <span className="font-medium">
                        Loading team directory...
                      </span>
                    </div>
                  ) : team.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Users className="size-8 text-neutral-400 mb-2" />
                      <h4 className="text-sm font-bold text-neutral-900">
                        No team members found
                      </h4>
                      <p className="text-xs text-neutral-500 mt-1">
                        Use the invite button above to onboard warehouse crew.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 uppercase text-xs font-semibold">
                          <th className="px-6 py-3.5">Name</th>
                          <th className="px-6 py-3.5">Email Contact</th>
                          <th className="px-6 py-3.5">Platform Role</th>
                          <th className="px-6 py-3.5">Access Status</th>
                          {isOperatorAdmin && (
                            <th className="px-6 py-3.5 text-right">
                              Access Controls
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200/80">
                        {team.map((member) => {
                          const isSelf = member.id === user?.uid;
                          const activeState = member.isActive !== false;
                          const initials = member.name
                            ? member.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()
                            : "U";

                          return (
                            <tr
                              key={member.id}
                              className="hover:bg-neutral-50/60 text-neutral-800 text-xs transition-colors"
                            >
                              {/* Name */}
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="size-8 rounded-lg bg-purple-50 border border-purple-200 text-[#800080] font-bold flex items-center justify-center text-xs select-none">
                                    {initials}
                                  </div>
                                  <div>
                                    <span className="font-bold text-neutral-900 block">
                                      {member.name || "Unnamed Operator"}
                                    </span>
                                    {isSelf && (
                                      <span className="text-[10px] text-purple-700 font-medium">
                                        (You)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Email */}
                              <td className="px-6 py-4 text-neutral-600 font-mono text-xs">
                                {member.email}
                              </td>

                              {/* Role */}
                              <td className="px-6 py-4">
                                {isOperatorAdmin && !isSelf ? (
                                  <select
                                    value={member.role || "staff"}
                                    onChange={(e) =>
                                      handleRoleChange(
                                        member.id,
                                        e.target.value,
                                      )
                                    }
                                    className="bg-white border border-neutral-200 rounded-lg px-2.5 py-1 text-xs text-neutral-800 font-medium outline-none cursor-pointer focus:border-[#800080]"
                                  >
                                    <option value="staff">
                                      Staff Operator
                                    </option>
                                    <option value="admin">Administrator</option>
                                  </select>
                                ) : (
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                      member.role === "admin" ||
                                      member.role === "superadmin"
                                        ? "bg-purple-50 text-[#800080] border border-purple-200"
                                        : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                                    }`}
                                  >
                                    {member.role === "admin" ||
                                    member.role === "superadmin"
                                      ? "Admin"
                                      : "Staff"}
                                  </span>
                                )}
                              </td>

                              {/* Access Status */}
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                    activeState
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  {activeState ? "Active" : "Suspended"}
                                </span>
                              </td>

                              {/* Admin Action Switch */}
                              {isOperatorAdmin && (
                                <td className="px-6 py-4 text-right">
                                  {isSelf ? (
                                    <span className="text-xs text-neutral-400 italic">
                                      Active Session
                                    </span>
                                  ) : (
                                    <div className="flex justify-end items-center gap-2.5">
                                      <span className="text-xs text-neutral-500 font-medium">
                                        {activeState ? "Enabled" : "Disabled"}
                                      </span>

                                      {/* Switch Component */}
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={activeState}
                                        onClick={() =>
                                          handleToggleActive(
                                            member.id,
                                            activeState,
                                          )
                                        }
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          activeState
                                            ? "bg-[#800080]"
                                            : "bg-neutral-300"
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
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
          </div>
        )}

        {/* ================= TAB 3: THERMAL QR LABEL DEFAULTS ================= */}
        {activeTab === "thermal" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Category Tag Manager (Span 3) */}
            <div className="lg:col-span-3 bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-100">
                <div className="size-9 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center border border-purple-100">
                  <Tag className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Inventory Category Tags
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Configure global organizational groups for warehouse
                    products and catalog filtering.
                  </p>
                </div>
              </div>

              {/* Tag Input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-700">
                  Add New Category Tag
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="e.g. Video, Rigging, Networking, Power"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                    className="bg-white border-neutral-200 rounded-xl h-10 text-xs text-neutral-900 focus-visible:ring-[#800080]"
                  />
                  <Button
                    onClick={handleAddTag}
                    className="bg-[#800080] hover:bg-[#660066] text-white font-medium text-xs h-10 px-4 rounded-xl shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="size-4" /> Add
                  </Button>
                </div>
              </div>

              {/* Tag Badges List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-700">
                    Active Categories ({categories.length})
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    Click &times; to remove
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 bg-neutral-50/70 border border-neutral-200/80 p-4 rounded-xl min-h-[90px] items-start">
                  {categories.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-800 shadow-2xs group hover:border-rose-300 transition-all select-none"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-neutral-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        <X className="size-3.5 shrink-0" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Success Banner */}
              {defaultsSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3.5 text-xs flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                  <span>{defaultsSuccess}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleSaveDefaults}
                  disabled={savingDefaults}
                  className="bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 px-5 rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingDefaults ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                      Saving Defaults...
                    </>
                  ) : (
                    "Save Category Defaults"
                  )}
                </Button>
              </div>
            </div>

            {/* Label Interactive Preview (Span 2) */}
            <div className="lg:col-span-2 bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2.5 pb-4 border-b border-neutral-100">
                <div className="size-9 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center border border-purple-100">
                  <QrCode className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Thermal Printer Preview
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Standard 50mm x 25mm label dimensions
                  </p>
                </div>
              </div>

              {/* Interactive Sticker Mockup */}
              <div className="space-y-4">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block">
                  Asset Barcode Sticker Output
                </span>

                {/* Sticker Mockup Container */}
                <div className="flex items-center justify-center p-8 bg-[#f6f1e5]/60 rounded-xl border border-neutral-200/80">
                  <div className="w-[220px] h-[110px] bg-white text-neutral-900 p-3.5 rounded-md flex items-center justify-between border-2 border-dashed border-neutral-300 relative shadow-md">
                    {/* Left Info */}
                    <div className="flex flex-col justify-between h-full select-none max-w-[115px]">
                      <div>
                        <span className="text-[8px] font-bold uppercase font-mono tracking-tight text-neutral-400 block truncate">
                          {companyName || "STERLING EVENTOPS"}
                        </span>
                        <h4 className="text-[11px] font-bold tracking-tight text-neutral-900 leading-snug mt-0.5 truncate">
                          Stage Audio Mic
                        </h4>
                      </div>

                      <div>
                        <span className="text-[7px] text-neutral-400 font-bold block uppercase tracking-wider">
                          ASSET SKU
                        </span>
                        <span className="text-[9px] font-mono font-bold text-neutral-800 block mt-0.5">
                          SKU-STG-1049
                        </span>
                      </div>
                    </div>

                    {/* Right QR Code */}
                    <div className="size-16 border border-neutral-200 p-1 flex items-center justify-center bg-white rounded shrink-0 shadow-2xs">
                      <QRCodeSVG value="SKU-STG-1049" size={56} level="M" />
                    </div>

                    {/* Edge Dimension Indicators */}
                    <span className="absolute -left-5 top-1/2 -translate-y-1/2 text-[9px] font-mono font-semibold text-neutral-400 -rotate-90 leading-none">
                      25mm
                    </span>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-mono font-semibold text-neutral-400 leading-none">
                      50mm
                    </span>
                  </div>
                </div>

                {/* Info Callout */}
                <div className="bg-neutral-50 border border-neutral-200/80 p-4 rounded-xl space-y-1.5 text-xs leading-relaxed text-neutral-600">
                  <div className="flex items-center gap-1.5 text-neutral-800 font-semibold">
                    <Sparkles className="size-3.5 text-[#800080]" />
                    <span>High-Definition Thermal Printing</span>
                  </div>
                  <p>
                    Every generated inventory record contains dynamic print
                    endpoints optimized for direct ZPL or PDF streaming to
                    industrial thermal barcode hardware.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= INVITE STAFF DIALOG MODAL ================= */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/50 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-purple-50 text-[#800080] flex items-center justify-center border border-purple-200">
                  <UserPlus className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    Invite Staff Member
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Onboard warehouse operator to your workspace
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {generatedLink ? (
                /* Generated Link Screen */
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Sparkles className="size-4 shrink-0 text-emerald-600" />
                      <span>Invitation Link Generated!</span>
                    </div>
                    <p className="text-xs leading-relaxed text-emerald-700">
                      Copy and share this secure invitation link with the staff
                      member to complete their registration.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700 block">
                      Secure Invitation Link
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="bg-neutral-50 border-neutral-200 text-xs font-mono select-all rounded-xl h-10"
                      />
                      <Button
                        onClick={handleCopyLink}
                        className="bg-[#800080] hover:bg-[#660066] text-white font-medium h-10 w-10 p-0 rounded-xl shrink-0 cursor-pointer shadow-xs"
                      >
                        {copiedLink ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <Button
                      onClick={() => setGeneratedLink("")}
                      variant="outline"
                      className="w-full border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium rounded-xl h-10 cursor-pointer"
                    >
                      Invite Another
                    </Button>
                    <Button
                      onClick={() => setInviteModalOpen(false)}
                      className="w-full bg-[#800080] hover:bg-[#660066] text-white text-xs font-medium rounded-xl h-10 cursor-pointer shadow-xs"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                /* Invite Form */
                <form onSubmit={handleGenerateInvite} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700">
                      Staff Member Name
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Marcus Vance"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="bg-white border-neutral-200 rounded-xl h-10 text-xs text-neutral-900 focus-visible:ring-[#800080]"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700">
                      Staff Email Address
                    </label>
                    <Input
                      type="email"
                      required
                      placeholder="name@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="bg-white border-neutral-200 rounded-xl h-10 text-xs text-neutral-900 focus-visible:ring-[#800080]"
                    />
                  </div>

                  {/* Role Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-neutral-700">
                      Assigned Workspace Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 h-10 text-xs text-neutral-800 font-medium outline-none cursor-pointer focus:border-[#800080]"
                    >
                      <option value="staff">
                        Staff Operator (Warehouse & Audits)
                      </option>
                      <option value="admin">
                        Administrator (Full Workspace Access)
                      </option>
                    </select>
                  </div>

                  {/* Buttons */}
                  <div className="pt-2 flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteModalOpen(false)}
                      className="flex-1 border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs font-medium rounded-xl h-10 cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={sendingInvite}
                      className="flex-1 bg-[#800080] hover:bg-[#660066] text-white text-xs font-medium rounded-xl h-10 cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      {sendingInvite ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          Generating Link...
                        </>
                      ) : (
                        "Generate Invite Link"
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
