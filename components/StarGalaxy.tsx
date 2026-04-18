import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  Easing, SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import AvatarView from './AvatarView';

const { width, height } = Dimensions.get('window');
const CX = width / 2;
const CY = height / 2 - 60;
const TILT = 0.42;   // galaxy disk tilt in radians (~24°)
const FOV  = 420;    // perspective field-of-view distance

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

// Pre-generate ambient background star positions (stable between renders)
const AMBIENT = Array.from({ length: 38 }, (_, i) => {
  const seed = i * 137.508; // golden angle spread
  const r = 55 + (i % 7) * 22 + (i % 3) * 18;
  const a = (seed % 360) * (Math.PI / 180);
  return { r, a, s: 1.2 + (i % 3) * 0.8, o: 0.15 + (i % 5) * 0.08 };
});

function project(x3: number, y3: number, z3: number) {
  'worklet';
  // tilt the orbital plane
  const y2 = y3 * Math.cos(TILT) - z3 * Math.sin(TILT);
  const z2 = y3 * Math.sin(TILT) + z3 * Math.cos(TILT);
  // perspective
  const p = FOV / (FOV + z2);
  return { sx: x3 * p, sy: y2 * p, scale: p };
}

function Star3D({ theta0, radius, yHeight, isClose, score, maxScore, friend, orbitAngle }: {
  theta0: number; radius: number; yHeight: number;
  isClose: boolean; score: number; maxScore: number;
  friend: Friend; orbitAngle: SharedValue<number>;
}) {
  const norm = maxScore > 0 ? score / maxScore : 0;
  const size = isClose ? 46 : 34;
  const borderColor = isClose
    ? `rgba(255,179,71,${0.4 + norm * 0.6})`
    : `rgba(255,255,255,${0.2 + norm * 0.4})`;

  const style = useAnimatedStyle(() => {
    const angle = theta0 + orbitAngle.value;
    const x3 = radius * Math.cos(angle);
    const z3 = radius * Math.sin(angle);
    const { sx, sy, scale: p } = project(x3, yHeight, z3);
    return {
      position: 'absolute',
      left: CX - size / 2,
      top:  CY - size / 2,
      transform: [{ translateX: sx }, { translateY: sy }, { scale: p * (isClose ? 1.05 : 0.92) }],
      opacity: 0.25 + p * 0.75,
      zIndex: Math.round(p * 10),
    };
  });

  return (
    <Animated.View style={style}>
      <AvatarView
        url={friend.profiles?.avatar_url}
        colors={friend.profiles?.avatar_colors}
        size={size}
        borderWidth={isClose ? 2 : 1}
        borderColor={borderColor}
      />
      <Text style={styles.label} numberOfLines={1}>{friend.profiles?.username ?? ''}</Text>
    </Animated.View>
  );
}

export default function StarGalaxy({ friends, closeFriends, interactionScores = {} }: Props) {
  const closeIds = new Set(closeFriends.map((cf) => cf.friend_id));
  const maxScore = Math.max(1, ...Object.values(interactionScores));
  const orbitAngle = useSharedValue(0);
  const ambientRotation = useSharedValue(0);

  useEffect(() => {
    // main galaxy rotation: one full turn every 40 seconds
    orbitAngle.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 40000, easing: Easing.linear }), -1, false
    );
    // ambient stars drift slower
    ambientRotation.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 90000, easing: Easing.linear }), -1, false
    );
  }, []);

  const ambientStyle = useAnimatedStyle(() => ({
    position: 'absolute', width, height,
    transform: [{ rotate: `${ambientRotation.value}rad` }],
  }));

  // assign each friend a stable orbit parameters
  const starParams = useMemo(() => friends.map((f, i) => {
    const norm = maxScore > 0 ? (interactionScores[f.addressee_id] ?? 0) / maxScore : 0;
    const isClose = closeIds.has(f.addressee_id);
    const radius = isClose
      ? 75 + (1 - norm) * 35
      : 130 + (1 - norm) * 45;
    const theta0 = (i / Math.max(friends.length, 1)) * Math.PI * 2;
    const yHeight = (i % 3 - 1) * 14; // slight vertical scatter
    return { theta0, radius, yHeight, isClose, score: interactionScores[f.addressee_id] ?? 0 };
  }), [friends.length, maxScore]);

  return (
    <View style={styles.container}>
      {/* galaxy glow */}
      <View style={[styles.glow, { left: CX - 160, top: CY - 160 }]}>
        <LinearGradient
          colors={['rgba(255,179,71,0.06)', 'rgba(112,161,255,0.04)', 'transparent']}
          style={{ flex: 1, borderRadius: 160 }}
        />
      </View>

      {/* ambient drifting stars */}
      <Animated.View style={ambientStyle} pointerEvents="none">
        {AMBIENT.map((s, i) => (
          <View key={i} style={[styles.dot, {
            left: CX + Math.cos(s.a) * s.r - s.s / 2,
            top:  CY + Math.sin(s.a) * s.r * 0.45 - s.s / 2,
            width: s.s, height: s.s, borderRadius: s.s,
            opacity: s.o,
          }]} />
        ))}
      </Animated.View>

      {/* orbit ellipses */}
      <View style={[styles.ring, { width: 160, height: 72,  left: CX - 80,  top: CY - 36  }]} />
      <View style={[styles.ring, { width: 280, height: 126, left: CX - 140, top: CY - 63  }]} />
      <View style={[styles.ring, { width: 390, height: 175, left: CX - 195, top: CY - 87  }]} />

      {/* center user */}
      <View style={[styles.center, { left: CX - 32, top: CY - 32 }]}>
        <AvatarView size={64} borderWidth={2} borderColor={Colors.primary} />
      </View>

      {/* friend stars */}
      {friends.map((f, i) => (
        <Star3D
          key={f.addressee_id}
          friend={f}
          theta0={starParams[i]?.theta0 ?? 0}
          radius={starParams[i]?.radius ?? 130}
          yHeight={starParams[i]?.yHeight ?? 0}
          isClose={closeIds.has(f.addressee_id)}
          score={starParams[i]?.score ?? 0}
          maxScore={maxScore}
          orbitAngle={orbitAngle}
        />
      ))}

      {friends.length === 0 && (
        <View style={[styles.empty, { left: CX - 80, top: CY + 60 }]}>
          <Text style={styles.emptyText}>还没有星辰，去加友吧</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160 },
  dot:  { position: 'absolute', backgroundColor: '#fff' },
  ring: {
    position: 'absolute', borderWidth: 1,
    borderRadius: 999,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  center: { position: 'absolute' },
  label: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 3, maxWidth: 50 },
  empty: { position: 'absolute', width: 160, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
