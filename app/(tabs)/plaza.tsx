import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, RefreshControl, SafeAreaView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, Post } from '../../lib/firebase';
import { extractKeywords } from '../../lib/openai';
import PostCard from '../../components/PostCard';
import CommentsSheet from '../../components/CommentsSheet';
import { Colors, Gradients } from '../../constants/theme';

type Notification = { id: string; fromUsername: string; fromUserId: string };

export default function PlazaScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTier, setNewTier] = useState<'starlight' | 'glimmer'>('glimmer');
  const [publishing, setPublishing] = useState(false);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [interactions, setInteractions] = useState<Map<string, { liked: boolean; commented: boolean }>>(new Map());
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userProfile, setUserProfile] = useState<{ username: string } | null>(null);

  useEffect(() => {
    fetchPosts();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) loadUserData(user.uid);
    });
    return unsub;
  }, []);

  const fetchPosts = useCallback(async () => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30));
    const snap = await getDocs(q);
    const items: Post[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      let profile;
      try {
        const pSnap = await getDoc(doc(db, 'users', data.userId));
        if (pSnap.exists()) profile = { id: pSnap.id, ...pSnap.data() } as any;
      } catch {}
      items.push({ id: d.id, ...data, profile } as Post);
    }
    setPosts(items);
  }, []);

  const loadUserData = async (uid: string) => {
    const cfSnap = await getDocs(collection(db, 'users', uid, 'closeFriends'));
    setCloseFriendIds(new Set(cfSnap.docs.map((d) => d.id)));

    const intSnap = await getDocs(collection(db, 'users', uid, 'interactions'));
    const map = new Map<string, { liked: boolean; commented: boolean }>();
    const liked = new Set<string>();
    intSnap.docs.forEach((d) => {
      const data = d.data() as any;
      map.set(d.id, { liked: !!data.hasLiked, commented: !!data.hasCommented });
      if (data.hasLiked) liked.add(d.id);
    });
    setInteractions(map);
    setLikedPostIds(liked);

    // load unread notifications
    const notifSnap = await getDocs(collection(db, 'users', uid, 'notifications'));
    const unread: Notification[] = notifSnap.docs
      .filter((d) => !d.data().read)
      .map((d) => ({ id: d.id, fromUsername: d.data().fromUsername ?? '好友', fromUserId: d.data().fromUserId ?? '' }));
    setNotifications(unread);

    // load own profile for publish notifications
    const pSnap = await getDoc(doc(db, 'users', uid));
    if (pSnap.exists()) setUserProfile({ username: (pSnap.data() as any).username ?? '我' });

    setLoading(false);
  };

  const dismissNotification = async (notifId: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true });
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const uid = auth.currentUser?.uid;
    await Promise.all([uid ? loadUserData(uid) : Promise.resolve(), fetchPosts()]);
    setRefreshing(false);
  };

  const isBlocked = (post: Post, index: number): boolean => {
    if (!closeFriendIds.has(post.userId)) return false;
    const prevPosts = posts.slice(0, index).filter((p) => p.userId === post.userId);
    if (prevPosts.length === 0) return false;
    return prevPosts.some((p) => {
      const int = interactions.get(p.id);
      return !int?.liked || !int?.commented;
    });
  };

  const handleLike = async (postId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    if (likedPostIds.has(postId)) return;
    const likeRef = doc(db, 'likes', `${user.uid}_${postId}`);
    const existing = await getDoc(likeRef);
    if (existing.exists()) return;
    await setDoc(likeRef, { userId: user.uid, postId, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
    await setDoc(doc(db, 'users', user.uid, 'interactions', postId), { hasLiked: true }, { merge: true });

    // increment friend interaction score + energy for both
    const postAuthorId = posts.find((p) => p.id === postId)?.userId;
    if (postAuthorId && postAuthorId !== user.uid) {
      const friendRef = doc(db, 'users', user.uid, 'friends', postAuthorId);
      const friendSnap = await getDoc(friendRef);
      if (friendSnap.exists()) {
        await updateDoc(friendRef, { interactionScore: increment(1) });
      }
      await updateDoc(doc(db, 'users', postAuthorId), { energyScore: increment(1) });
    }
    await updateDoc(doc(db, 'users', user.uid), { energyScore: increment(1) });

    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likesCount: (p.likesCount ?? 0) + 1 } : p));
    setLikedPostIds((prev) => new Set([...prev, postId]));
    setInteractions((prev) => {
      const next = new Map(prev);
      next.set(postId, { liked: true, commented: prev.get(postId)?.commented ?? false });
      return next;
    });
  };

  const handleComment = async (text: string, score: number) => {
    if (!activePost) return;
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, 'comments'), {
      postId: activePost.id, userId: user.uid, content: text,
      sincerityScore: score, createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'users', user.uid, 'interactions', activePost.id), { hasCommented: true }, { merge: true });
    // energy: +2 for high sincerity (≥85), +1 otherwise
    const pts = score >= 85 ? 2 : 1;
    await updateDoc(doc(db, 'users', user.uid), { energyScore: increment(pts) });
    if (activePost.userId !== user.uid) {
      await updateDoc(doc(db, 'users', activePost.userId), { energyScore: increment(pts) });
    }
    setInteractions((prev) => {
      const next = new Map(prev);
      next.set(activePost.id, { liked: prev.get(activePost.id)?.liked ?? false, commented: true });
      return next;
    });
  };

  const handlePublish = async () => {
    if (!newContent.trim()) return;
    setPublishing(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      let keywords: string[] = [];
      try { keywords = await extractKeywords(newContent); } catch {}
      const postRef = await addDoc(collection(db, 'posts'), {
        userId: user.uid, content: newContent, tier: newTier,
        keywords, likesCount: 0, createdAt: serverTimestamp(),
      });
      // notify close friends
      const fromUsername = userProfile?.username ?? '好友';
      for (const friendId of closeFriendIds) {
        try {
          await setDoc(doc(db, 'users', friendId, 'notifications', postRef.id), {
            fromUserId: user.uid,
            fromUsername,
            postId: postRef.id,
            read: false,
            createdAt: serverTimestamp(),
          });
        } catch {}
      }
      setNewContent('');
      setShowPublish(false);
      fetchPosts();
    } catch (e: any) {
      Alert.alert('发布失败', e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0F1E', '#161B2D']} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>广场</Text>
          <TouchableOpacity style={styles.publishBtn} onPress={() => setShowPublish(true)}>
            <LinearGradient colors={['#FFB347', '#FFCC33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishGradient}>
              <Text style={styles.publishBtnText}>+ 分享</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {notifications.length > 0 && (
        <Animated.View entering={FadeInUp.duration(400)} style={styles.notifBanner}>
          <Text style={styles.notifText}>
            {notifications[0].fromUsername} 刚分享了闪光时刻
            {notifications.length > 1 ? ` 等 ${notifications.length} 条` : ''}
          </Text>
          <TouchableOpacity onPress={() => dismissNotification(notifications[0].id)}>
            <Text style={styles.notifDismiss}>×</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isFeatured = item.featuredUntil && item.featuredUntil.toDate
            ? item.featuredUntil.toDate() > new Date()
            : false;
          return (
            <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
              {isFeatured && (
                <View style={styles.featuredBanner}>
                  <LinearGradient colors={['#FFB347', '#FFCC33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <Text style={styles.featuredText}>冠军点亮的星 ★</Text>
                </View>
              )}
              {isBlocked(item, index) ? (
                <View style={blockedCardStyle}>
                  <Text style={blockedTextStyle}>请先为前一条动态点亮并留言，才能继续浏览 TA 的内容 ✦</Text>
                </View>
              ) : (
                <PostCard post={item} initialLiked={likedPostIds.has(item.id)} onLike={handleLike} onOpenComments={(p) => setActivePost(p)} />
              )}
            </Animated.View>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <CommentsSheet
        visible={!!activePost}
        postId={activePost?.id ?? ''}
        postContent={activePost?.content ?? ''}
        onClose={() => setActivePost(null)}
        onSubmit={handleComment}
      />

      <Modal visible={showPublish} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.publishModal}>
          <View style={styles.publishHeader}>
            <TouchableOpacity onPress={() => setShowPublish(false)}>
              <Text style={styles.cancelText}>取消</Text>
            </TouchableOpacity>
            <Text style={styles.publishTitle}>分享闪光时刻</Text>
            <TouchableOpacity onPress={handlePublish} disabled={publishing}>
              <Text style={[styles.sendText, publishing && { opacity: 0.4 }]}>{publishing ? '发布中...' : '发布'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tierSelector}>
            {(['starlight', 'glimmer'] as const).map((t) => (
              <TouchableOpacity key={t} style={[styles.tierBtn, newTier === t && styles.tierBtnActive]} onPress={() => setNewTier(t)}>
                <Text style={[styles.tierBtnText, newTier === t && styles.tierBtnTextActive]}>
                  {t === 'starlight' ? '⭐ 星光' : '✨ 微光'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.publishInput}
            multiline
            placeholder={newTier === 'starlight' ? '分享一个重大成就...' : '分享一个生活小确幸...'}
            placeholderTextColor={Colors.textMuted}
            value={newContent}
            onChangeText={setNewContent}
            autoFocus
          />
        </View>
      </Modal>
    </View>
  );
}

const blockedCardStyle: any = {
  marginHorizontal: 16, marginVertical: 8, backgroundColor: 'rgba(255,179,71,0.06)',
  borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,179,71,0.15)', alignItems: 'center',
};
const blockedTextStyle: any = { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '600', letterSpacing: 1 },
  publishBtn: { borderRadius: 20, overflow: 'hidden' },
  publishGradient: { paddingHorizontal: 18, paddingVertical: 10 },
  publishBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  notifBanner: {
    marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(255,179,71,0.12)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,179,71,0.3)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  notifText: { color: Colors.primary, fontSize: 13, flex: 1 },
  notifDismiss: { color: Colors.textMuted, fontSize: 18, paddingLeft: 12 },
  list: { paddingTop: 4, paddingBottom: 120 },
  publishModal: { flex: 1, backgroundColor: '#0A0F1E', padding: 20 },
  publishHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cancelText: { color: Colors.textMuted, fontSize: 16 },
  publishTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '500' },
  sendText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  tierSelector: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tierBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tierBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(255,179,71,0.12)' },
  tierBtnText: { color: Colors.textMuted, fontSize: 14 },
  tierBtnTextActive: { color: Colors.primary },
  publishInput: { flex: 1, color: Colors.textPrimary, fontSize: 17, lineHeight: 28, textAlignVertical: 'top' },
  featuredBanner: {
    marginHorizontal: 16, marginTop: 8, marginBottom: -4,
    borderRadius: 12, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6,
  },
  featuredText: { color: '#0A0F1E', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
