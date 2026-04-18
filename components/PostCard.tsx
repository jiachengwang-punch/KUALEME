import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS,
} from 'react-native-reanimated';
import { Post } from '../lib/firebase';
import { Colors, Gradients, Glass } from '../constants/theme';
import { HapticPatterns } from '../lib/haptics';
import { Sounds } from '../lib/audio';

type Props = {
  post: Post;
  initialLiked?: boolean;
  onLike: (postId: string) => void;
  onOpenComments: (post: Post) => void;
};

export default function PostCard({ post, initialLiked = false, onLike, onOpenComments }: Props) {
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isRevealed, setIsRevealed] = useState(initialLiked);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const ripple = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 1 - ripple.value,
    transform: [{ scale: 1 + ripple.value * 0.15 }],
  }));

  const triggerLike = () => {
    HapticPatterns.like();
    Sounds.like();
    scale.value = withSequence(withSpring(1.06, { damping: 4 }), withSpring(1, { damping: 7 }));
    glowOpacity.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 1000 }));
    ripple.value = withTiming(1, { duration: 600 });
    setIsLiked(true);
    setIsRevealed(true);
    onLike(post.id);
  };

  const handleLongPress = () => {
    if (isLiked) return;
    runOnJS(triggerLike)();
  };

  const tierColors = post.tier === 'starlight' ? Gradients.starlight : Gradients.glimmer;
  const tierLabel = post.tier === 'starlight' ? '⭐ 星光' : '✨ 微光';

  return (
    <Animated.View style={[styles.wrapper, cardStyle]}>
      {/* 点赞光晕 */}
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
        <LinearGradient colors={tierColors} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* 涟漪扩散 */}
      {isLiked && (
        <Animated.View style={[styles.ripple, rippleStyle]} pointerEvents="none">
          <LinearGradient
            colors={[Colors.primary + '30', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      <TouchableOpacity activeOpacity={0.92} onLongPress={handleLongPress} delayLongPress={700} style={styles.card}>
        <BlurView intensity={Glass.blur} tint="dark" style={styles.cardBlur}>
          <View style={styles.cardInner}>
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
              <View style={styles.blurContent}>
                <Text style={styles.blurHint}>长按点赞解锁</Text>
                <View style={styles.keywords}>
                  {(post.keywords ?? []).length > 0
                    ? post.keywords.map((kw) => (
                        <View key={kw} style={styles.keyword}>
                          <Text style={styles.keywordText}>#{kw}</Text>
                        </View>
                      ))
                    : <Text style={styles.keywordText}>{post.content.slice(0, 20)}...</Text>
                  }
                </View>
              </View>
            ) : (
              <View style={styles.content}>
                <Text style={styles.contentText}>{post.content}</Text>
                <View style={styles.actions}>
                  <Text style={styles.likesCount}>♥ {post.likesCount ?? 0}</Text>
                  <TouchableOpacity style={styles.commentBtn} onPress={() => onOpenComments(post)}>
                    <Text style={styles.commentBtnText}>查看留言 ✦</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </BlurView>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 8 },
  glow: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 28, opacity: 0 },
  ripple: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 32 },
  card: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: Glass.border },
  cardBlur: { flex: 1 },
  cardInner: { padding: 20, backgroundColor: Glass.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  meta: { flex: 1 },
  username: { color: Colors.textPrimary, fontSize: 15, fontWeight: '400' },
  tier: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  likedBadge: {
    backgroundColor: 'rgba(126,200,227,0.12)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.border,
  },
  likedBadgeText: { color: Colors.primary, fontSize: 11 },
  blurContent: { alignItems: 'center', paddingVertical: 20, gap: 14 },
  blurHint: { color: Colors.textMuted, fontSize: 13, letterSpacing: 1.5 },
  keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  keyword: {
    backgroundColor: 'rgba(126,200,227,0.1)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border,
  },
  keywordText: { color: Colors.textPrimary, fontSize: 13 },
  content: { gap: 14 },
  contentText: { color: Colors.textPrimary, fontSize: 16, lineHeight: 26 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  likesCount: { color: Colors.textMuted, fontSize: 13 },
  commentBtn: {
    backgroundColor: 'rgba(126,200,227,0.1)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border,
  },
  commentBtnText: { color: Colors.primary, fontSize: 13 },
});
