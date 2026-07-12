"use client";

import React, { useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import { useWorkspaceStore, useSubscriptionActive } from "@/store/useWorkspaceStore";
import { Button } from "@/components/ui/button";
import { 
  Lock, 
  LogOut, 
  ShieldAlert, 
  Sparkles, 
  AlertTriangle, 
  CreditCard,
  RefreshCw
} from "lucide-react";

/**
 * Safely parses the expiration date whether it is stored as:
 * - A standard plain date string ("2026-07-30")
 * - An ISO date-time string ("2026-07-30T15:00:00.000Z")
 * - A native Firebase/Firestore Timestamp object
 */
function parseExpiryDate(val: any): Date | null {
  if (!val) return null;
  
  // 1. Check if it's a Firestore Timestamp object (has .toDate or .seconds)
  if (typeof val === "object" && val !== null) {
    if (typeof val.toDate === "function") {
      return val.toDate();
    }
    if (typeof val.seconds === "number") {
      return new Date(val.seconds * 1000);
    }
  }
  
  // 2. If it is a string or number
  if (typeof val === "string") {
    // If it's a plain "YYYY-MM-DD", append T23:59:59 to make it timezone-agnostic and avoid off-by-one errors
    let formattedVal = val;
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      formattedVal = `${val}T23:59:59`;
    }
    const d = new Date(formattedVal);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }
  
  return null;
}

/**
 * Formats a Date object to standard YYYY-MM-DD plain text
 */
function formatExpiryDate(date: Date | null): string {
  if (!date) return "N/A";
  return date.toISOString().split("T")[0];
}

