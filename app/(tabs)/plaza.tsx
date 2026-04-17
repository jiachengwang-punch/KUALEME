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
  }, []);

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

    setPosts((prev) =>
      prev.map((p) => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p)
    );
  };

  const handleComment = async (text: string, score: number) => {
    if (!activePost) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('comments').insert({
      post_id: activePost.id,
      user_id: user.id,
      content: text,
      sincerity_score: score,
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
            <PostCard post={item} onLit={handleLit} onComment={(p) => setActivePost(p)} />
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
