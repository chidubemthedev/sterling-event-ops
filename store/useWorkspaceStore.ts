import { create } from "zustand";
import { User } from "firebase/auth";

export interface Subscription {
  isActive: boolean;
  plan: string;
  validUntil: string;
}

interface WorkspaceState {
  /** The authenticated user from Firebase Auth */
  user: User | null;
  /** The active workspace identifier associated with the user */
  workspaceId: string | null;
  /** The user's active tenant subscription state */
  subscription: Subscription | null;
  /** True while the initial Auth or Profile loading is in progress */
  loading: boolean;
  
  /** Simulated subscription active state override for developer testing */
  simulatedSubscriptionActive: boolean | null;
  
  // Actions
  /** Set state after a successful login and profile resolution */
  setAuth: (user: User | null, workspaceId: string | null, subscription: Subscription | null) => void;
  /** Explicitly toggle the global loading state */
  setLoading: (loading: boolean) => void;
  /** Reset auth, workspace, and subscription states upon signout */
  clearAuth: () => void;
  /** Simulate different subscription states in development mode */
  setSimulatedSubscription: (isActive: boolean | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  user: null,
  workspaceId: null,
  subscription: null,
  loading: true,
  simulatedSubscriptionActive: null,

  setAuth: (user, workspaceId, subscription) =>
    set({
      user,
      workspaceId,
      subscription,
      loading: false,
    }),

  setLoading: (loading) => set({ loading }),

  clearAuth: () =>
    set({
      user: null,
      workspaceId: null,
      subscription: null,
      loading: false,
      simulatedSubscriptionActive: null,
    }),

  setSimulatedSubscription: (isActive) =>
    set({
      simulatedSubscriptionActive: isActive,
    }),
}));

/**
 * Custom selector hook for retrieving only the active subscription status.
 * Evaluates the real subscription or any active simulator override.
 */
export const useSubscriptionActive = () => {
  const subscription = useWorkspaceStore((state) => state.subscription);
  const simulatedActive = useWorkspaceStore((state) => state.simulatedSubscriptionActive);
  
  if (simulatedActive !== null) {
    return simulatedActive;
  }
  return subscription?.isActive ?? true;
};