export function AuthListener({ children }: { children: React.ReactNode }) {
  const { 
    user, 
    workspaceId, 
    subscription, 
    loading, 
    setAuth, 
    setLoading, 
    clearAuth,
    simulatedSubscriptionActive,
    setSimulatedSubscription 
  } = useWorkspaceStore();

  const isSubscriptionActive = useSubscriptionActive();

  useEffect(() => {
    let unsubscribeWorkspace: (() => void) | null = null;

    // Listen for authentication changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (unsubscribeWorkspace) {
          unsubscribeWorkspace();
          unsubscribeWorkspace = null;
        }
        clearAuth();
        return;
      }

      setLoading(true);
      const userDocRef = doc(db, "users", currentUser.uid);

      // Real-time subscription to user document changes in Firestore
      const unsubscribeDoc = onSnapshot(
        userDocRef,
        async (userSnapshot) => {
          if (unsubscribeWorkspace) {
            unsubscribeWorkspace();
            unsubscribeWorkspace = null;
          }

          if (userSnapshot.exists()) {
            const userData = userSnapshot.data();
            const currentWorkspaceId = userData.workspaceId || null;

            if (currentWorkspaceId) {
              // Subscribe to the workspace document
              const workspaceRef = doc(db, "workspaces", currentWorkspaceId);
              unsubscribeWorkspace = onSnapshot(
                workspaceRef,
                (workspaceSnapshot) => {
                  if (workspaceSnapshot.exists()) {
                    const wsData = workspaceSnapshot.data();
                    const wsSub = wsData.subscription || {};

                    const parsedExpiry = parseExpiryDate(wsSub.validUntil);
                    const formattedExpiry = formatExpiryDate(parsedExpiry);
                    
                    // Determine active state: isActive field is true and not expired
                    const isNowActive = wsSub.isActive === true && (parsedExpiry ? parsedExpiry.getTime() > Date.now() : true);

                    setAuth(
                      currentUser,
                      currentWorkspaceId,
                      {
                        isActive: isNowActive,
                        plan: wsSub.plan || "Basic",
                        validUntil: formattedExpiry
                      }
                    );
                  } else {
                    // Workspace doc missing, use user-level subscription or default active trial fallback
                    const userSub = userData.subscription || {};
                    const parsedExpiry = parseExpiryDate(userSub.validUntil);
                    const formattedExpiry = formatExpiryDate(parsedExpiry);
                    const isNowActive = userSub.isActive === true && (parsedExpiry ? parsedExpiry.getTime() > Date.now() : true);

                    setAuth(
                      currentUser,
                      currentWorkspaceId,
                      {
                        isActive: isNowActive,
                        plan: userSub.plan || "Free",
                        validUntil: formattedExpiry
                      }
                    );
                  }
                },
                (err) => {
                  console.error("Firestore workspace profile subscription error:", err);
                  setLoading(false);
                }
              );
            } else {
              // No workspaceId in user profile, set default state
              const userSub = userData.subscription || {};
              const parsedExpiry = parseExpiryDate(userSub.validUntil);
              const formattedExpiry = formatExpiryDate(parsedExpiry);
              const isNowActive = userSub.isActive === true && (parsedExpiry ? parsedExpiry.getTime() > Date.now() : true);

              setAuth(
                currentUser,
                null,
                {
                  isActive: isNowActive,
                  plan: userSub.plan || "Free",
                  validUntil: formattedExpiry
                }
              );
            }
          } else {
            // Self-healing / Onboarding flow: Auto-create document if missing
            const defaultWorkspaceId = `workspace_${currentUser.uid.substring(0, 6)}`;
            const initialProfile = {
              workspaceId: defaultWorkspaceId,
              email: currentUser.email || "",
              subscription: {
                isActive: true,
                plan: "Developer Trial",
                validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              },
              createdAt: new Date().toISOString(),
            };

            try {
              await setDoc(userDocRef, initialProfile, { merge: true });
              setAuth(currentUser, defaultWorkspaceId, initialProfile.subscription);
            } catch (err) {
              console.error("Failed to auto-create user profile in Firestore:", err);
              setLoading(false);
            }
          }
        },
        (error) => {
          console.error("Firestore user profile subscription error:", error);
          setLoading(false);
        }
      );

      return () => {
        unsubscribeDoc();
        if (unsubscribeWorkspace) {
          unsubscribeWorkspace();
          unsubscribeWorkspace = null;
        }
      };
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeWorkspace) {
        unsubscribeWorkspace();
      }
    };
  }, [setAuth, clearAuth, setLoading]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  // If loading, render a beautiful minimal loader
  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-50">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Synchronizing Workspace Environment...
        </p>
      </div>
    );
  }

  // Determine whether the dashboard should be locked
  const isLocked = user && !isSubscriptionActive;

  return (
    <div className="relative min-h-screen flex flex-col flex-1">
      {/* RENDER SYSTEM CONTENT */}
      <div className={isLocked ? "blur-md grayscale opacity-30 pointer-events-none select-none transition-all duration-700 flex-1 flex flex-col" : "flex flex-col flex-1"}>
        {children}
      </div>

      {/* DASHBOARD BLOCKING ACCESS BANNER ALERT & LOCK OVERLAY */}
      {isLocked && (
        <div 
          className="fixed inset-0 z-50 flex flex-col transition-all duration-500 animate-in fade-in"
          style={{ contentVisibility: "auto" }}
        >
          {/* 1. CLEAN SHADCN/UI HIGH-CONTRAST BANNER ALERT */}
          <div className="w-full bg-red-950/90 border-b border-red-500/20 text-red-200 px-6 py-4 shadow-[0_4px_30px_rgba(239,68,68,0.15)] backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 shrink-0">
                <AlertTriangle className="size-5 animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-white font-heading">
                  Workspace Access Locked — Subscription Suspended
                </h3>
                <p className="text-xs text-red-300/80 mt-0.5 max-w-2xl">
                  Operational features for workspace <code className="px-1 py-0.5 rounded bg-red-950/40 text-red-100 text-xs font-mono">{workspaceId}</code> are restricted because your subscription plan <strong className="text-white font-semibold">"{subscription?.plan}"</strong> expired on {subscription?.validUntil}.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 self-end md:self-center">
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="h-9 border-red-500/20 bg-red-950/20 text-red-200 hover:bg-red-500/10 hover:text-white"
              >
                <LogOut className="size-4 mr-1.5" />
                Sign Out
              </Button>
              <Button 
                className="h-9 bg-red-600 text-white font-semibold hover:bg-red-500 shadow-lg shadow-red-600/15"
              >
                <CreditCard className="size-4 mr-1.5" />
                Reactivate Plan
              </Button>
            </div>
          </div>

          {/* 2. TRANSPARENT SCREEN LOCKOUT SENSORY INTERACTION BLOCK */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="relative max-w-sm w-full bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-6 text-center shadow-xl backdrop-blur-sm animate-in zoom-in-95 duration-300">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 to-amber-500" />
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 mx-auto mb-4 animate-pulse">
                <Lock className="size-6" />
              </div>
              <h4 className="text-base font-semibold text-white font-heading">
                Operational Functions Disabled
              </h4>
              <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                All Firebase queries, mutations, and scan actions are securely locked down for security compliance. To bypass this for development, toggle the mode below.
              </p>

              {/* Simulation Restore Option */}
              {simulatedSubscriptionActive !== null && (
                <div className="mt-4 pt-4 border-t border-zinc-800/40 flex items-center justify-between text-xs text-amber-500">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5" />
                    <span>Demo Mode Simulated</span>
                  </div>
                  <button 
                    onClick={() => setSimulatedSubscription(null)}
                    className="underline hover:text-amber-400 font-semibold cursor-pointer"
                  >
                    Restore Original
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
