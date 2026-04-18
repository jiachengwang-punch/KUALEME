import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, FadeInDown } from 'react-native-reanimated';
import { collection, getDocs, orderBy, query, limit, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Colors, Gradients } from '../../constants/theme';
import { HapticPatterns } from '../../lib/haptics';
import { Sounds } from '../../lib/audio';

type Champion = {
  id: string;
  type: 'peak' | 'healing';
  period: 'noon' | 'night';
  date: string;
  postContent?: string;
  commentContent?: string;
  username?: string;
};

export default function ChampionsScreen() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [showMeteor, setShowMeteor] = useState(false);
  const meteorOpacity = useSharedValue(0);
  const now = new Date();
  const canEvaluate = now.getHours() === 12 || now.getHours() === 22;

  useEffect(() => { fetchChampions(); }, []);

  const fetchChampions = async () => {
    const snap = await getDocs(query(collection(db, 'champions'), orderBy('createdAt', 'desc'), limit(20)));
    setChampions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Champion)));
  };

  const evaluateChampions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const period = new Date().getHours() < 18 ? 'noon' : 'night';
    const since = new Date(Date.now() - 12 * 3600000).toISOString();

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

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>冠军</Text>
          {canEvaluate && (
            <TouchableOpacity style={styles.evalBtn} onPress={evaluateChampions}>
              <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.evalGradient}>
                <Text style={styles.evalText}>评选冠军 ★</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>每日 12:00 与 22:00 评选</Text>
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
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {showMeteor && (
        <Animated.View style={[styles.meteorOverlay, meteorStyle]} pointerEvents="none">
          <LinearGradient colors={['rgba(124,58,237,0.9)', 'rgba(219,39,119,0.9)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
          <Text style={styles.meteorTitle}>冠军诞生 ★</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '300', letterSpacing: 2 },
  evalBtn: { borderRadius: 16, overflow: 'hidden' },
  evalGradient: { paddingHorizontal: 16, paddingVertical: 9 },
  evalText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  subtitle: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', letterSpacing: 1, marginBottom: 24 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptySubText: { color: Colors.textMuted, fontSize: 13 },
  card: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  cardBadge: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cardDate: { color: Colors.textMuted, fontSize: 12 },
  cardContent: { color: Colors.textPrimary, fontSize: 15, lineHeight: 24 },
  meteorOverlay: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  meteorTitle: { color: '#fff', fontSize: 36, fontWeight: '300', letterSpacing: 4 },
});
