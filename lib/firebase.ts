import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

export type UserProfile = {
  id: string;
  username: string;
  avatarColors: string[];
  energyScore: number;
  createdAt: string;
};

export type Post = {
  id: string;
  userId: string;
  content: string;
  tier: 'starlight' | 'glimmer';
  keywords: string[];
  likesCount: number;
  createdAt: string;
  profile?: UserProfile;
};

export type Comment = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  sincerityScore: number;
  createdAt: string;
  profile?: UserProfile;
};
