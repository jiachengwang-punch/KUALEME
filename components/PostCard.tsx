import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, runOnJS,
} from 'react-native-reanimated';
import { Post } from '../lib/firebase';
import { Colors, Gradients, Layout, Shadow, Typography } from '../constants/theme';
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

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const triggerLike = () => {
    HapticPatterns.like();
    Sounds.like();
    scale.value = withSequence(withSpring(1.04, { damping: 4 }), withSpring(1, { damping: 7 }));
    glowOpacity.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 900 }));
    setIsLiked(true);
    setIsRevealed(true);
    onLike(post.id);
  };

  const handleLongPress = () => {
    if (isLiked) return;
    runOnJS(triggerLike)();
  };

  const isStarlight = post.tier === 'starlight';
  const tierColors = isStarlight ? Gradients.starlight : Gradients.glimmer;
  const tierLabel = isStarlight ? '⭐ 星光' : '✨ 微光';
  const avatarColors = (post.profile?.avatarColors ?? tierColors) as [string, string, string];

  return (
    <Animated.View style={[styles.wrapper, Shadow.card, cardStyle]}>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
        <LinearGradient colors={tierColors} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <TouchableOpacity activeOpacity={0.92} onLongPress={handleLongPress} delayLongPress={700} style={styles.card}>
        <BlurView intensity={Layout.blur} tint="dark" style={styles.blur}>
          <View style={styles.inner}>
            <View style={styles.header}>
              <View style={styles.avatar}>
                <LinearGradient colors={avatarColors} style={StyleSheet.absoluteFill} />
              </View>
              <View style={styles.meta}>
                <Text style={styles.username}>{post.profile?.username ?? '匿名'}</Text>
                <Text style={styles.tier}>{tierLabel}</Text>
              </View>
              {isLiked && (
                <View style={styles.likedPill}>
                  <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  <Text style={styles.likedPillText}>已点赞</Text>
                </View>
              )}
            </View>

            {!isRevealed ? (
              <View style={styles.locked}>
                <Text style={styles.lockHint}>长按点赞，解锁内容</Text>
                <View style={styles.keywords}>
                  {(post.keywords ?? []).length > 0
                    ? post.keywords.map((kw) => (
                        <View key={kw} style={styles.keyword}>
                          <Text style={styles.keywordText}>#{kw}</Text>
                        </View>
                      ))
                    : <Text style={styles.keywordText}>{post.content.slice(0, 24)}...</Text>
                  }
                </View>
              </View>
            ) : (
              <View style={styles.revealed}>
                <Text style={styles.content}>{post.content}</Text>
                <View style={styles.footer}>
                  <Text style={styles.likes}>♥ {post.likesCount ?? 0}</Text>
                  <TouchableOpacity style={styles.commentBtn} onPress={() => onOpenComments(post)}>
                    <Text style={styles.commentBtnText}>查看留言</Text>
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
  wrapper: {
    marginHorizontal: Layout.cardMarginH,
    marginVertical: Layout.cardMarginV,
  },
  glow: {
    position: 'absolute', top: -3, left: -3, right: -3, bottom: -3,
    borderRadius: Layout.cardRadius + 3, opacity: 0,
  },
  card: {
    borderRadius: Layout.cardRadius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blur: { flex: 1 },
  inner: {
    padding: 18,
    backgroundColor: Colors.surface,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden' },
  meta: { flex: 1 },
  username: { ...Typography.username, color: Colors.textPrimary },
  tier: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  likedPill: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    overflow: 'hidden', minWidth: 56, alignItems: 'center',
  },
  likedPillText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  locked: { alignItems: 'center', paddingVertical: 18, gap: 12 },
  lockHint: { fontSize: 13, color: Colors.textMuted, letterSpacing: 1 },
  keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  keyword: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.borderLight,
  },
  keywordText: { color: Colors.textBody, fontSize: 13 },
  revealed: { gap: 14 },
  content: { ...Typography.body, color: Colors.textBody, lineHeight: 24 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  likes: { ...Typography.caption, color: Colors.textSecondary },
  commentBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1, borderColor: Colors.border,
  },
  commentBtnText: { color: Colors.textBody, fontSize: 13 },
});
