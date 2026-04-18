import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';
import AvatarView from './AvatarView';

const { width, height } = Dimensions.get('window');
const CX = width / 2;
const CY = height / 2 - 50;
const FOV = 460;

// Per-star projection — each star has its own orbital tilt
function project(x3: number, y3: number, z3: number, tilt: number) {
  'worklet';
  const y2 = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
  const z2 = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);
  const p = FOV / (FOV + z2);
  return { sx: x3 * p, sy: y2 * p, depth: p };
}

// Stable ambient star field
const AMBIENT = Array.from({ length: 42 }, (_, i) => {
  const a = (i * 137.508 * Math.PI) / 180;
  const r = 48 + (i % 8) * 18 + (i % 3) * 12;
  const s = 1.0 + (i % 4) * 0.5;
  const o = 0.12 + (i % 6) * 0.06;
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * 0.44, s, o, phase: i * 0.6 };
});

// Twinkling ambient dot
function AmbientDot({ x, y, s, o, phase }: { x: number; y: number; s: number; o: number; phase: number }) {
  const opacity = useSharedValue(o * 0.6);
  useEffect(() => {
    opacity.value = withDelay(
      phase * 400,
      withRepeat(
        withSequence(
          withTiming(o, { duration: 1200 + phase * 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(o * 0.4, { duration: 1200 + phase * 300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.dot, { left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: s }, style]} />
  );
}

// Expanding center ring
function CenterRing({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.out(Easing.cubic) }), -1, false,
    ));
  }, []);
  const style = useAnimatedStyle(() => {
    const s = 68 + progress.value * 110;
    return {
      position: 'absolute',
      width: s, height: s * 0.45,
      borderRadius: s,
      left: CX - s / 2,
      top: CY - (s * 0.45) / 2,
      borderWidth: 1,
      borderColor: color,
      opacity: (1 - progress.value) * 0.5,
    };
  });
  return <Animated.View style={style} pointerEvents="none" />;
}

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

type StarParams = {
  theta0: number; radius: number; yHeight: number; inclination: number;
  isClose: boolean; score: number; duration: number;
};

function Star3D({ friend, params, maxScore }: { friend: Friend; params: StarParams; maxScore: number }) {
  const { theta0, radius, yHeight, inclination, isClose, score, duration } = params;
  const norm = maxScore > 0 ? score / maxScore : 0;
  const size = isClose ? 48 : 36;

  const angle = useSharedValue(theta0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    // Independent orbit — starts at theta0, completes one revolution in `duration` ms
    angle.value = withRepeat(
      withTiming(theta0 + Math.PI * 2, { duration, easing: Easing.linear }), -1, false,
    );
    if (isClose) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    }
  }, []);

  const borderColor = isClose
    ? `rgba(255,172,129,${0.5 + norm * 0.5})`
    : `rgba(52,73,94,${0.15 + norm * 0.25})`;

  const style = useAnimatedStyle(() => {
    const x3 = radius * Math.cos(angle.value);
    const z3 = radius * Math.sin(angle.value);
    const { sx, sy, depth } = project(x3, yHeight, z3, inclination);
    const sc = depth * (isClose ? 1.08 : 0.94) * pulse.value;
    return {
      position: 'absolute',
      left: CX - size / 2,
      top: CY - size / 2,
      transform: [{ translateX: sx }, { translateY: sy }, { scale: sc }],
      opacity: 0.28 + depth * 0.72,
      zIndex: Math.round(depth * 100),
    };
  });

  // Glow ring for close friends
  const glowStyle = useAnimatedStyle(() => {
    if (!isClose) return { opacity: 0 };
    const x3 = radius * Math.cos(angle.value);
    const z3 = radius * Math.sin(angle.value);
    const { sx, sy, depth } = project(x3, yHeight, z3, inclination);
    const glowSize = size * 1.7 * pulse.value;
    return {
      position: 'absolute',
      left: CX - glowSize / 2,
      top: CY - glowSize / 2,
      width: glowSize, height: glowSize, borderRadius: glowSize,
      transform: [{ translateX: sx }, { translateY: sy }],
      opacity: depth * 0.18,
      zIndex: Math.round(depth * 100) - 1,
      backgroundColor: 'rgba(255,172,129,0.6)',
    };
  });

  return (
    <>
      {isClose && <Animated.View style={glowStyle} pointerEvents="none" />}
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
    </>
  );
}

