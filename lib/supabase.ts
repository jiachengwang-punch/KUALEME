import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  username: string;
  avatar_colors: string[];
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  tier: 'starlight' | 'glimmer';
  keywords: string[];
  likes_count: number;
  created_at: string;
  profiles?: Profile;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  sincerity_score: number;
  created_at: string;
  profiles?: Profile;
};
