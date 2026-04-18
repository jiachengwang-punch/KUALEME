import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Alert, RefreshControl, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { collection, query, orderBy, limit, getDocs, addDoc, doc, updateDoc, increment, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, Post } from '../../lib/firebase';
import { extractKeywords } from '../../lib/openai';
import PostCard from '../../components/PostCard';
import CommentModal from '../../components/CommentModal';
import { Colors, Gradients } from '../../constants/theme';
import { TextInput } from 'react-native';

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

  useEffect(() => {
    const init = async () => {
      await loadUserData();
      await fetchPosts();
      setLoading(false);
    };
    init();
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

  const loadUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const cfSnap = await getDocs(collection(db, 'users', user.uid, 'closeFriends'));
    setCloseFriendIds(new Set(cfSnap.docs.map((d) => d.id)));
    const intSnap = await getDocs(collection(db, 'users', user.uid, 'interactions'));
    const map = new Map<string, { liked: boolean; commented: boolean }>();
    const liked = new Set<string>();
    intSnap.docs.forEach((d) => {
      const data = d.data() as any;
      map.set(d.id, { liked: !!data.hasLiked, commented: !!data.hasCommented });
      if (data.hasLiked) liked.add(d.id);
    });
    setInteractions(map);
    setLikedPostIds(liked);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserData(), fetchPosts()]);
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
    await setDoc(doc(db, 'likes', `${user.uid}_${postId}`), { userId: user.uid, postId, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'posts', postId), { likesCount: increment(1) });
    await setDoc(doc(db, 'users', user.uid, 'interactions', postId), { hasLiked: true }, { merge: true });
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
      await addDoc(collection(db, 'posts'), {
        userId: user.uid, content: newContent, tier: newTier,
        keywords, likesCount: 0, createdAt: serverTimestamp(),
      });
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
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>广场</Text>
          <TouchableOpacity style={styles.publishBtn} onPress={() => setShowPublish(true)}>
            <LinearGradient colors={['#7C3AED', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.publishGradient}>
              <Text style={styles.publishBtnText}>+ 分享</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).duration(400)}>
            {isBlocked(item, index) ? (
              <View style={blockedCardStyle}>
                <Text style={blockedTextStyle}>请先为前一条动态点亮并留言，才能继续浏览 TA 的内容 ✦</Text>
              </View>
            ) : (
              <PostCard post={item} initialLiked={likedPostIds.has(item.id)} onLike={handleLike} onComment={(p) => setActivePost(p)} />
            )}
          </Animated.View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <CommentModal visible={!!activePost} onClose={() => setActivePost(null)} onSubmit={handleComment} />

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
  marginHorizontal: 16, marginVertical: 8, backgroundColor: 'rgba(192,132,252,0.07)',
  borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)', alignItems: 'center',
};
const blockedTextStyle: any = { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 28, fontWeight: '300', letterSpacing: 2 },
  publishBtn: { borderRadius: 20, overflow: 'hidden' },
  publishGradient: { paddingHorizontal: 18, paddingVertical: 10 },
  publishBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  list: { paddingTop: 8, paddingBottom: 120 },
  publishModal: { flex: 1, backgroundColor: Colors.bg, padding: 20 },
  publishHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  cancelText: { color: Colors.textMuted, fontSize: 16 },
  publishTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '500' },
  sendText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  tierSelector: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tierBtn: { flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tierBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(192,132,252,0.12)' },
  tierBtnText: { color: Colors.textMuted, fontSize: 14 },
  tierBtnTextActive: { color: Colors.primary },
  publishInput: { flex: 1, color: Colors.textPrimary, fontSize: 17, lineHeight: 28, textAlignVertical: 'top' },
});
