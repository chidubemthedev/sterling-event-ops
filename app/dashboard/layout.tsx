"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWorkspaceStore, useSubscriptionActive } from "@/store/useWorkspaceStore";
import { auth, db } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Boxes,
  CalendarDays,
  History,
  ShieldAlert,
  LogOut,
  Building,
  Menu,
  X,
  ChevronDown,
  User,
  Shield,
  Sparkles,
  CreditCard,
  AlertTriangle,
  Sliders
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, workspaceId, subscription, loading, clearAuth } = useWorkspaceStore();
  const isSubscriptionActive = useSubscriptionActive();

  // Profile and workspace states
  const [profile, setProfile] = useState<{ name?: string; role?: string } | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>("Loading Workspace...");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // 1. Unauthenticated Security Route Guard Lockout
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  // 2. Fetch User Profile (Role, Full Name)
  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile({
          name: data.name || "Workspace Member",
          role: data.role || "Staff"
        });
      } else {
        setProfile({
          name: "Workspace Member",
          role: "Staff"
        });
      }
    }, (err) => {
      console.error("Layout profile subscription failed:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Fetch Workspace Name
  useEffect(() => {
    if (!workspaceId) return;

    const workspaceRef = doc(db, "workspaces", workspaceId);
    const unsubscribe = onSnapshot(workspaceRef, (docSnap) => {
      if (docSnap.exists()) {
        setWorkspaceName(docSnap.data().companyName || "Workspace Domain");
      } else {
        setWorkspaceName("Workspace Domain");
      }
    }, (err) => {
      console.error("Layout workspace info subscription failed:", err);
    });

    return () => unsubscribe();
  }, [workspaceId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      clearAuth();
      router.replace("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Sidebar navigation links definition
  const navigationItems = [
    {
      name: "Dashboard Overview",
      href: "/dashboard",
      icon: LayoutDashboard
    },
    {
      name: "Inventory Catalog",
      href: "/dashboard/inventory",
      icon: Boxes
    },
    {
      name: "Active & Past Events",
      href: "/dashboard/events",
      icon: CalendarDays
    },
    {
      name: "Audit Logs",
      href: "/dashboard/logs",
      icon: History
    },
    {
      name: "Workspace Settings",
      href: "/dashboard/settings",
      icon: Sliders
    }
  ];

  // Helper check for superadmin view access
  const showSuperadminConsole = user?.email === "chukwudubem7@gmail.com" || profile?.role === "superadmin";

  // Prevent flash content leaks during verification loading state
  if (loading || !user) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-50">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Securing Workspace Credentials...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row relative font-sans overflow-x-hidden">
      
      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* --- SIDEBAR PANEL (DESKTOP) --- */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900/40 border-r border-zinc-800/80 backdrop-blur-xl shrink-0 z-30 h-screen sticky top-0 justify-between p-6">
        <div className="space-y-8">
          
          {/* Logo brand head */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-indigo-500/15">
              SF
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-tight text-white font-heading uppercase leading-none">
                Sterling Ops
              </h1>
              <span className="text-[9px] text-zinc-400 font-mono tracking-wider">On-Field Cockpit</span>
            </div>
          </div>

          {/* Navigation link blocks */}
          <nav className="space-y-1.5">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                  }`}
                >
                  <Icon className={`size-4.5 transition-transform group-hover:scale-105 duration-200 ${
                    isActive ? "text-white" : "text-zinc-500 group-hover:text-indigo-400"
                  }`} />
                  <span>{item.name}</span>
                </a>
              );
            })}

            {/* If superadmin, display console */}
            {showSuperadminConsole && (
              <div className="pt-4 mt-4 border-t border-zinc-800/40">
                <a
                  href="/superadmin"
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                    pathname === "/superadmin"
                      ? "bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-600/10"
                      : "text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:text-amber-300"
                  }`}
                >
                  <ShieldAlert className="size-4.5 shrink-0" />
                  <span>Super Admin Console</span>
                </a>
              </div>
            )}
          </nav>
        </div>

        {/* Footer Logout Option */}
        <div className="border-t border-zinc-800/40 pt-4">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800/50 justify-start h-10 px-3.5 rounded-xl text-xs font-semibold"
          >
            <LogOut className="size-4.5 mr-3 text-zinc-500" />
            Sign Out Session
          </Button>
        </div>
      </aside>

      {/* --- MOBILE MOBILE HEADER NAV BAR --- */}
      <header className="md:hidden flex items-center justify-between bg-zinc-900/60 border-b border-zinc-800 px-6 py-4 backdrop-blur-xl z-40 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black">
            SF
          </div>
          <div>
            <h1 className="text-[11px] font-bold text-white font-heading uppercase leading-none">
              Sterling Ops
            </h1>
            <span className="text-[8px] text-zinc-400 font-mono tracking-wide">Client Portal</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </header>

      {/* --- MOBILE SIDEDRAWER BAR SLIDER --- */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          {/* Backdrop lock */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm" 
          />
          
          <aside className="relative flex flex-col w-64 bg-zinc-900 border-r border-zinc-800 p-6 h-full justify-between z-40 animate-in slide-in-from-left duration-250">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-zinc-950 font-black">
                    SF
                  </div>
                  <span className="text-xs font-bold text-white uppercase font-heading">Navigation Menu</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-500 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>

              <nav className="space-y-1.5">
                {navigationItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="size-4.5" />
                      <span>{item.name}</span>
                    </a>
                  );
                })}

                {showSuperadminConsole && (
                  <div className="pt-4 mt-4 border-t border-zinc-800/40">
                    <a
                      href="/superadmin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 border ${
                        pathname === "/superadmin"
                          ? "bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-600/10"
                          : "text-amber-400 border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:text-amber-300"
                      }`}
                    >
                      <ShieldAlert className="size-4.5" />
                      <span>Super Admin Console</span>
                    </a>
                  </div>
                )}
              </nav>
            </div>

            <div className="border-t border-zinc-800/40 pt-4">
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                variant="ghost"
                className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800/50 justify-start h-10 px-3.5 rounded-xl text-xs font-semibold"
              >
                <LogOut className="size-4.5 mr-3 text-zinc-500" />
                Sign Out Session
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* --- COCKPIT MAIN WRAPPER COMPONENT --- */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* --- GLOBAL TOP NAVBAR COCKPIT HEADER --- */}
        <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60 px-6 py-4 hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building className="size-4 text-zinc-500" />
            <h2 className="text-sm font-bold text-zinc-200 tracking-tight font-sans">
              {workspaceName}
            </h2>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border tracking-wider font-mono ${
              subscription?.plan === "enterprise"
                ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                : subscription?.plan === "premium"
                ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
            }`}>
              {subscription?.plan || "Premium"} Tier
            </span>
          </div>

          {/* User Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-900/40 border border-zinc-850 hover:bg-zinc-900/80 hover:border-zinc-800 transition-all cursor-pointer"
            >
              <div className="size-6.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[10.5px] font-black text-indigo-400">
                {profile?.name?.substring(0, 2).toUpperCase() || "OP"}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <span className="text-[11px] font-bold text-zinc-200 block truncate max-w-[120px]">{profile?.name}</span>
                <span className="text-[8.5px] text-indigo-400 font-mono font-medium block uppercase tracking-wider">{profile?.role}</span>
              </div>
              <ChevronDown className="size-3.5 text-zinc-500 shrink-0" />
            </button>

            {dropdownOpen && (
              <>
                <div onClick={() => setDropdownOpen(false)} className="fixed inset-0 z-15" />
                <div className="absolute right-0 mt-2 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-zinc-800/60 text-[10.5px]">
                    <span className="text-zinc-500 font-medium block">Logged in as:</span>
                    <span className="text-zinc-200 font-semibold block truncate mt-0.5">{user?.email}</span>
                  </div>
                  <div className="p-1">
                    <Button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      variant="ghost"
                      className="w-full text-zinc-400 hover:text-white hover:bg-zinc-800 justify-start h-9 px-2.5 rounded-lg text-xs font-semibold border-none"
                    >
                      <LogOut className="size-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </header>

        {/* --- EXPIRED SUBSCRIPTION BAR LOCKOVERLAY --- */}
        {!isSubscriptionActive && (
          <div className="bg-red-950/90 border-b border-red-500/20 text-red-200 px-6 py-3.5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-4 text-red-400 animate-bounce shrink-0" />
              <div className="text-xs">
                <strong className="text-white font-bold block sm:inline">Subscription Locked: </strong>
                <span>Workspace operations are currently suspended. Action updates, assets generation, and scans are blocked.</span>
              </div>
            </div>
            <Button
              className="h-8 bg-red-600 text-white font-semibold text-[10.5px] hover:bg-red-500 border-none shrink-0"
            >
              <CreditCard className="size-3.5 mr-1.5" />
              Renew Subscription
            </Button>
          </div>
        )}

        {/* --- PAGE MAIN BODY OUTLET COMPONENT --- */}
        <main className={`flex-1 p-6 relative ${!isSubscriptionActive ? "pointer-events-none opacity-50 select-none cursor-not-allowed" : ""}`}>
          {children}
        </main>

      </div>
    </div>
  );
}
