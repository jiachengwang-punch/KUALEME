import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSequence, withRepeat, FadeInDown, Easing,
} from 'react-native-reanimated';
import { supabase, Post, Comment } from '../../lib/supabase';
import { Colors, Gradients } from '../../constants/theme';

type Champion = {
  id: string;
  type: 'peak' | 'healing';
  period: 'noon' | 'night';
  date: string;
  post?: Post;
  comment?: Comment & { posts?: Post };
};

export default function ChampionsScreen() {
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMeteor, setShowMeteor] = useState(false);
  const meteorOpacity = useSharedValue(0);
  const now = new Date();
  const canEvaluate = now.getHours() === 12 || now.getHours() === 22;

  useEffect(() => {
    fetchChampions();
  }, []);

  const fetchChampions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('champions')
      .select('*, posts(*, profiles(username, avatar_colors)), comments(*, profiles(username, avatar_colors), posts(content))')
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
      .order('created_at', { ascending: false });
    if (data) setChampions(data as Champion[]);
    setLoading(false);
  };

  const evaluateChampions = async () => {
    const today = new Date().toISOString().split('T')[0];
    const period = new Date().getHours() < 18 ? 'noon' : 'night';

    const { data: topPost } = await supabase
      .from('posts')
      .select('*')
      .eq('tier', 'starlight')
      .gte('created_at', new Date(Date.now() - 12 * 3600000).toISOString())
      .order('likes_count', { ascending: false })
      .limit(1)
      .single();

    const { data: topComment } = await supabase
      .from('comments')
      .select('*')
      .gte('created_at', new Date(Date.now() - 12 * 3600000).toISOString())
      .order('sincerity_score', { ascending: false })
      .limit(1)
      .single();

    if (topPost) {
      await supabase.from('champions').upsert({
        post_id: topPost.id, type: 'peak', date: today, period,
      }, { onConflict: 'date,period,type' });
    }
    if (topComment) {
      await supabase.from('champions').upsert({
        comment_id: topComment.id, type: 'healing', date: today, period,
      }, { onConflict: 'date,period,type' });
    }

    triggerMeteor();
    fetchChampions();
  };

  const triggerMeteor = () => {
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

        {champions.length === 0 && !loading && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>今日冠军尚未诞生</Text>
            <Text style={styles.emptySubText}>12:00 与 22:00 自动评选</Text>
          </View>
        )}

        {champions.map((c, i) => (
          <Animated.View key={c.id} entering={FadeInDown.delay(i * 80)}>
            <ChampionCard champion={c} />
          </Animated.View>
        ))}
      </ScrollView>

      {showMeteor && (
        <Animated.View style={[styles.meteorOverlay, meteorStyle]} pointerEvents="none">
          <LinearGradient colors={['rgba(124,58,237,0.9)', 'rgba(219,39,119,0.9)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
          <MeteorParticles />
          <Text style={styles.meteorTitle}>冠军诞生 ★</Text>
        </Animated.View>
      )}
    </View>
  );
}

function MeteorParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => i);
  return (
    <>
      {particles.map((i) => {
        const left = Math.random() * 100;
        const delay = i * 200;
        const translateY = useSharedValue(-20);
        const opacity = useSharedValue(0);

        useEffect(() => {
          translateY.value = withDelay(delay, withTiming(300, { duration: 1500 }));
          opacity.value = withDelay(delay, withSequence(
            withTiming(1, { duration: 200 }),
            withDelay(1000, withTiming(0, { duration: 300 }))
          ));
        }, []);

        const style = useAnimatedStyle(() => ({
          position: 'absolute',
          left: `${left}%` as any,
          top: 0,
          opacity: opacity.value,
          transform: [{ translateY: translateY.value }],
        }));

        return (
          <Animated.Text key={i} style={[styles.particle, style]}>★</Animated.Text>
        );
      })}
    </>
  );
}

function ChampionCard({ champion }: { champion: Champion }) {
  const isPeak = champion.type === 'peak';
  const colors = isPeak ? Gradients.starlight : Gradients.glimmer;
  const label = isPeak ? '巅峰奖 ★' : '治愈奖 ✦';

  return (
    <View style={styles.card}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBadge}>
        <Text style={styles.badgeText}>{label}</Text>
      </LinearGradient>
      <Text style={styles.cardDate}>
        {champion.date} · {champion.period === 'noon' ? '正午' : '夜间'}
      </Text>
      {isPeak && champion.post && (
        <Text style={styles.cardContent} numberOfLines={3}>{champion.post.content}</Text>
      )}
      {!isPeak && (champion as any).comments?.content && (
        <Text style={styles.cardContent} numberOfLines={3}>{(champion as any).comments.content}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '300', letterSpacing: 2 },
  evalBtn: { borderRadius: 16, overflow: 'hidden' },
  evalGradient: { paddingHorizontal: 16, paddingVertical: 9 },
  evalText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  subtitle: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', letterSpacing: 1, marginBottom: 24 },
  scroll: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 8 },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText: { color: Colors.textSecondary, fontSize: 16 },
  emptySubText: { color: Colors.textMuted, fontSize: 13 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 20, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border, gap: 10,
  },
  cardBadge: {
    alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  cardDate: { color: Colors.textMuted, fontSize: 12 },
  cardContent: { color: Colors.textPrimary, fontSize: 15, lineHeight: 24 },
  meteorOverlay: {
    position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  meteorTitle: { color: '#fff', fontSize: 36, fontWeight: '300', letterSpacing: 4 },
  particle: { fontSize: 20, color: Colors.gold },
});
