import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, FadeInDown } from 'react-native-reanimated';
import { collection, getDocs, orderBy, query, limit, addDoc, serverTimestamp, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { usePostsContext } from '../../lib/PostsContext';
import { Colors, Gradients } from '../../constants/theme';
import { HapticPatterns } from '../../lib/haptics';
import { Sounds } from '../../lib/audio';
import AvatarView from '../../components/AvatarView';

type Champion = {
  id: string; type: 'peak' | 'healing'; period: 'noon' | 'night';
  date: string; userId?: string; postContent?: string; commentContent?: string;
};

type LeaderEntry = {
  id: string; username: string; energyScore: number;
  avatarColors?: string[]; avatarUrl?: string;
};

const MEDALS = ['🥇', '🥈', '🥉'];

export default function ChampionsScreen() {
  const [tab, setTab] = useState<'champions' | 'leaderboard'>('champions');
  const [champions, setChampions] = useState<Champion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [showMeteor, setShowMeteor] = useState(false);
  const [torchSent, setTorchSent] = useState(false);
  const meteorOpacity = useSharedValue(0);
  const { uid } = usePostsContext();

  useEffect(() => {
    fetchChampions().then(checkAndAutoEvaluate);
  }, []);

  useEffect(() => {
    if (tab === 'leaderboard' && leaderboard.length === 0) fetchLeaderboard();
  }, [tab]);

  const fetchChampions = async () => {
    const snap = await getDocs(query(collection(db, 'champions'), orderBy('createdAt', 'desc'), limit(20)));
    setChampions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Champion)));
  };

  const fetchLeaderboard = async () => {
    setLoadingBoard(true);
    const snap = await getDocs(collection(db, 'users'));
    const list: LeaderEntry[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((u) => (u.energyScore ?? 0) > 0)
      .sort((a, b) => (b.energyScore ?? 0) - (a.energyScore ?? 0))
      .slice(0, 30);
    setLeaderboard(list);
    setLoadingBoard(false);
  };

  const evaluatePeriod = async (today: string, period: 'noon' | 'night') => {
    const [postsSnap, commentsSnap] = await Promise.all([
      getDocs(query(collection(db, 'posts'), where('tier', '==', 'starlight'), orderBy('likesCount', 'desc'), limit(1))),
      getDocs(query(collection(db, 'comments'), orderBy('sincerityScore', 'desc'), limit(1))),
    ]);
    const writes: Promise<any>[] = [];
    if (!postsSnap.empty) {
      const p = postsSnap.docs[0].data();
      writes.push(addDoc(collection(db, 'champions'), { type: 'peak', period, date: today, postContent: p.content, userId: p.userId, createdAt: serverTimestamp() }));
    }
    if (!commentsSnap.empty) {
      const c = commentsSnap.docs[0].data();
      writes.push(addDoc(collection(db, 'champions'), { type: 'healing', period, date: today, commentContent: c.content, userId: c.userId, createdAt: serverTimestamp() }));
    }
    if (writes.length > 0) {
      await Promise.all(writes);
      triggerMeteor();
      fetchChampions();
    }
  };

  // Runs on mount: checks which periods are overdue and have no record yet
  const checkAndAutoEvaluate = async () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const hour = now.getHours();

    const periods: { period: 'noon' | 'night'; triggerHour: number }[] = [
      { period: 'noon', triggerHour: 12 },
      { period: 'night', triggerHour: 22 },
    ];

    for (const { period, triggerHour } of periods) {
      if (hour < triggerHour) continue;
      // Check if this period already has a record for today
      const existing = await getDocs(query(
        collection(db, 'champions'),
        where('date', '==', today),
        where('period', '==', period),
      ));
      if (existing.empty) {
        await evaluatePeriod(today, period);
      }
    }
  };

  const passTheTorch = async () => {
    if (!uid) return;
    try {
      const snap = await getDocs(query(collection(db, 'posts'), where('tier', '==', 'glimmer'), limit(20)));
      if (snap.empty) { Alert.alert('暂无微光动态可点亮'); return; }
      const coldPost = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any))
        .sort((a, b) => (a.likesCount ?? 0) - (b.likesCount ?? 0))[0];
      await updateDoc(doc(db, 'posts', coldPost.id), { featuredBy: uid, featuredUntil: new Date(Date.now() + 15 * 60 * 1000) });
      setTorchSent(true);
      HapticPatterns.champion(); Sounds.champion();
      Alert.alert('火把已传递 ★', '这条微光动态将在广场置顶 15 分钟');
    } catch (e: any) { Alert.alert('传递失败', e.message); }
  };

  const triggerMeteor = () => {
    HapticPatterns.champion(); Sounds.champion();
    setShowMeteor(true);
    meteorOpacity.value = withSequence(withTiming(1, { duration: 400 }), withDelay(4000, withTiming(0, { duration: 600 })));
    setTimeout(() => setShowMeteor(false), 5100);
  };

  const meteorStyle = useAnimatedStyle(() => ({ opacity: meteorOpacity.value }));
  const isChampion = champions.some((c) => c.userId === uid);
  const canPassTorch = isChampion && !torchSent;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E1F0F7', '#F8FBFE', '#FFF5ED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>冠军</Text>
          <View style={styles.headerRight}>
            {canPassTorch && (
              <TouchableOpacity style={styles.torchBtn} onPress={passTheTorch}>
                <Text style={styles.torchBtnText}>传递火把 ★</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.evalBtn} onPress={checkAndAutoEvaluate}>
              <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.evalGradient}>
                <Text style={styles.evalText}>刷新评选</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* tab toggle */}
        <View style={styles.tabRow}>
          {(['champions', 'leaderboard'] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>
                {t === 'champions' ? '冠军榜' : '能量榜'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {tab === 'champions' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>每日 12:00 与 22:00 评选</Text>

          {canPassTorch && (
            <Animated.View entering={FadeInDown.duration(500)} style={styles.torchCard}>
              <LinearGradient colors={['rgba(255,209,148,0.15)', 'rgba(255,172,129,0.08)']} style={StyleSheet.absoluteFill} />
              <Text style={styles.torchCardTitle}>你是今日冠军 ★</Text>
              <Text style={styles.torchCardDesc}>点击"传递火把"，将一条冷门微光动态置顶广场 15 分钟</Text>
            </Animated.View>
          )}

          {champions.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>今日冠军尚未诞生</Text>
              <Text style={styles.emptySubText}>12:00 与 22:00 自动评选</Text>
            </View>
          )}

          {champions.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(i * 80)}>
              <View style={styles.card}>
                <LinearGradient colors={c.type === 'peak' ? Gradients.starlight : Gradients.glimmer} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBadge}>
                  <Text style={styles.badgeText}>{c.type === 'peak' ? '巅峰奖 ★' : '治愈奖 ✦'}</Text>
                </LinearGradient>
                <Text style={styles.cardDate}>{c.date} · {c.period === 'noon' ? '正午' : '夜间'}</Text>
                <Text style={styles.cardContent} numberOfLines={3}>{c.postContent ?? c.commentContent}</Text>
                {c.userId === uid && <Text style={styles.myTag}>这是你的荣耀 ★</Text>}
              </View>
            </Animated.View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.subtitle}>{loadingBoard ? '加载中...' : `共 ${leaderboard.length} 位能量者`}</Text>
          }
          renderItem={({ item, index }) => {
            const isMe = item.id === uid;
            const medal = MEDALS[index] ?? null;
            return (
              <Animated.View entering={FadeInDown.delay(index * 40)}>
                <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
                  <View style={styles.rankNum}>
                    {medal
                      ? <Text style={styles.medal}>{medal}</Text>
                      : <Text style={styles.rankNumText}>{index + 1}</Text>}
                  </View>
                  <AvatarView url={item.avatarUrl} colors={item.avatarColors} size={40} borderWidth={isMe ? 2 : 0} borderColor={Colors.primary} />
                  <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>{item.username}</Text>
                  <View style={styles.energyPill}>
                    <LinearGradient colors={index < 3 ? Gradients.starlight : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.energyPillGrad}>
                      <Text style={[styles.energyVal, index >= 3 && { color: Colors.textSecondary }]}>
                        {item.energyScore}
                      </Text>
                    </LinearGradient>
                  </View>
                </View>
              </Animated.View>
            );
          }}
        />
      )}

      {showMeteor && (
        <Animated.View style={[styles.meteorOverlay, meteorStyle]} pointerEvents="none">
          <LinearGradient colors={['rgba(255,179,71,0.9)', 'rgba(255,126,95,0.85)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.meteorTitle}>冠军诞生 ★</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '600', letterSpacing: 1 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  torchBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary, backgroundColor: 'rgba(255,179,71,0.12)' },
  torchBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
  evalBtn: { borderRadius: 16, overflow: 'hidden' },
  evalGradient: { paddingHorizontal: 16, paddingVertical: 9 },
  evalText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 4, gap: 8 },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 20, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(255,179,71,0.12)' },
  tabBtnText: { color: Colors.textMuted, fontSize: 13 },
  tabBtnTextActive: { color: Colors.primary, fontWeight: '500' },
  subtitle: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', letterSpacing: 1, marginBottom: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 70, paddingTop: 8 },
  torchCard: { borderRadius: 20, padding: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,172,129,0.3)', gap: 8 },
  torchCardTitle: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  torchCardDesc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptySubText: { color: Colors.textMuted, fontSize: 13 },
  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cardDate: { color: Colors.textMuted, fontSize: 12 },
  cardContent: { color: Colors.textPrimary, fontSize: 15, lineHeight: 24 },
  myTag: { color: Colors.primary, fontSize: 12, fontWeight: '500' },
  // leaderboard
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, marginBottom: 6 },
  rankRowMe: { backgroundColor: 'rgba(255,179,71,0.08)', borderWidth: 1, borderColor: 'rgba(255,179,71,0.25)', paddingHorizontal: 10 },
  rankNum: { width: 28, alignItems: 'center' },
  rankNumText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  medal: { fontSize: 18 },
  rankName: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
  rankNameMe: { color: Colors.primary, fontWeight: '500' },
  energyPill: { borderRadius: 20, overflow: 'hidden' },
  energyPillGrad: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  energyVal: { color: '#0A0F1E', fontSize: 13, fontWeight: '700' },
  meteorOverlay: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  meteorTitle: { color: '#fff', fontSize: 36, fontWeight: '600', letterSpacing: 4 },
});
