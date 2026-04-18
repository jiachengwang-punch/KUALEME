import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSequence, withRepeat, Easing,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Colors } from '../constants/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  const line1Opacity = useSharedValue(0);
  const line1Y = useSharedValue(16);
  const line2Opacity = useSharedValue(0);
  const line2Y = useSharedValue(16);
  const brandOpacity = useSharedValue(0);
  const shimmer = useSharedValue(0);

  const line1Style = useAnimatedStyle(() => ({
    opacity: line1Opacity.value,
    transform: [{ translateY: line1Y.value }],
  }));
  const line2Style = useAnimatedStyle(() => ({
    opacity: line2Opacity.value,
    transform: [{ translateY: line2Y.value }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * (width + 100) - 50 }],
  }));

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    line1Opacity.value = withDelay(400, withTiming(1, { duration: 900, easing: ease }));
    line1Y.value = withDelay(400, withTiming(0, { duration: 900, easing: ease }));
    line2Opacity.value = withDelay(800, withTiming(1, { duration: 900, easing: ease }));
    line2Y.value = withDelay(800, withTiming(0, { duration: 900, easing: ease }));
    brandOpacity.value = withDelay(1400, withTiming(0.5, { duration: 800, easing: ease }));
    shimmer.value = withDelay(1200, withRepeat(withTiming(1, { duration: 2000, easing: Easing.linear }), -1, false));

    const unsub = onAuthStateChanged(auth, (user) => {
      setTimeout(() => {
        router.replace(user ? '/(tabs)/plaza' : '/(auth)/login');
      }, 3200);
    });

    return unsub;
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#050D14', '#0A1E2E', '#0D2B3E']}
        style={StyleSheet.absoluteFill}
      />

      {/* 流光扫过效果 */}
      <Animated.View style={[styles.shimmerBar, shimmerStyle]} pointerEvents="none">
        <LinearGradient
          colors={['transparent', 'rgba(126,200,227,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.center}>
        <Animated.Text style={[styles.line, line1Style]}>
          在这里，我们只看闪光点，
        </Animated.Text>
        <Animated.Text style={[styles.line, line2Style]}>
          只说温暖话。
        </Animated.Text>
        <Animated.Text style={[styles.brand, brandStyle]}>
          夸了嘛
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050D14' },
  shimmerBar: {
    position: 'absolute', top: 0, bottom: 0, width: 120,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 12 },
  line: {
    fontSize: 20,
    color: '#F0F8FF',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: 1,
    fontWeight: '300',
  },
  brand: {
    marginTop: 32,
    fontSize: 13,
    color: Colors.primary,
    letterSpacing: 6,
    fontWeight: '300',
  },
});
