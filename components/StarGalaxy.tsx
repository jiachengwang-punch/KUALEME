import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import AvatarView from './AvatarView';

const { width, height } = Dimensions.get('window');
const CENTER = { x: width / 2, y: height / 2 - 80 };

type Friend = {
  addressee_id: string;
  profiles?: { username: string; avatar_colors?: string[]; avatar_url?: string };
};
type CloseFriend = { friend_id: string };

type Props = {
  friends: Friend[];
  closeFriends: CloseFriend[];
  interactionScores?: Record<string, number>;
};

function Star({ index, total, friend, isClose, score, maxScore }: {
  index: number; total: number; friend: Friend; isClose: boolean; score: number; maxScore: number;
}) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;

  // radius: higher score = closer to center. Range 60–170.
  const normalizedScore = maxScore > 0 ? score / maxScore : 0;
  const radius = isClose
    ? 70 + (1 - normalizedScore) * 40   // close friends: 70–110
    : 120 + (1 - normalizedScore) * 50; // regular: 120–170

  const x = CENTER.x + Math.cos(angle) * radius;
  const y = CENTER.y + Math.sin(angle) * radius;

  // brightness: higher score = more opaque border
  const borderOpacity = 0.3 + normalizedScore * 0.7;
  const borderColor = isClose
    ? `rgba(255,179,71,${borderOpacity})`
    : `rgba(255,255,255,${borderOpacity * 0.6})`;

  const size = isClose ? 46 : 36;
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 2000 + index * 400, easing: Easing.inOut(Easing.ease) }),
      -1, true
    );
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - size / 2,
    top: y - size / 2,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={starStyle}>
      <AvatarView
        url={friend.profiles?.avatar_url}
        colors={friend.profiles?.avatar_colors}
        size={size}
        borderWidth={isClose ? 2 : 1}
        borderColor={borderColor}
      />
      <Text style={[styles.starLabel, { opacity: 0.5 + normalizedScore * 0.5 }]} numberOfLines={1}>
        {friend.profiles?.username ?? ''}
      </Text>
    </Animated.View>
  );
}

export default function StarGalaxy({ friends, closeFriends, interactionScores = {} }: Props) {
  const closeIds = new Set(closeFriends.map((cf) => cf.friend_id));
  const maxScore = Math.max(1, ...Object.values(interactionScores));

  return (
    <View style={styles.container}>
      {/* orbit rings */}
      <View style={[styles.ring, { width: 150, height: 150, borderRadius: 75, left: CENTER.x - 75, top: CENTER.y - 75 }]} />
      <View style={[styles.ring, { width: 250, height: 250, borderRadius: 125, left: CENTER.x - 125, top: CENTER.y - 125 }]} />
      <View style={[styles.ring, { width: 360, height: 360, borderRadius: 180, left: CENTER.x - 180, top: CENTER.y - 180 }]} />

      {/* center user */}
      <View style={[styles.centerStar, { left: CENTER.x - 32, top: CENTER.y - 32 }]}>
        <AvatarView size={64} borderWidth={2} borderColor={Colors.primary} />
      </View>

      {friends.map((f, i) => (
        <Star
          key={f.addressee_id}
          index={i}
          total={friends.length}
          friend={f}
          isClose={closeIds.has(f.addressee_id)}
          score={interactionScores[f.addressee_id] ?? 0}
          maxScore={maxScore}
        />
      ))}

      {friends.length === 0 && (
        <View style={[styles.emptyHint, { left: CENTER.x - 80, top: CENTER.y + 48 }]}>
          <Text style={styles.emptyText}>还没有星辰，去加友吧</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  centerStar: { position: 'absolute' },
  starLabel: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 3, maxWidth: 48 },
  emptyHint: { position: 'absolute', width: 160, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
