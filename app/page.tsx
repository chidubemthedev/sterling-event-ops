"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  Mail, 
  Lock, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle,
  QrCode,
  Layers,
  Database,
  History,
  ArrowRight,
  Eye,
  EyeOff
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, setAuth } = useWorkspaceStore();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setFormError] = useState("");
  const [successMessage, setFormSuccess] = useState("");

  // LoggedIn Redirect Effect
  React.useEffect(() => {
    if (authLoading || !user) return;

    const performRedirect = async () => {
      const lowercaseEmail = user.email?.toLowerCase();

      // Condition 1: Specific Testing Bypass email
      if (lowercaseEmail === "chukwudubem7@gmail.com") {
        router.push("/superadmin");
        return;
      }

      try {
        const idTokenResult = await user.getIdTokenResult();
        const roleClaim = idTokenResult.claims.role;

        // Condition 2: Custom claim role === "superadmin"
        if (roleClaim === "superadmin") {
          router.push("/superadmin");
          return;
        }

        // Condition 3: Look up Firestore user profile for role
        let userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists() && user.email) {
          userDoc = await getDoc(doc(db, "users", user.email.toLowerCase()));
        }

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const role = userData.role || "admin";
          if (role === "superadmin") {
            router.push("/superadmin");
          } else {
            router.push("/dashboard");
          }
        } else {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Auto redirect claim check error:", err);
        router.push("/dashboard");
      }
    };

    performRedirect();
  }, [user, authLoading, router]);

  // Handle Form Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!email.trim() || !password.trim()) {
      setFormError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        email.trim().toLowerCase(), 
        password
      );
      const user = userCredential.user;

      setFormSuccess("Authentication successful! Redirecting...");

      // 2. Fetch Custom Claims and Firestore Profile
      const idTokenResult = await user.getIdTokenResult();
      const roleClaim = idTokenResult.claims.role;

      // 3. Routing Traffic Cop Logic
      const lowercaseEmail = user.email?.toLowerCase();

      // Condition 1: Specific Testing Bypass email
      if (lowercaseEmail === "chukwudubem7@gmail.com") {
        setAuth(user, "superadmin-bypass", {
          isActive: true,
          plan: "enterprise",
          validUntil: "N/A"
        });
        router.push("/superadmin");
        return;
      }

      // Condition 2: Custom claim role === "superadmin"
      if (roleClaim === "superadmin") {
        setAuth(user, "superadmin-claim", {
          isActive: true,
          plan: "enterprise",
          validUntil: "N/A"
        });
        router.push("/superadmin");
        return;
      }

      // Condition 3: Look up Firestore user profile for role/workspace assignment
      // Check both UID and Email based lookups to cover various onboarding flows
      let userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() && user.email) {
        userDoc = await getDoc(doc(db, "users", user.email.toLowerCase()));
      }

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role || "admin"; // Default to admin for tenant creators
        const workspaceId = userData.workspaceId || null;
        const subData = userData.subscription || { isActive: true, plan: "Trial", validUntil: "N/A" };

        setAuth(user, workspaceId, {
          isActive: subData.isActive,
          plan: subData.plan || "Trial",
          validUntil: subData.validUntil || "N/A"
        });

        if (role === "superadmin") {
          router.push("/superadmin");
        } else if (role === "admin" || role === "staff") {
          router.push("/dashboard");
        } else {
          // Default fallback for any valid user profile
          router.push("/dashboard");
        }
        return;
      }

      // Condition 4: Fallback if no Firestore profile doc exists yet
      // This is helpful for newly registered users where document creation is pending,
      // we'll log them in, auto-associate a placeholder workspace, and route them to dashboard.
      const defaultWorkspaceId = `workspace_${user.uid.substring(0, 6)}`;
      setAuth(user, defaultWorkspaceId, {
        isActive: true,
        plan: "Developer Trial",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      });
      router.push("/dashboard");

    } catch (err: any) {
      console.error("Login failure:", err);
      // Map Firebase Auth error codes to user-friendly messages
      let cleanMessage = "An unexpected error occurred. Please try again.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        cleanMessage = "Invalid credentials. Please verify your email and password.";
      } else if (err.code === "auth/network-request-failed") {
        cleanMessage = "Network error. Please check your internet connection.";
      } else if (err.code === "auth/too-many-requests") {
        cleanMessage = "Too many login attempts. Access is temporarily suspended. Please try again later.";
      } else if (err.message) {
        cleanMessage = err.message;
      }
      setFormError(cleanMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex font-sans overflow-hidden">
      
      {/* 2-COLUMN LAYOUT CONTEXT */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 relative w-full h-full min-h-screen">
        
        {/* COLUMN 1: BRAND SHOWCASE PANEL (Desktop Only) */}
        <div className="hidden md:flex flex-col justify-between p-12 bg-gradient-to-br from-zinc-950 via-zinc-900 to-indigo-950/60 border-r border-zinc-800 relative overflow-hidden">
          {/* Ambient lighting mesh effects */}
          <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none animate-pulse duration-3000" />
          
          {/* Top Logo and Header */}
          <div className="flex items-center gap-3 z-10">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-indigo-500/10">
              SF
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white font-heading uppercase">
                Sterling EventOps
              </h1>
              <span className="text-[10px] text-zinc-400 font-mono">Platform MVP</span>
            </div>
          </div>

          {/* Core Feature Checklist */}
          <div className="space-y-6 max-w-md z-10 my-auto">
            <span className="inline-flex items-center gap-1 text-xs text-indigo-400 font-semibold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
              <Sparkles className="size-3.5 animate-spin duration-3000" />
              SaaS Operational Framework
            </span>
            
            <h2 className="text-3xl font-black tracking-tight leading-tight text-white font-heading">
              Secure Multi-Tenant Asset Tracking Engine
            </h2>
            
            <p className="text-zinc-400 text-sm leading-relaxed">
              Sterling EventOps enables offline-first asset audits, secure workspace isolation, and an immutable non-deletable log audit trail.
            </p>

            {/* Checklist Items */}
            <ul className="space-y-3.5 pt-4 text-xs font-semibold text-zinc-300">
              <li className="flex items-center gap-2.5">
                <div className="size-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Layers className="size-3.5" />
                </div>
                <span>Strict Multi-Tenancy Workspace Segmentation</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="size-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <QrCode className="size-3.5" />
                </div>
                <span>Fast Real-Time QR & Scan Router Routing</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="size-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Database className="size-3.5" />
                </div>
                <span>Multi-Tab Local Storage Cache Persistence</span>
              </li>
              <li className="flex items-center gap-2.5">
                <div className="size-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <History className="size-3.5" />
                </div>
                <span>Immutable Event Movement Audit Trail Logs</span>
              </li>
            </ul>
          </div>

          {/* Footer Metadata */}
          <div className="text-[10px] text-zinc-500 font-mono z-10">
            © 2026 Sterling EventOps Systems. All rights reserved.
          </div>
        </div>

        {/* COLUMN 2: LOGIN PANEL */}
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 relative">
          {/* Ambient lighting mesh effects */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

          {/* Logomark header for mobile viewports */}
          <div className="flex md:hidden items-center gap-3 absolute top-8 left-8">
            <div className="size-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black">
              SF
            </div>
            <h1 className="text-xs font-bold text-white uppercase font-heading tracking-wide">
              Sterling Ops
            </h1>
          </div>

          {/* Login Card */}
          <div className="max-w-sm w-full bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top glowing line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]" />

            {/* Header */}
            <div className="space-y-1.5 mb-6 text-center sm:text-left">
              <h3 className="text-xl font-bold tracking-tight text-white font-heading">
                Sign In
              </h3>
              <p className="text-xs text-zinc-400">
                Enter your administrative credentials to open your event cockpit.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="size-3.5 text-zinc-500" />
                  Email Address
                </label>
                <input 
                  type="email" 
                  required
                  autoFocus
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors duration-150"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Lock className="size-3.5 text-zinc-500" />
                    Password
                  </label>
                  <a href="#" className="text-[10px] text-indigo-400 font-medium hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 pr-10 transition-colors duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Feedback Alerts */}
              {errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 animate-bounce" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit Action Button */}
              <div className="pt-2">
                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-95 shadow-lg shadow-indigo-600/10 h-11 border-none cursor-pointer"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking records...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-1.5">
                      Open Operational Cockpit
                      <ArrowRight className="size-4" />
                    </div>
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>

      </div>

    </div>
  );
}
