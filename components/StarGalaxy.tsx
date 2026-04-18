import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay,
  Easing,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import AvatarView from './AvatarView';

const { width, height } = Dimensions.get('window');
const CX = width / 2;
const CY = height / 2 - 40;

// Each orbit is defined by its tilt axis azimuth (phi) and inclination (theta)
// Projected ellipse: major axis = 2R along phi, minor axis = 2R*cos(theta) along phi+90°
const ORBIT_CONFIGS = [
  { phi: 0.10, theta: 0.55 },
  { phi: 1.15, theta: 0.90 },
  { phi: 2.20, theta: 0.42 },
  { phi: 0.60, theta: 1.05 },
  { phi: 1.70, theta: 0.70 },
  { phi: 2.70, theta: 0.35 },
  { phi: 0.35, theta: 0.82 },
];

// Orbit ring colors — app palette
const ORBIT_COLORS = [
  'rgba(255,172,129,0.55)',
  'rgba(174,214,241,0.50)',
  'rgba(255,209,148,0.50)',
  'rgba(133,193,233,0.45)',
  'rgba(255,172,129,0.40)',
  'rgba(174,214,241,0.40)',
  'rgba(255,209,148,0.40)',
];

// Ambient background dots
const AMBIENT = Array.from({ length: 36 }, (_, i) => {
  const a = (i * 137.508 * Math.PI) / 180;
  const r = 52 + (i % 7) * 17;
  const s = 0.9 + (i % 4) * 0.55;
  const o = 0.10 + (i % 5) * 0.055;
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r * 0.46, s, o, phase: i * 0.55 };
});

