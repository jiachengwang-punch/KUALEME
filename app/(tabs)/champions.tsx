import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, FadeInDown } from 'react-native-reanimated';
import { collection, getDocs, orderBy, query, limit, addDoc, serverTimestamp, where, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Colors, Gradients } from '../../constants/theme';
import { HapticPatterns } from '../../lib/haptics';
import { Sounds } from '../../lib/audio';

type Champion = {
  id: string;
  type: 'peak' | 'healing';
  period: 'noon' | 'night';
  date: string;
  userId?: string;
  postContent?: string;
  commentContent?: string;
};

export default function ChampionsScreen() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [showMeteor, setShowMeteor] = useState(false);
  const [torchSent, setTorchSent] = useState(false);
  const meteorOpacity = useSharedValue(0);
  const now = new Date();
  const canEvaluate = now.getHours() === 12 || now.getHours() === 22;
  const uid = auth.currentUser?.uid;

  useEffect(() => { fetchChampions(); }, []);

  const fetchChampions = async () => {
    const snap = await getDocs(query(collection(db, 'champions'), orderBy('createdAt', 'desc'), limit(20)));
    setChampions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Champion)));
  };

  const evaluateChampions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const period = new Date().getHours() < 18 ? 'noon' : 'night';

    const postsSnap = await getDocs(query(collection(db, 'posts'), where('tier', '==', 'starlight'), orderBy('likesCount', 'desc'), limit(1)));
    const commentsSnap = await getDocs(query(collection(db, 'comments'), orderBy('sincerityScore', 'desc'), limit(1)));

    if (!postsSnap.empty) {
      const p = postsSnap.docs[0].data();
      await addDoc(collection(db, 'champions'), {
        type: 'peak', period, date: today, postContent: p.content,
        userId: p.userId, createdAt: serverTimestamp(),
      });
    }
    if (!commentsSnap.empty) {
      const c = commentsSnap.docs[0].data();
      await addDoc(collection(db, 'champions'), {
        type: 'healing', period, date: today, commentContent: c.content,
        userId: c.userId, createdAt: serverTimestamp(),
      });
    }

    triggerMeteor();
    fetchChampions();
  };

  const passTheTorch = async () => {
    if (!uid) return;
    try {
      // find a cold glimmer post (low likes)
      const snap = await getDocs(query(collection(db, 'posts'), where('tier', '==', 'glimmer'), limit(20)));
      if (snap.empty) { Alert.alert('暂无微光动态可点亮'); return; }
      const coldPost = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .sort((a: any, b: any) => (a.likesCount ?? 0) - (b.likesCount ?? 0))[0];
      const featuredUntil = new Date(Date.now() + 15 * 60 * 1000);
      await updateDoc(doc(db, 'posts', coldPost.id), {
        featuredBy: uid,
        featuredUntil,
      });
      setTorchSent(true);
      HapticPatterns.champion();
      Sounds.champion();
      Alert.alert('火把已传递 ★', '这条微光动态将在广场置顶 15 分钟');
    } catch (e: any) {
      Alert.alert('传递失败', e.message);
    }
  };

  const triggerMeteor = () => {
    HapticPatterns.champion();
    Sounds.champion();
    setShowMeteor(true);
    meteorOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withDelay(4000, withTiming(0, { duration: 600 }))
    );
    setTimeout(() => setShowMeteor(false), 5100);
  };

  const meteorStyle = useAnimatedStyle(() => ({ opacity: meteorOpacity.value }));

  // check if current user is a recent champion (within last 12h)
  const cutoff = Date.now() - 12 * 3600 * 1000;
  const isChampion = champions.some((c) => c.userId === uid);
  const canPassTorch = isChampion && !torchSent;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0F1E', '#161B2D']} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>冠军</Text>
          <View style={styles.headerRight}>
            {canPassTorch && (
              <TouchableOpacity style={styles.torchBtn} onPress={passTheTorch}>
                <Text style={styles.torchBtnText}>传递火把 ★</Text>
              </TouchableOpacity>
            )}
            {canEvaluate && (
              <TouchableOpacity style={styles.evalBtn} onPress={evaluateChampions}>
                <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.evalGradient}>
                  <Text style={styles.evalText}>评选冠军</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>每日 12:00 与 22:00 评选</Text>

        {canPassTorch && (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.torchCard}>
            <LinearGradient colors={['rgba(255,179,71,0.12)', 'rgba(255,126,95,0.08)']} style={StyleSheet.absoluteFill} />
            <Text style={styles.torchCardTitle}>你是今日冠军 ★</Text>
            <Text style={styles.torchCardDesc}>点击"传递火把"，将一条冷门微光动态置顶广场 15 分钟，让更多人看见它的光</Text>
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
              <LinearGradient
                colors={c.type === 'peak' ? Gradients.starlight : Gradients.glimmer}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBadge}
              >
                <Text style={styles.badgeText}>{c.type === 'peak' ? '巅峰奖 ★' : '治愈奖 ✦'}</Text>
              </LinearGradient>
              <Text style={styles.cardDate}>{c.date} · {c.period === 'noon' ? '正午' : '夜间'}</Text>
              <Text style={styles.cardContent} numberOfLines={3}>
                {c.postContent ?? c.commentContent}
              </Text>
              {c.userId === uid && <Text style={styles.myChampionTag}>这是你的荣耀 ★</Text>}
            </View>
          </Animated.View>
        ))}
      </ScrollView>

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
  torchBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: Colors.primary, backgroundColor: 'rgba(255,179,71,0.12)',
  },
  torchBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
  evalBtn: { borderRadius: 16, overflow: 'hidden' },
  evalGradient: { paddingHorizontal: 16, paddingVertical: 9 },
  evalText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  subtitle: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', letterSpacing: 1, marginBottom: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 70, paddingTop: 8 },
  torchCard: {
    borderRadius: 20, padding: 20, marginBottom: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,179,71,0.3)', gap: 8,
  },
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
  myChampionTag: { color: Colors.primary, fontSize: 12, fontWeight: '500' },
  meteorOverlay: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  meteorTitle: { color: '#fff', fontSize: 36, fontWeight: '600', letterSpacing: 4 },
});
