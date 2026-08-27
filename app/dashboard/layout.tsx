"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWorkspaceStore, useSubscriptionActive } from "@/store/useWorkspaceStore";
import { auth, db } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
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
  Sliders,
  CreditCard,
  AlertTriangle,
  Sparkles,
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

        // Check if user is suspended in real-time inside Layout!
        if (data.isActive === false) {
          signOut(auth).then(() => {
            clearAuth();
            router.replace("/?suspended=true");
          });
          return;
        }

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
      name: "Events & Allocations",
      href: "/dashboard/events",
      icon: CalendarDays
    },
    {
      name: "Audit Trail Logs",
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
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f6f1e5] text-neutral-900 z-50">
        <div className="size-12 rounded-full border-3 border-[#800080]/20 border-t-[#800080] animate-spin" />
        <p className="mt-6 text-sm font-semibold tracking-wide text-neutral-600 animate-pulse font-sans">
          Securing Workspace Credentials...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] text-neutral-900 flex flex-col md:flex-row relative font-sans overflow-x-hidden">
      
      {/* --- SIDEBAR PANEL (DESKTOP) --- */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-neutral-200/80 shrink-0 z-30 h-screen sticky top-0 justify-between p-4 shadow-xs">
        <div className="space-y-6">
          
          {/* Logo brand head */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="size-10 rounded-xl bg-[#800080] text-[#ffd700] font-bold flex items-center justify-center border border-[#ffd700]/30 shadow-xs shrink-0 text-sm">
              SE
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-neutral-900 uppercase leading-none truncate">
                Sterling EventOps
              </h1>
              <span className="text-[10px] text-neutral-500 font-medium">Asset Control & Logistics</span>
            </div>
          </div>

          {/* Navigation link blocks */}
          <nav className="space-y-1">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-[#800080] text-white font-medium shadow-xs"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  <Icon className={`size-4 transition-transform duration-150 ${
                    isActive ? "text-white" : "text-neutral-500"
                  }`} />
                  <span>{item.name}</span>
                </a>
              );
            })}

            {/* If superadmin, display console */}
            {showSuperadminConsole && (
              <div className="pt-3 mt-3 border-t border-neutral-200/80">
                <a
                  href="/superadmin"
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 border ${
                    pathname === "/superadmin"
                      ? "bg-purple-50 border-purple-200 text-[#800080] shadow-xs"
                      : "text-purple-700 border-purple-200/70 bg-purple-50/40 hover:bg-purple-50 hover:text-[#800080]"
                  }`}
                >
                  <ShieldAlert className="size-4 shrink-0 text-[#800080]" />
                  <span>Super Admin Console</span>
                </a>
              </div>
            )}
          </nav>
        </div>

        {/* Footer User Info & Logout Option */}
        <div className="border-t border-neutral-200/80 pt-3 space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200/60">
            <div className="size-7 rounded-full bg-purple-50 text-[#800080] border border-purple-200 flex items-center justify-center text-xs font-bold uppercase select-none shrink-0">
              {profile?.name?.substring(0, 2).toUpperCase() || "OP"}
            </div>
            <div className="text-left leading-tight min-w-0 flex-1">
              <span className="text-xs font-semibold text-neutral-900 block truncate">{profile?.name}</span>
              <span className="text-[10px] text-neutral-500 font-medium capitalize block">{profile?.role || "Staff"}</span>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full text-neutral-500 hover:text-rose-600 hover:bg-rose-50 justify-start h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <LogOut className="size-4 mr-2.5 text-neutral-400" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* --- MOBILE HEADER NAV BAR --- */}
      <header className="md:hidden flex items-center justify-between bg-white border-b border-neutral-200/80 px-6 py-3.5 z-40 sticky top-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-[#800080] text-[#ffd700] font-bold flex items-center justify-center border border-[#ffd700]/30 text-xs">
            SE
          </div>
          <div>
            <h1 className="text-xs font-bold text-neutral-900 uppercase leading-none">
              Sterling EventOps
            </h1>
            <span className="text-[9px] text-neutral-500 font-medium">Asset Control</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-neutral-600 hover:text-neutral-900 transition-colors p-1"
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </header>

      {/* --- MOBILE DRAWER SLIDER --- */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop lock */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs" 
          />
          
          <aside className="relative flex flex-col w-64 bg-white border-r border-neutral-200 p-4 h-full justify-between z-50 animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-[#800080] text-[#ffd700] font-bold flex items-center justify-center border border-[#ffd700]/30 text-xs">
                    SE
                  </div>
                  <span className="text-xs font-bold text-neutral-900 uppercase">Sterling EventOps</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="size-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {navigationItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        isActive
                          ? "bg-[#800080] text-white font-medium shadow-xs"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span>{item.name}</span>
                    </a>
                  );
                })}

                {showSuperadminConsole && (
                  <div className="pt-3 mt-3 border-t border-neutral-200">
                    <a
                      href="/superadmin"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                        pathname === "/superadmin"
                          ? "bg-purple-50 border-purple-200 text-[#800080]"
                          : "text-purple-700 border-purple-200 bg-purple-50/50 hover:bg-purple-100"
                      }`}
                    >
                      <ShieldAlert className="size-4 shrink-0 text-[#800080]" />
                      <span>Super Admin Console</span>
                    </a>
                  </div>
                )}
              </nav>
            </div>

            <div className="border-t border-neutral-200 pt-3">
              <Button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                variant="ghost"
                className="w-full text-neutral-500 hover:text-rose-600 hover:bg-rose-50 justify-start h-9 px-3 rounded-xl text-xs font-semibold"
              >
                <LogOut className="size-4 mr-2 text-neutral-400" />
                Sign Out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* --- COCKPIT MAIN WRAPPER COMPONENT --- */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* --- GLOBAL TOP NAVBAR HEADER --- */}
        <header className="sticky top-0 z-20 bg-white border-b border-neutral-200/80 px-8 py-3.5 hidden md:flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <Building className="size-4 text-neutral-400" />
            <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
              {workspaceName}
            </h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
              subscription?.plan === "enterprise"
                ? "bg-purple-50 border-purple-200 text-[#800080]"
                : subscription?.plan === "premium"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-neutral-100 border-neutral-200 text-neutral-700"
            }`}>
              {subscription?.plan || "Premium"} Plan
            </span>
          </div>

          {/* User Profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 hover:bg-neutral-100/80 transition-all cursor-pointer"
            >
              <div className="size-7 rounded-full bg-purple-50 text-[#800080] border border-purple-200 flex items-center justify-center text-xs font-bold uppercase select-none">
                {profile?.name?.substring(0, 2).toUpperCase() || "OP"}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <span className="text-xs font-bold text-neutral-900 block truncate max-w-[130px]">{profile?.name}</span>
                <span className="text-[10px] text-neutral-500 font-medium block capitalize">{profile?.role || "Staff"}</span>
              </div>
              <ChevronDown className="size-3.5 text-neutral-400 shrink-0" />
            </button>

            {dropdownOpen && (
              <>
                <div onClick={() => setDropdownOpen(false)} className="fixed inset-0 z-15" />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200/80 rounded-xl shadow-lg p-2 z-20 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2.5 border-b border-neutral-100 text-xs">
                    <span className="text-neutral-400 font-medium block">Signed in as</span>
                    <span className="text-neutral-900 font-semibold block truncate mt-0.5">{user?.email}</span>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                        profile?.role?.toLowerCase() === "admin" || profile?.role?.toLowerCase() === "superadmin"
                          ? "bg-purple-50 border-purple-200 text-[#800080]"
                          : "bg-neutral-100 border-neutral-200 text-neutral-700"
                      }`}>
                        {profile?.role || "Staff"}
                      </span>
                    </div>
                  </div>
                  <div className="p-1">
                    <Button
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      variant="ghost"
                      className="w-full text-neutral-600 hover:text-rose-600 hover:bg-rose-50 justify-start h-9 px-2.5 rounded-lg text-xs font-medium border-none cursor-pointer"
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

        {/* --- EXPIRED SUBSCRIPTION BAR OVERLAY --- */}
        {!isSubscriptionActive && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-6 py-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-4 text-amber-600 shrink-0" />
              <div className="text-xs">
                <strong className="text-neutral-900 font-bold block sm:inline">Subscription Suspended: </strong>
                <span className="text-neutral-700">Workspace operations are currently suspended. Action updates, asset creation, and scans are restricted.</span>
              </div>
            </div>
            <Button
              className="h-8 bg-[#800080] hover:bg-[#660066] text-white font-medium text-xs rounded-lg shadow-xs shrink-0 cursor-pointer"
            >
              <CreditCard className="size-3.5 mr-1.5" />
              Renew Subscription
            </Button>
          </div>
        )}

        {/* --- PAGE MAIN BODY OUTLET COMPONENT --- */}
        <main className={`flex-1 p-6 md:p-8 relative ${!isSubscriptionActive ? "pointer-events-none opacity-50 select-none cursor-not-allowed" : ""}`}>
          {children}
        </main>

      </div>
    </div>
  );
}
