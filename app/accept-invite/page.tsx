"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Sparkles, 
  CheckCircle, 
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const { setAuth } = useWorkspaceStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [isValid, setIsValid] = useState(false);

  // Form states
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setIsValid(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const docRef = doc(db, "invites", token);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.accepted === false) {
            setInviteData(data);
            setIsValid(true);
          } else {
            setIsValid(false);
          }
        } else {
          setIsValid(false);
        }
      } catch (err) {
        console.error("Token verification error:", err);
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!fullName.trim() || !password.trim()) {
      setFormError("Please fill out all required fields.");
      return;
    }

    if (password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        inviteData.ownerEmail.toLowerCase(), 
        password
      );
      const newUser = userCredential.user;

      // 2. Write user profile document to the users collection
      const userRef = doc(db, "users", newUser.uid);
      await setDoc(userRef, {
        id: newUser.uid,
        email: inviteData.ownerEmail.toLowerCase(),
        name: fullName.trim(),
        role: inviteData.role || "staff",
        workspaceId: inviteData.workspaceId,
        createdAt: new Date().toISOString()
      });

      // 3. Update the invites document to set accepted: true
      const inviteRef = doc(db, "invites", token);
      await setDoc(inviteRef, {
        accepted: true,
        acceptedAt: new Date().toISOString(),
        acceptedByUid: newUser.uid
      }, { merge: true });

      // Fetch Workspace Info to update Store
      const workspaceRef = doc(db, "workspaces", inviteData.workspaceId);
      const workspaceSnap = await getDoc(workspaceRef);
      let subInfo = { isActive: true, plan: "Premium", validUntil: "N/A" };

      if (workspaceSnap.exists()) {
        const ws = workspaceSnap.data();
        if (ws.subscription) {
          subInfo = {
            isActive: ws.subscription.isActive !== false,
            plan: ws.subscription.plan || "Premium",
            validUntil: ws.subscription.validUntil || "N/A"
          };
        }
      }

      setFormSuccess("Onboarding profile complete! Synchronizing environments...");

      // 4. Update the Zustand store (useWorkspaceStore) with the newly created user and workspace context
      setAuth(newUser, inviteData.workspaceId, subInfo);

      // 5. Automatically redirect to dashboard
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);

    } catch (err: any) {
      console.error("Onboarding error:", err);
      let cleanMsg = "Could not complete onboarding profile. Please try again.";
      if (err.code === "auth/email-already-in-use") {
        cleanMsg = "This email is already in use by another account.";
      } else if (err.code === "auth/weak-password") {
        cleanMsg = "Password is too weak. Must be at least 6 characters.";
      } else if (err.message) {
        cleanMsg = err.message;
      }
      setFormError(cleanMsg);
      setSubmitting(false);
    }
  };

  // Verification loading spinner
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-50">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Verifying Invitation Credentials...
        </p>
      </div>
    );
  }

  // Red error card if token invalid or expired
  if (!isValid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4">
        {/* Glow bg */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-red-500/10 blur-[120px] pointer-events-none" />

        <div className="max-w-md w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-md relative animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
          
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto mb-6">
            <AlertTriangle className="size-8" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white font-heading mb-3">
            Invitation Expired or Invalid
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed mb-6">
            The security token provided is invalid or has already been accepted to setup a workspace administrator profile. Please verify your URL query parameters or request a new invite from the super administrator.
          </p>

          <Button 
            onClick={() => router.push("/")}
            variant="outline"
            className="w-full border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white h-11 font-bold text-xs"
          >
            Back to Gateway
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 relative overflow-hidden">
      {/* Dynamic gradients */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="max-w-lg w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" />

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800/60">
          <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black">
            SF
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white font-heading uppercase">
              Sterling Ops Client Portal
            </h2>
            <p className="text-[10px] text-zinc-400 font-mono">Workspace Administrator Onboarding</p>
          </div>
        </div>

        {/* Welcome block */}
        <div className="space-y-2 mb-6">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-wide">
            <ShieldCheck className="size-3.5 mr-1" /> Verified Security Access
          </span>
          <h1 className="text-xl font-bold tracking-tight text-white font-heading">
            Register Admin Account
          </h1>
          <p className="text-zinc-400 text-xs leading-relaxed">
            Welcome to <strong className="text-white font-semibold">"{inviteData?.workspaceName}"</strong>! Let's build your administrator login credentials and set up your system profile dashboard.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Company details (Read-only) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                <Building className="size-3 text-zinc-600" /> Organization Name
              </span>
              <div className="bg-zinc-950/60 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs text-zinc-300 font-semibold select-none truncate">
                {inviteData?.workspaceName}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1">
                <Mail className="size-3 text-zinc-600" /> Admin Email
              </span>
              <div className="bg-zinc-950/60 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs text-zinc-300 font-semibold select-none truncate">
                {inviteData?.ownerEmail}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <UserIcon className="size-3.5 text-zinc-500" />
              Full Name <span className="text-red-400">*</span>
            </label>
            <input 
              type="text" 
              required
              id="fullName"
              placeholder="e.g. Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5 relative">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Lock className="size-3.5 text-zinc-500" />
              Onboarding Security Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                required
                id="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-11 py-3 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Feedback banners */}
          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span className="font-semibold text-[11px] leading-relaxed">{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
              <CheckCircle className="size-4 shrink-0 mt-0.5 animate-bounce" />
              <span className="font-semibold text-[11px] leading-relaxed">{formSuccess}</span>
            </div>
          )}

          {/* Submit Action */}
          <Button 
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold h-12 rounded-xl border-none shadow-lg shadow-indigo-600/15 text-xs flex items-center justify-center gap-1.5 pt-0.5 transition-all mt-6"
          >
            {submitting ? (
              <>
                <RefreshCw className="size-4 animate-spin mr-1.5" />
                Setting up administrator profile...
              </>
            ) : (
              <>
                Complete Account Onboarding
                <ArrowRight className="size-4 animate-pulse" />
              </>
            )}
          </Button>

        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-50">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Loading Onboarding Module...
        </p>
      </div>
    }>
      <AcceptInviteForm />
    </Suspense>
  );
}
