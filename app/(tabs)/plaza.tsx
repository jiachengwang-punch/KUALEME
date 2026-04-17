import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Post } from '../../lib/supabase';
import { extractKeywords } from '../../lib/openai';
import PostCard from '../../components/PostCard';
import CommentModal from '../../components/CommentModal';
import { Colors, Gradients } from '../../constants/theme';

export default function PlazaScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [interactions, setInteractions] = useState<Map<string, { liked: boolean; commented: boolean }>>(new Map());
  const [blockedPostId, setBlockedPostId] = useState<string | null>(null);
  const [newTier, setNewTier] = useState<'starlight' | 'glimmer'>('glimmer');
  const [publishing, setPublishing] = useState(false);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(id, username, avatar_colors)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (data) setPosts(data as Post[]);
  }, []);

  useEffect(() => {
    fetchPosts().finally(() => setLoading(false));
    loadCloseFriends();
  }, []);

  const loadCloseFriends = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('close_friends').select('friend_id').eq('user_id', user.id);
    if (data) setCloseFriendIds(new Set(data.map((cf: any) => cf.friend_id)));
    const { data: ints } = await supabase.from('interactions').select('post_id, has_liked, has_commented').eq('user_id', user.id);
    if (ints) {
      const map = new Map<string, { liked: boolean; commented: boolean }>();
      ints.forEach((i: any) => map.set(i.post_id, { liked: i.has_liked, commented: i.has_commented }));
      setInteractions(map);
    }
  };

  const isBlocked = (post: Post, index: number): boolean => {
    if (!closeFriendIds.has(post.user_id)) return false;
    const prevPosts = posts.slice(0, index).filter(p => p.user_id === post.user_id);
    if (prevPosts.length === 0) return false;
    return prevPosts.some(p => {
      const int = interactions.get(p.id);
      return !int?.liked || !int?.commented;
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  const handleLit = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
    await supabase.rpc('increment_likes', { post_id: postId });

    await supabase.from('interactions').upsert(
      { user_id: user.id, post_id: postId, has_liked: true },
      { onConflict: 'user_id,post_id' }
    );

    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
    setInteractions((prev) => {
      const next = new Map(prev);
      next.set(postId, { liked: true, commented: prev.get(postId)?.commented ?? false });
      return next;
    });
  };

  const handleComment = async (text: string, score: number) => {
    if (!activePost) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('comments').insert({
      post_id: activePost.id, user_id: user.id, content: text, sincerity_score: score,
    });

    await supabase.from('interactions').upsert(
      { user_id: user.id, post_id: activePost.id, has_commented: true },
      { onConflict: 'user_id,post_id' }
    );

    setInteractions((prev) => {
      const next = new Map(prev);
      next.set(activePost.id, { liked: prev.get(activePost.id)?.liked ?? false, commented: true });
      return next;
    });
  };

  const handlePublish = async () => {
    if (!newContent.trim()) return;
    setPublishing(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPublishing(false); return; }

    const keywords = await extractKeywords(newContent);

    const { error } = await supabase.from('posts').insert({
      user_id: user.id,
      content: newContent,
      tier: newTier,
      keywords,
      likes_count: 0,
    });

    if (error) {
      Alert.alert('发布失败', error.message);
    } else {
      setNewContent('');
      setShowPublish(false);
      await fetchPosts();
    }
    setPublishing(false);
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
              <PostCard post={item} onLit={handleLit} onComment={(p) => setActivePost(p)} />
            )}
          </Animated.View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <CommentModal
        visible={!!activePost}
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
              <Text style={[styles.sendText, publishing && { opacity: 0.4 }]}>
                {publishing ? '发布中...' : '发布'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tierSelector}>
            {(['starlight', 'glimmer'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tierBtn, newTier === t && styles.tierBtnActive]}
                onPress={() => setNewTier(t)}
              >
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
  borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)',
  alignItems: 'center',
};
const blockedTextStyle: any = {
  color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
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
  tierBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 16, alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  tierBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(192,132,252,0.12)' },
  tierBtnText: { color: Colors.textMuted, fontSize: 14 },
  tierBtnTextActive: { color: Colors.primary },
  publishInput: {
    flex: 1, color: Colors.textPrimary, fontSize: 17, lineHeight: 28,
    textAlignVertical: 'top',
  },
});
