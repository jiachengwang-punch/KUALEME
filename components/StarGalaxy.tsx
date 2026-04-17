import { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';

const { width, height } = Dimensions.get('window');
const CENTER = { x: width / 2, y: height / 2 - 80 };

type Friend = { addressee_id: string; profiles?: { username: string; avatar_colors?: string[] } };
type CloseFriend = { friend_id: string; last_interaction: string; profiles?: { username: string; avatar_colors?: string[] } };

type Props = { friends: Friend[]; closeFriends: CloseFriend[] };

function Star({ index, total, friend, isCore, isClose }: {
  index: number; total: number; friend: Friend; isCore: boolean; isClose: boolean;
}) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2;
  const radius = isClose ? 90 : 160;
  const x = CENTER.x + Math.cos(angle) * radius;
  const y = CENTER.y + Math.sin(angle) * radius;
  const rotation = useSharedValue(0);
  const colors = (friend.profiles?.avatar_colors ?? ['#7C3AED', '#EC4899', '#F59E0B']) as [string, string, string];
  const size = isClose ? 44 : 36;

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 20000 + index * 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    borderWidth: isClose ? 2 : 1,
    borderColor: isClose ? Colors.primary : Colors.border,
  }));

  return <Animated.View style={dotStyle}>
    <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
  </Animated.View>;
}

export default function StarGalaxy({ friends, closeFriends }: Props) {
  const orbitRotation = useSharedValue(0);

  useEffect(() => {
    orbitRotation.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1, false
    );
  }, []);

  const orbitStyle = useAnimatedStyle(() => ({
    position: 'absolute', width: width, height: height,
    transform: [{ rotate: `${orbitRotation.value}deg` }],
  }));

  const closeIds = new Set(closeFriends.map((cf) => cf.friend_id));

  return (
    <View style={styles.container}>
      {/* orbit rings */}
      <View style={[styles.ring, { width: 180, height: 180, borderRadius: 90, left: CENTER.x - 90, top: CENTER.y - 90 }]} />
      <View style={[styles.ring, { width: 320, height: 320, borderRadius: 160, left: CENTER.x - 160, top: CENTER.y - 160 }]} />

      {/* center user */}
      <View style={[styles.centerStar, { left: CENTER.x - 30, top: CENTER.y - 30 }]}>
        <LinearGradient colors={['#7C3AED', '#EC4899', '#F59E0B']} style={StyleSheet.absoluteFill} />
      </View>

      {/* friends as stars */}
      {friends.map((f, i) => (
        <Star
          key={f.addressee_id}
          index={i}
          total={friends.length}
          friend={f}
          isCore={closeIds.has(f.addressee_id)}
          isClose={closeIds.has(f.addressee_id)}
        />
      ))}

      {friends.length === 0 && (
        <View style={[styles.emptyHint, { left: CENTER.x - 80, top: CENTER.y + 50 }]}>
          <Animated.Text style={styles.emptyText}>还没有星辰，去加友吧</Animated.Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  centerStar: {
    position: 'absolute',
    width: 60, height: 60, borderRadius: 30, overflow: 'hidden',
    borderWidth: 2, borderColor: Colors.primary,
  },
  emptyHint: { position: 'absolute', width: 160, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
