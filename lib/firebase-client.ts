import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Use a placeholder during build-time static pre-rendering (NEXT_PUBLIC_* vars
// are absent on Vercel). Firebase will error at runtime if the key is wrong,
// but AuthContext is 'use client' so it only runs in the browser where the
// real key is injected by Next.js.
const firebaseConfig = {
  apiKey:     process.env.NEXT_PUBLIC_FIREBASE_API_KEY     || 'build-placeholder',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId:  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID  || '',
  appId:      process.env.NEXT_PUBLIC_FIREBASE_APP_ID      || '',
};

const firebaseApp: FirebaseApp =
  getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

export const firebaseAuth: Auth      = getAuth(firebaseApp);
export const firebaseDb:   Firestore = getFirestore(firebaseApp);
