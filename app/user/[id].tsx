import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, orderBy, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, UserProfile, Post } from '../../lib/firebase';
import { Colors, Gradients, Shadow, Layout, Typography } from '../../constants/theme';
import AvatarView from '../../components/AvatarView';

const ACHIEVEMENTS = [
  { min: 500, label: '宇宙先锋', icon: '✺' },
  { min: 200, label: '能量守护者', icon: '★' },
  { min: 80, label: '星光探索者', icon: '⭐' },
  { min: 20, label: '微光使者', icon: '✦' },
  { min: 0, label: '初升之星', icon: '☆' },
];
function getAchievement(score: number) {
  return ACHIEVEMENTS.find((a) => score >= a.min) ?? ACHIEVEMENTS[ACHIEVEMENTS.length - 1];
}

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const isSelf = uid === id;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (id) loadProfile();
  }, [id, uid]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const [pSnap, postsSnap] = await Promise.all([
        getDoc(doc(db, 'users', id)),
        getDocs(query(collection(db, 'posts'), where('userId', '==', id), orderBy('createdAt', 'desc'))),
      ]);

      if (pSnap.exists()) setProfile({ id: pSnap.id, ...pSnap.data() } as UserProfile);

      setPosts(postsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Post)));

      if (uid && !isSelf) {
        const friendSnap = await getDoc(doc(db, 'users', uid, 'friends', id));
        setIsFriend(friendSnap.exists());
        if (!friendSnap.exists()) {
          const reqSnap = await getDoc(doc(db, 'users', id, 'friendRequests', uid));
          setRequestSent(reqSnap.exists());
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!uid) return;
    try {
      await setDoc(doc(db, 'users', id, 'friendRequests', uid), {
        status: 'pending', createdAt: serverTimestamp(),
      });
      setRequestSent(true);
      Alert.alert('已发送', '好友请求已发出');
    } catch (e: any) {
      Alert.alert('发送失败', e.message);
    }
  };

  const avatarColors = (profile?.avatarColors ?? ['#FFD194', '#FFAC81', '#AED6F1']) as [string, string, string];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E1F0F7', '#F8FBFE', '#FFF5ED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ 返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={styles.loadingText}>加载中...</Text>
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(500)} style={styles.profileCard}>
              <LinearGradient colors={['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill} />
              <AvatarView url={profile?.avatarUrl} colors={avatarColors} size={88} borderWidth={2} borderColor={Colors.primary} />
              <Text style={styles.username}>{profile?.username ?? '未知用户'}</Text>
              <Text style={styles.energy}>能量值 {profile?.energyScore ?? 0}</Text>
              {(() => { const a = getAchievement(profile?.energyScore ?? 0); return (
                <View style={styles.achBadge}>
                  <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <Text style={styles.achText}>{a.icon} {a.label}</Text>
                </View>
              ); })()}

              {!isSelf && (
                <TouchableOpacity
                  style={[styles.addBtn, (isFriend || requestSent) && styles.addBtnDone]}
                  onPress={isFriend || requestSent ? undefined : sendRequest}
                >
                  <Text style={[styles.addBtnText, (isFriend || requestSent) && styles.addBtnTextDone]}>
                    {isFriend ? '已是好友 ✦' : requestSent ? '请求已发出' : '+ 加为好友'}
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            <Text style={styles.sectionTitle}>TA 的动态 ({posts.length})</Text>

            {posts.length === 0 && (
              <Text style={styles.emptyText}>还没有发布任何动态</Text>
            )}

            {posts.map((post, i) => {
              const isStarlight = post.tier === 'starlight';
              return (
                <Animated.View key={post.id} entering={FadeInDown.delay(i * 60)} style={[styles.postCard, Shadow.card]}>
                  <View style={styles.postBadge}>
                    <LinearGradient
                      colors={isStarlight ? Gradients.starlight : Gradients.glimmer}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.postBadgeText}>{isStarlight ? '⭐ 星光' : '✨ 微光'}</Text>
                  </View>
                  <Text style={styles.postContent}>{post.content}</Text>
                  <Text style={styles.postLikes}>♥ {post.likesCount ?? 0}</Text>
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: Colors.primary, fontSize: 17, fontWeight: '500' },
  scroll: { paddingHorizontal: 20, paddingBottom: 70, paddingTop: 8 },
  loadingText: { color: Colors.textMuted, textAlign: 'center', marginTop: 60 },
  profileCard: {
    borderRadius: 24, padding: 28, alignItems: 'center', gap: 10,
    overflow: 'hidden', marginBottom: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#D1E1E9', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 6,
  },
  username: { color: Colors.textPrimary, fontSize: 22, fontWeight: '600', letterSpacing: 0.5 },
  energy: { color: Colors.primary, fontSize: 13 },
  achBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5, overflow: 'hidden' },
  achText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  addBtn: {
    marginTop: 6, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 20, backgroundColor: Colors.primary,
  },
  addBtnDone: { backgroundColor: 'rgba(52,73,94,0.06)', borderWidth: 1, borderColor: 'rgba(52,73,94,0.12)' },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  addBtnTextDone: { color: Colors.textMuted },
  sectionTitle: { color: Colors.textSecondary, fontSize: 13, letterSpacing: 1, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 20 },
  postCard: {
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: Layout.cardRadius,
    padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', gap: 10,
  },
  postBadge: {
    alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 5, overflow: 'hidden',
  },
  postBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  postContent: { color: Colors.textBody, fontSize: 15, lineHeight: 24 },
  postLikes: { color: Colors.textMuted, fontSize: 12 },
});
