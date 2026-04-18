import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, RefreshControl, SafeAreaView, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { collection, query, orderBy, limit, onSnapshot, getDocs, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'expo-router';
import { auth, db, Post } from '../../lib/firebase';
import { extractKeywords } from '../../lib/openai';
import PostCard from '../../components/PostCard';
import CommentsSheet from '../../components/CommentsSheet';
import { Colors, Gradients } from '../../constants/theme';

type Notification = { id: string; fromUsername: string; fromUserId: string };
type Filter = 'all' | 'starlight' | 'glimmer';

export default function PlazaScreen() {
  const router = useRouter();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
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
  const [uid, setUid] = useState<string | undefined>(undefined);
  const profileCache = useRef<Map<string, any>>(new Map());

  const posts = filter === 'all' ? allPosts : allPosts.filter((p) => p.tier === filter);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(40));
    const unsub = onSnapshot(q, async (snap) => {
      const newIds = [...new Set(snap.docs.map((d) => d.data().userId as string))]
        .filter((id) => !profileCache.current.has(id));
      await Promise.all(newIds.map(async (id) => {
        try {
          const pSnap = await getDoc(doc(db, 'users', id));
          if (pSnap.exists()) profileCache.current.set(id, { id: pSnap.id, ...pSnap.data() });
        } catch {}
      }));
      setAllPosts(snap.docs.map((d) => ({
        id: d.id, ...d.data(), profile: profileCache.current.get(d.data().userId),
      } as Post)));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid);
      if (user) loadUserData(user.uid);
    });
    return unsub;
  }, []);

  const loadUserData = async (userId: string) => {
    const [cfSnap, intSnap, notifSnap, pSnap] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'closeFriends')),
      getDocs(collection(db, 'users', userId, 'interactions')),
      getDocs(collection(db, 'users', userId, 'notifications')),
      getDoc(doc(db, 'users', userId)),
    ]);

    setCloseFriendIds(new Set(cfSnap.docs.map((d) => d.id)));

    const map = new Map<string, { liked: boolean; commented: boolean }>();
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

  const dismissNotification = async (notifId: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'notifications', notifId), { read: true });
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (uid) await loadUserData(uid);
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

    const postAuthorId = allPosts.find((p) => p.id === postId)?.userId;
    if (postAuthorId && postAuthorId !== user.uid) {
      const friendRef = doc(db, 'users', user.uid, 'friends', postAuthorId);
      const friendSnap = await getDoc(friendRef);
      if (friendSnap.exists()) await updateDoc(friendRef, { interactionScore: increment(1) });
      await updateDoc(doc(db, 'users', postAuthorId), { energyScore: increment(1) });
    }
    await updateDoc(doc(db, 'users', user.uid), { energyScore: increment(1) });

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

  const handleDelete = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (e: any) {
      Alert.alert('删除失败', e.message);
    }
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
      const fromUsername = userProfile?.username ?? '好友';
      for (const friendId of closeFriendIds) {
        try {
          await setDoc(doc(db, 'users', friendId, 'notifications', postRef.id), {
            fromUserId: user.uid, fromUsername, postId: postRef.id,
            read: false, createdAt: serverTimestamp(),
          });
        } catch {}
      }
      setNewContent('');
      setShowPublish(false);
    } catch (e: any) {
      Alert.alert('发布失败', e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E1F0F7', '#F8FBFE', '#FFF5ED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>广场</Text>
          <TouchableOpacity style={styles.publishBtn} onPress={() => setShowPublish(true)}>
            <LinearGradient colors={['#FFD194', '#FFAC81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishGradient}>
              <Text style={styles.publishBtnText}>+ 分享</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* filter tabs */}
        <View style={styles.filterRow}>
          {(['all', 'starlight', 'glimmer'] as Filter[]).map((f) => (
            <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterBtnActive]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
                {f === 'all' ? '全部' : f === 'starlight' ? '⭐ 星光' : '✨ 微光'}
              </Text>
            </TouchableOpacity>
          ))}
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
            <Animated.View entering={FadeInDown.delay(index * 40).duration(400)}>
              {isFeatured && (
                <View style={styles.featuredBanner}>
                  <LinearGradient colors={['#FFD194', '#FFAC81']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <Text style={styles.featuredText}>冠军点亮的星 ★</Text>
                </View>
              )}
              {isBlocked(item, index) ? (
                <View style={blockedCardStyle}>
                  <Text style={blockedTextStyle}>请先为前一条动态点亮并留言，才能继续浏览 TA 的内容 ✦</Text>
                </View>
              ) : (
                <PostCard
                  post={item}
                  initialLiked={likedPostIds.has(item.id)}
                  currentUserId={uid}
                  onLike={handleLike}
                  onOpenComments={(p) => setActivePost(p)}
                  onDelete={handleDelete}
                  onPressUser={(userId) => router.push(`/user/${userId}` as any)}
                />
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
  marginHorizontal: 16, marginVertical: 8, backgroundColor: 'rgba(255,172,129,0.08)',
  borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,172,129,0.25)', alignItems: 'center',
};
const blockedTextStyle: any = { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 };

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '600', letterSpacing: 1 },
  publishBtn: { borderRadius: 20, overflow: 'hidden' },
  publishGradient: { paddingHorizontal: 18, paddingVertical: 10 },
  publishBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  filterRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, gap: 8 },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(52,73,94,0.1)',
  },
  filterBtnActive: { backgroundColor: 'rgba(255,172,129,0.15)', borderColor: Colors.primary },
  filterBtnText: { color: Colors.textMuted, fontSize: 13 },
  filterBtnTextActive: { color: Colors.primary, fontWeight: '500' },
  notifBanner: {
    marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(255,172,129,0.12)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,172,129,0.3)',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  notifText: { color: Colors.primary, fontSize: 13, flex: 1 },
  notifDismiss: { color: Colors.textMuted, fontSize: 18, paddingLeft: 12 },
  list: { paddingTop: 4, paddingBottom: 70 },
  publishModal: { flex: 1, backgroundColor: '#F8FBFE', padding: 20 },
  publishHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cancelText: { color: Colors.textMuted, fontSize: 16 },
  publishTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '500' },
  sendText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  tierSelector: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tierBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(52,73,94,0.1)' },
  tierBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(255,172,129,0.12)' },
  tierBtnText: { color: Colors.textMuted, fontSize: 14 },
  tierBtnTextActive: { color: Colors.primary },
  publishInput: { flex: 1, color: Colors.textPrimary, fontSize: 17, lineHeight: 28, textAlignVertical: 'top' },
  featuredBanner: {
    marginHorizontal: 16, marginTop: 8, marginBottom: -4,
    borderRadius: 12, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 6,
  },
  featuredText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
