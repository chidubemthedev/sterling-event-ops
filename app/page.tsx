"use client";

import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldCheck,
  PackageCheck,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, setAuth } = useWorkspaceStore();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setFormError] = useState(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("suspended") === "true") {
        return "Account Suspended: Your access has been revoked by an administrator. Please contact support.";
      }
    }
    return "";
  });
  const [successMessage, setFormSuccess] = useState("");

  // LoggedIn Redirect Effect
  useEffect(() => {
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
      const authUser = userCredential.user;

      setFormSuccess("Authentication successful! Redirecting to your workspace...");

      // 2. Fetch Custom Claims and Firestore Profile
      const idTokenResult = await authUser.getIdTokenResult();
      const roleClaim = idTokenResult.claims.role;

      // 3. Routing Traffic Cop Logic
      const lowercaseEmail = authUser.email?.toLowerCase();

      // Condition 1: Specific Testing Bypass email
      if (lowercaseEmail === "chukwudubem7@gmail.com") {
        setAuth(authUser, "superadmin-bypass", {
          isActive: true,
          plan: "enterprise",
          validUntil: "N/A",
        });
        router.push("/superadmin");
        return;
      }

      // Condition 2: Custom claim role === "superadmin"
      if (roleClaim === "superadmin") {
        setAuth(authUser, "superadmin-claim", {
          isActive: true,
          plan: "enterprise",
          validUntil: "N/A",
        });
        router.push("/superadmin");
        return;
      }

      // Condition 3: Look up Firestore user profile for role/workspace assignment
      let userDoc = await getDoc(doc(db, "users", authUser.uid));
      if (!userDoc.exists() && authUser.email) {
        userDoc = await getDoc(doc(db, "users", authUser.email.toLowerCase()));
      }

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Block Suspended Accounts
        if (userData.isActive === false) {
          await signOut(auth);
          setFormError(
            "Account Suspended: Your access has been revoked by an administrator. Please contact support."
          );
          setLoading(false);
          return;
        }

        const role = userData.role || "admin";
        const workspaceId = userData.workspaceId || null;
        const subData = userData.subscription || {
          isActive: true,
          plan: "Trial",
          validUntil: "N/A",
        };

        setAuth(authUser, workspaceId, {
          isActive: subData.isActive,
          plan: subData.plan || "Trial",
          validUntil: subData.validUntil || "N/A",
        });

        if (role === "superadmin") {
          router.push("/superadmin");
        } else {
          router.push("/dashboard");
        }
        return;
      }

      // Condition 4: Fallback if no Firestore profile doc exists yet
      const defaultWorkspaceId = `workspace_${authUser.uid.substring(0, 6)}`;
      setAuth(authUser, defaultWorkspaceId, {
        isActive: true,
        plan: "EventOps Professional",
        validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
      });
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login failure:", err);
      let cleanMessage = "An unexpected error occurred. Please try again.";
      const error = err as { code?: string; message?: string };
      if (
        error.code === "auth/invalid-credential" ||
        error.code === "auth/wrong-password" ||
        error.code === "auth/user-not-found"
      ) {
        cleanMessage = "Invalid credentials. Please verify your email and password.";
      } else if (error.code === "auth/network-request-failed") {
        cleanMessage = "Network error. Please check your internet connection.";
      } else if (error.code === "auth/too-many-requests") {
        cleanMessage =
          "Too many login attempts. Access is temporarily suspended. Please try again later.";
      } else if (error.message) {
        cleanMessage = error.message;
      }
      setFormError(cleanMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f1e5] dark:bg-[#0f040f] text-neutral-900 dark:text-neutral-100 flex font-sans">
      {/* 2-COLUMN SPLIT-SCREEN LAYOUT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 relative w-full min-h-screen">
        
        {/* COLUMN 1: MATTE ELEGANCE BRAND SHOWCASE PANEL */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-12 xl:p-16 bg-[#220022] text-white border-r border-white/10 relative">
          
          {/* Top Logo & System Indicator */}
          <div className="flex items-center gap-3.5 z-10">
            {/* Clean Logo Placeholder */}
            <div className="w-10 h-10 rounded-xl bg-white/10 text-[#ffd700] font-bold flex items-center justify-center border border-white/15">
              SE
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white uppercase">
                Sterling EventOps
              </h1>
              <span className="text-[11px] text-white/60 font-medium tracking-wide">
                Enterprise Logistics Platform
              </span>
            </div>
          </div>

          {/* Hero Branding Content */}
          <div className="space-y-8 max-w-lg z-10 my-auto py-8">
            {/* Clean Frosted Badge */}
            <Badge
              variant="outline"
              className="bg-white/10 text-white/90 border border-white/15 backdrop-blur-md rounded-full px-3 py-1 text-xs font-medium tracking-wider uppercase gap-1.5 shadow-none"
            >
              <Sparkles className="size-3.5 text-[#ffd700]" />
              EVENT LOGISTICS &amp; ASSET CONTROL
            </Badge>

            {/* Hero Heading */}
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.2] text-white">
              Flawless Event Execution.{" "}
              <span className="text-[#ffd700]/90 font-semibold block sm:inline">
                Down to the Last Asset.
              </span>
            </h2>

            {/* Sub-heading */}
            <p className="text-white/75 text-sm xl:text-base leading-relaxed font-normal">
              Sterling EventOps keeps your rental inventory accountable, eliminates
              venue missing-item chaos, and tracks every piece of equipment in
              real-time.
            </p>

            {/* Subtle Value Bullet Points */}
            <ul className="space-y-4 pt-2 text-xs xl:text-sm font-medium text-white/85">
              <li className="flex items-start gap-3.5">
                <div className="text-[#ffd700] bg-white/5 p-2 rounded-lg border border-white/10 shrink-0 mt-0.5">
                  <PackageCheck className="size-4" />
                </div>
                <div>
                  <strong className="text-white font-semibold block text-sm">
                    Zero Inventory Loss
                  </strong>
                  <span className="text-white/65 text-xs">
                    Real-time scan routing across every warehouse and venue setup.
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="text-[#ffd700] bg-white/5 p-2 rounded-lg border border-white/10 shrink-0 mt-0.5">
                  <QrCode className="size-4" />
                </div>
                <div>
                  <strong className="text-white font-semibold block text-sm">
                    Instant QR Audits
                  </strong>
                  <span className="text-white/65 text-xs">
                    Lightning-fast field verification using any mobile browser.
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3.5">
                <div className="text-[#ffd700] bg-white/5 p-2 rounded-lg border border-white/10 shrink-0 mt-0.5">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <strong className="text-white font-semibold block text-sm">
                    Chain of Custody
                  </strong>
                  <span className="text-white/65 text-xs">
                    Immutable photo logs and condition checks on every return.
                  </span>
                </div>
              </li>
            </ul>
          </div>

          {/* Footer Metadata */}
          <div className="flex items-center justify-between text-[11px] text-white/40 z-10 pt-4 border-t border-white/10">
            <span>© 2026 Sterling EventOps Systems</span>
            <span>Security &amp; Tenant Partitioning</span>
          </div>
        </div>

        {/* COLUMN 2: FLAT EDITORIAL LOGIN FORM PANEL */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 sm:p-10 bg-[#f6f1e5] dark:bg-[#0f040f] min-h-screen">
          
          {/* Mobile Logomark Header */}
          <div className="flex lg:hidden items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-[#220022] text-[#ffd700] font-bold flex items-center justify-center border border-white/10">
              SE
            </div>
            <div>
              <h1 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wide">
                Sterling EventOps
              </h1>
              <p className="text-[10px] text-neutral-500">
                Event Logistics &amp; Asset Control
              </p>
            </div>
          </div>

          {/* Clean Flat Sign-In Card */}
          <div className="max-w-md w-full bg-white dark:bg-[#180818] border border-neutral-200/80 dark:border-neutral-800 rounded-2xl p-8 shadow-sm">
            
            {/* Card Header */}
            <div className="space-y-1.5 mb-6">
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Welcome Back
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Enter your account details to access your workspace.
              </p>
            </div>

            {/* Interactive Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Email Address Input */}
              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  <Mail className="size-3.5 text-neutral-500" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="admin@events.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-neutral-50/50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-[#800080] focus-visible:border-[#800080] transition-colors h-11 dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-100"
                />
              </div>

              {/* Password Input with Toggle */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                  >
                    <Lock className="size-3.5 text-neutral-500" />
                    Password
                  </Label>
                  <a
                    href="#"
                    className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="bg-neutral-50/50 border-neutral-200 text-neutral-900 placeholder:text-neutral-400 focus-visible:ring-1 focus-visible:ring-[#800080] focus-visible:border-[#800080] transition-colors h-11 dark:bg-neutral-900/50 dark:border-neutral-800 dark:text-neutral-100 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors focus:outline-none"
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
                <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-300 rounded-lg p-3 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
                  <span className="leading-tight">{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-300 rounded-lg p-3 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="leading-tight">{successMessage}</span>
                </div>
              )}

              {/* Submit Action Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#800080] hover:bg-[#660066] text-white font-medium shadow-none rounded-xl py-5 h-auto transition-colors cursor-pointer flex items-center justify-center gap-2 group"
                >
                  {loading ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>
              </div>

            </form>
          </div>

          {/* Support Microcopy */}
          <div className="text-xs text-neutral-500 text-center mt-6">
            <span>Need an invitation link? </span>
            <a
              href="#"
              className="text-[#800080] dark:text-[#ffd700] font-medium hover:underline transition-colors"
            >
              Contact your Workspace Administrator
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