export default function StarGalaxy({ friends, closeFriends, interactionScores = {} }: Props) {
  const closeIds = new Set(closeFriends.map((cf) => cf.friend_id));
  const maxScore = Math.max(1, ...Object.values(interactionScores));

  // Stable per-star orbital parameters
  const starParams = useMemo<StarParams[]>(() => friends.map((f, i) => {
    const norm = maxScore > 0 ? (interactionScores[f.addressee_id] ?? 0) / maxScore : 0;
    const isClose = closeIds.has(f.addressee_id);

    // Closer friends orbit tighter
    const radius = isClose ? 78 + (1 - norm) * 32 : 132 + (1 - norm) * 48;

    // Kepler-like speed: inner orbits faster
    // outer (r≈180) → ~55s, inner (r≈78) → ~22s
    const duration = Math.round(22000 + Math.pow(radius / 180, 1.5) * 33000);

    // Each star starts at an evenly-spaced phase
    const theta0 = (i / Math.max(friends.length, 1)) * Math.PI * 2;

    // Each star orbits on a slightly different inclined plane (±0.14 rad around base 0.38)
    const inclination = 0.38 + ((i % 7) - 3) * 0.04;

    const yHeight = (i % 5 - 2) * 12;
    const score = interactionScores[f.addressee_id] ?? 0;

    return { theta0, radius, yHeight, inclination, isClose, score, duration };
  }), [friends.length, maxScore]);

  // Orbit ring props (approximate projected ellipses for reference)
  const RINGS = [
    { r: 94, tilt: 0.38 },
    { r: 156, tilt: 0.38 },
    { r: 204, tilt: 0.38 },
  ];

  return (
    <View style={styles.container}>
      {/* Soft center glow */}
      <View style={[styles.glow, { left: CX - 140, top: CY - 140 }]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255,172,129,0.08)', 'rgba(174,214,241,0.05)', 'transparent']}
          style={{ flex: 1, borderRadius: 140 }}
        />
      </View>

      {/* Twinkling ambient stars */}
      {AMBIENT.map((s, i) => <AmbientDot key={i} {...s} />)}

      {/* Orbit reference ellipses */}
      {RINGS.map(({ r, tilt }, i) => {
        const w = r * 2;
        const h = w * Math.cos(tilt) * 0.48;
        return (
          <View key={i} style={[styles.ring, { width: w, height: h, left: CX - w / 2, top: CY - h / 2 }]} />
        );
      })}

      {/* Center expanding rings */}
      <CenterRing delay={0} color="rgba(255,172,129,0.6)" />
      <CenterRing delay={930} color="rgba(174,214,241,0.5)" />
      <CenterRing delay={1860} color="rgba(255,172,129,0.4)" />

      {/* Center user */}
      <View style={[styles.center, { left: CX - 34, top: CY - 34 }]}>
        <AvatarView size={68} borderWidth={2} borderColor={Colors.primary} />
      </View>

      {/* Friend stars — each independently animated */}
      {friends.map((f, i) => (
        <Star3D
          key={f.addressee_id}
          friend={f}
          params={starParams[i] ?? { theta0: 0, radius: 132, yHeight: 0, inclination: 0.38, isClose: false, score: 0, duration: 40000 }}
          maxScore={maxScore}
        />
      ))}

      {friends.length === 0 && (
        <View style={[styles.empty, { left: CX - 90, top: CY + 80 }]}>
          <Text style={styles.emptyText}>还没有星辰，去加友吧</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140 },
  dot: { position: 'absolute', backgroundColor: 'rgba(52,73,94,0.25)' },
  ring: {
    position: 'absolute', borderWidth: 1, borderRadius: 999,
    borderColor: 'rgba(52,73,94,0.07)',
  },
  center: { position: 'absolute' },
  label: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 3, maxWidth: 52 },
  empty: { position: 'absolute', width: 180, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
