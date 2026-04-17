import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { auth } from '../lib/firebase';
import { Colors, Gradients } from '../constants/theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  useEffect(() => {
    opacity.value = withDelay(300, withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }));
    scale.value = withDelay(300, withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }));

    const timer = setTimeout(() => {
      const user = auth.currentUser;
      router.replace(user ? '/(tabs)/plaza' : '/(auth)/login');
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient colors={Gradients.splash} style={styles.container}>
      <Animated.View style={[styles.center, animStyle]}>
        <Text style={styles.tagline}>在这里，我们只看闪光点，</Text>
        <Text style={styles.tagline}>只说温暖话。</Text>
        <Text style={styles.brand}>夸了嘛</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  tagline: {
    fontSize: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 32,
    letterSpacing: 0.5,
  },
  brand: {
    marginTop: 32,
    fontSize: 14,
    color: Colors.textMuted,
    letterSpacing: 4,
  },
});
