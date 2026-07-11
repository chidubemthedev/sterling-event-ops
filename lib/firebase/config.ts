import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  Firestore 
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// During Next.js production builds, static pages are compiled on the server
// where real client environment variables might be absent.
// We use placeholder values that are syntactically valid (e.g. starting with AIzaSy)
// to prevent Firebase from crashing during static site generation (SSG/prerendering).
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForNextjsBuildPrerendering",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "sterling-event-ops.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "sterling-event-ops",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "sterling-event-ops.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789012",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789012:web:1234567890abcdef",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-ABCDEFGHIJ",
};

// Check if we are running in the browser (client-side)
const isClient = typeof window !== "undefined";

// Helper to log environment warnings if config is missing
if (isClient && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
  console.warn(
    "⚠️ Firebase configuration environment variables are missing. " +
    "Please populate NEXT_PUBLIC_FIREBASE_* in your .env.local file. " +
    "The application is currently running with fallback dummy configuration."
  );
}

// Initialize Firebase App
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Firebase Auth
const auth: Auth = getAuth(app);

// Initialize Firestore with Offline Persistence (Persistent Cache & Multi-Tab synchronization)
let db: Firestore;
if (isClient) {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} else {
  // Server-side initialization doesn't use local cache persistence
  db = initializeFirestore(app, {});
}

// Initialize Firebase Storage
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
export default app;