function AmbientDot({ x, y, s, o, phase }: { x: number; y: number; s: number; o: number; phase: number }) {
  const opacity = useSharedValue(o * 0.5);
  useEffect(() => {
    opacity.value = withDelay(
      phase * 380,
      withRepeat(
        withSequence(
          withTiming(o, { duration: 1400 + phase * 250, easing: Easing.inOut(Easing.sin) }),
          withTiming(o * 0.35, { duration: 1400 + phase * 250, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      ),
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.dot, { left: x - s / 2, top: y - s / 2, width: s, height: s, borderRadius: s }, style]} />;
}

// Static orbit ellipse ring
function OrbitRing({ radius, phi, theta, color, zIdx }: {
  radius: number; phi: number; theta: number; color: string; zIdx: number;
}) {
  const w = radius * 2;
  const h = radius * 2 * Math.abs(Math.cos(theta));
  return (
    <View style={{
      position: 'absolute',
      width: w, height: h,
      borderRadius: w,
      left: CX - w / 2,
      top: CY - h / 2,
      borderWidth: 1,
      borderColor: color,
      transform: [{ rotate: `${phi}rad` }],
      zIndex: zIdx,
    }} />
  );
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
  radius: number; phi: number; theta: number;
  theta0: number; duration: number;
  isClose: boolean; score: number;
  orbitColor: string; orbitZIndex: number;
};

function Star3D({ friend, p, maxScore }: { friend: Friend; p: StarParams; maxScore: number }) {
  const { radius, phi, theta, theta0, duration, isClose, score, orbitZIndex } = p;
  const norm = maxScore > 0 ? score / maxScore : 0;
  const size = isClose ? 50 : 38;

  const angle = useSharedValue(theta0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(theta0 + Math.PI * 2, { duration, easing: Easing.linear }), -1, false,
    );
    if (isClose) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.16, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.00, { duration: 1350, easing: Easing.inOut(Easing.sin) }),
        ),
        -1, true,
      );
    }
  }, []);

  const starStyle = useAnimatedStyle(() => {
    const t = angle.value;
    // Orthographic projection of tilted orbit
    const sx = radius * Math.cos(phi) * Math.cos(t) - radius * Math.sin(phi) * Math.cos(theta) * Math.sin(t);
    const sy = radius * Math.sin(phi) * Math.cos(t) + radius * Math.cos(phi) * Math.cos(theta) * Math.sin(t);
    const sz = radius * Math.sin(theta) * Math.sin(t); // positive = toward viewer

    // Depth cues: scale and opacity shift with z
    const depthT = (sz / (radius * Math.sin(theta) + 0.001) + 1) / 2; // 0..1, 1 = front
    const depthScale = 0.72 + depthT * 0.28;
    const depthOpacity = 0.42 + depthT * 0.58;

    // zIndex: orbitZIndex at center, ±radius from sz
    const starZ = Math.round(orbitZIndex + sz * 0.7);

    return {
      position: 'absolute',
      left: CX - size / 2,
      top: CY - size / 2,
      transform: [
        { translateX: sx },
        { translateY: sy },
        { scale: (isClose ? 1.06 : 0.94) * depthScale * pulse.value },
      ],
      opacity: depthOpacity,
      zIndex: starZ,
    };
  });

  // Glow halo for close friends (tracks star position)
  const glowStyle = useAnimatedStyle(() => {
    if (!isClose) return { display: 'none' as any };
    const t = angle.value;
    const sx = radius * Math.cos(phi) * Math.cos(t) - radius * Math.sin(phi) * Math.cos(theta) * Math.sin(t);
    const sy = radius * Math.sin(phi) * Math.cos(t) + radius * Math.cos(phi) * Math.cos(theta) * Math.sin(t);
    const sz = radius * Math.sin(theta) * Math.sin(t);
    const depthT = (sz / (radius * Math.sin(theta) + 0.001) + 1) / 2;
    const gs = size * 1.9 * pulse.value;
    return {
      position: 'absolute',
      left: CX - gs / 2, top: CY - gs / 2,
      width: gs, height: gs, borderRadius: gs,
      transform: [{ translateX: sx }, { translateY: sy }],
      backgroundColor: 'rgba(255,172,129,0.22)',
      opacity: 0.3 + depthT * 0.4,
      zIndex: Math.round(orbitZIndex + sz * 0.7) - 1,
    };
  });

  const borderColor = isClose
    ? `rgba(255,172,129,${0.55 + norm * 0.45})`
    : `rgba(52,73,94,${0.18 + norm * 0.22})`;

  return (
    <>
      {isClose && <Animated.View style={glowStyle} pointerEvents="none" />}
      <Animated.View style={starStyle}>
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

  // Limit display and sort: close friends first, then by score
  const sorted = [...friends].sort((a, b) => {
    const aClose = closeIds.has(a.addressee_id) ? 1 : 0;
    const bClose = closeIds.has(b.addressee_id) ? 1 : 0;
    if (aClose !== bClose) return bClose - aClose;
    return (interactionScores[b.addressee_id] ?? 0) - (interactionScores[a.addressee_id] ?? 0);
  }).slice(0, 7);

  const starParams: StarParams[] = sorted.map((f, i) => {
    const isClose = closeIds.has(f.addressee_id);
    const score = interactionScores[f.addressee_id] ?? 0;
    const norm = maxScore > 0 ? score / maxScore : 0;
    const cfg = ORBIT_CONFIGS[i % ORBIT_CONFIGS.length];
    const radius = isClose ? 82 + (1 - norm) * 22 : 134 + (1 - norm) * 36;
    // Kepler-like: inner orbits faster
    const duration = Math.round(18000 + Math.pow(radius / 170, 1.4) * 36000);
    const theta0 = (i / Math.max(sorted.length, 1)) * Math.PI * 2;
    const orbitZIndex = 20 + i * 3; // each orbit sits on its own z layer

    return {
      radius, phi: cfg.phi, theta: cfg.theta,
      theta0, duration, isClose, score,
      orbitColor: ORBIT_COLORS[i % ORBIT_COLORS.length],
      orbitZIndex,
    };
  });

  return (
    <View style={styles.container}>
      {/* Ambient twinkling stars */}
      {AMBIENT.map((s, i) => <AmbientDot key={i} {...s} />)}

      {/* Orbit rings — behind center (zIndex < 50) */}
      {starParams.map((p, i) => (
        <OrbitRing
          key={i}
          radius={p.radius}
          phi={p.phi}
          theta={p.theta}
          color={p.orbitColor}
          zIdx={p.orbitZIndex}
        />
      ))}

      {/* Center user — always on top of rings, behind front stars */}
      <View style={[styles.center, { left: CX - 36, top: CY - 36, zIndex: 500 }]}>
        <AvatarView size={72} borderWidth={2.5} borderColor={Colors.primary} />
      </View>

      {/* Friend stars */}
      {sorted.map((f, i) => (
        <Star3D
          key={f.addressee_id}
          friend={f}
          p={starParams[i]}
          maxScore={maxScore}
        />
      ))}

      {friends.length === 0 && (
        <View style={[styles.empty, { left: CX - 90, top: CY + 90 }]}>
          <Text style={styles.emptyText}>还没有星辰，去加友吧</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  dot: { position: 'absolute', backgroundColor: 'rgba(52,73,94,0.22)' },
  center: { position: 'absolute' },
  label: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 3, maxWidth: 54 },
  empty: { position: 'absolute', width: 180, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});
