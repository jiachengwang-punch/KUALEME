import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Post } from '../lib/firebase';
import { Colors, Gradients } from '../constants/theme';

type Props = {
  post: Post;
  initialLiked?: boolean;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
};

export default function PostCard({ post, initialLiked = false, onLike, onComment }: Props) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isRevealed, setIsRevealed] = useState(initialLiked);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const handleLongPress = () => {
    if (isLiked) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    scale.value = withSequence(
      withSpring(1.05, { damping: 5 }),
      withSpring(1, { damping: 8 })
    );
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withTiming(0, { duration: 900 })
    );

    runOnJS(setIsLiked)(true);
    runOnJS(setIsRevealed)(true);
    runOnJS(onLike)(post.id);
  };

  const tierColors = post.tier === 'starlight' ? Gradients.starlight : Gradients.glimmer;
  const tierLabel = post.tier === 'starlight' ? '⭐ 星光' : '✨ 微光';

  return (
    <Animated.View style={[styles.wrapper, cardStyle]}>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
        <LinearGradient colors={tierColors} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <TouchableOpacity activeOpacity={0.95} onLongPress={handleLongPress} delayLongPress={300} style={styles.card}>
        <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']} style={styles.cardInner}>
          <View style={styles.header}>
            <View style={styles.avatarCircle}>
              <LinearGradient
                colors={(post.profile?.avatarColors ?? tierColors) as [string, string, string]}
                style={StyleSheet.absoluteFill}
              />
            </View>
            <View style={styles.meta}>
              <Text style={styles.username}>{post.profile?.username ?? '匿名'}</Text>
              <Text style={styles.tier}>{tierLabel}</Text>
            </View>
            {isLiked && (
              <View style={styles.likedBadge}>
                <Text style={styles.likedBadgeText}>已点赞 ✦</Text>
              </View>
            )}
          </View>

          {!isRevealed ? (
            <BlurView intensity={60} tint="dark" style={styles.blurOverlay}>
              <Text style={styles.blurHint}>长按点赞</Text>
              <View style={styles.keywords}>
                {(post.keywords ?? []).map((kw) => (
                  <View key={kw} style={styles.keyword}>
                    <Text style={styles.keywordText}>#{kw}</Text>
                  </View>
                ))}
                {(post.keywords ?? []).length === 0 && (
                  <Text style={styles.keywordText}>{post.content.slice(0, 20)}...</Text>
                )}
              </View>
            </BlurView>
          ) : (
            <View style={styles.content}>
              <Text style={styles.contentText}>{post.content}</Text>
              <View style={styles.actions}>
                <Text style={styles.likesCount}>♥ {post.likesCount ?? 0}</Text>
                <TouchableOpacity style={styles.commentBtn} onPress={() => onComment(post)}>
                  <Text style={styles.commentBtnText}>说点什么 ✦</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 8 },
  glow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 28 },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardInner: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  meta: { flex: 1 },
  username: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  tier: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  likedBadge: { backgroundColor: 'rgba(244,132,95,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(244,132,95,0.3)' },
  likedBadgeText: { color: Colors.primary, fontSize: 11 },
  blurOverlay: { minHeight: 100, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  blurHint: { color: Colors.textMuted, fontSize: 13, letterSpacing: 1 },
  keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  keyword: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  keywordText: { color: Colors.textPrimary, fontSize: 13 },
  content: { gap: 14 },
  contentText: { color: Colors.textPrimary, fontSize: 16, lineHeight: 26 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  likesCount: { color: Colors.textMuted, fontSize: 13 },
  commentBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(244,132,95,0.12)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(244,132,95,0.25)' },
  commentBtnText: { color: Colors.primary, fontSize: 13 },
});
