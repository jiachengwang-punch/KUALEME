import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getDocs, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, Post } from './firebase';

type Notification = { id: string; fromUsername: string; fromUserId: string };
type Interactions = Map<string, { liked: boolean; commented: boolean }>;

type PostsContextType = {
  posts: Post[];
  uid: string | undefined;
  likedPostIds: Set<string>;
  closeFriendIds: Set<string>;
  friendIds: Set<string>;
  interactions: Interactions;
  notifications: Notification[];
  userProfile: { username: string } | null;
  reloadUserData: () => Promise<void>;
  setLikedPostIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setInteractions: React.Dispatch<React.SetStateAction<Interactions>>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
};

const PostsContext = createContext<PostsContextType | null>(null);

export function usePostsContext() {
  const ctx = useContext(PostsContext);
  if (!ctx) throw new Error('usePostsContext must be inside PostsProvider');
  return ctx;
}

export function PostsProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [uid, setUid] = useState<string | undefined>(undefined);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [interactions, setInteractions] = useState<Interactions>(new Map());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<{ username: string } | null>(null);
  const profileCache = useRef<Map<string, any>>(new Map());

  // Posts listener starts immediately — no auth required
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(40));
    return onSnapshot(q, async (snap) => {
      const newIds = [...new Set(snap.docs.map((d) => d.data().userId as string))]
        .filter((id) => !profileCache.current.has(id));
      await Promise.all(newIds.map(async (id) => {
        try {
          const pSnap = await getDoc(doc(db, 'users', id));
          if (pSnap.exists()) profileCache.current.set(id, { id: pSnap.id, ...pSnap.data() });
        } catch {}
      }));
      setPosts(snap.docs.map((d) => ({
        id: d.id, ...d.data(), profile: profileCache.current.get(d.data().userId),
      } as Post)));
    });
  }, []);

  // Auth listener — loads per-user data when signed in
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid);
      if (user) loadUserData(user.uid);
    });
  }, []);

  const loadUserData = async (userId: string) => {
    const [cfSnap, friendsSnap, intSnap, notifSnap, pSnap] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'closeFriends')),
      getDocs(collection(db, 'users', userId, 'friends')),
      getDocs(collection(db, 'users', userId, 'interactions')),
      getDocs(collection(db, 'users', userId, 'notifications')),
      getDoc(doc(db, 'users', userId)),
    ]);

    setCloseFriendIds(new Set(cfSnap.docs.map((d) => d.id)));
    setFriendIds(new Set(friendsSnap.docs.map((d) => d.id)));

    const map: Interactions = new Map();
    const liked = new Set<string>();
    intSnap.docs.forEach((d) => {
      const data = d.data() as any;
      map.set(d.id, { liked: !!data.hasLiked, commented: !!data.hasCommented });
      if (data.hasLiked) liked.add(d.id);
    });
    setInteractions(map);
    setLikedPostIds(liked);

    setNotifications(notifSnap.docs
      .filter((d) => !d.data().read)
      .map((d) => ({ id: d.id, fromUsername: d.data().fromUsername ?? '好友', fromUserId: d.data().fromUserId ?? '' })));

    if (pSnap.exists()) setUserProfile({ username: (pSnap.data() as any).username ?? '我' });
  };

  const reloadUserData = async () => { if (uid) await loadUserData(uid); };

  return (
    <PostsContext.Provider value={{
      posts, uid, likedPostIds, closeFriendIds, friendIds,
      interactions, notifications, userProfile,
      reloadUserData, setLikedPostIds, setInteractions, setNotifications,
    }}>
      {children}
    </PostsContext.Provider>
  );
}
