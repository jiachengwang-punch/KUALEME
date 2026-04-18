import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isNative = Platform.OS !== 'web';

export const HapticPatterns = {
  like: async () => {
    if (!isNative) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  aiSuccess: async () => {
    if (!isNative) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  champion: async () => {
    if (!isNative) return;
    for (let i = 0; i < 3; i++) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(120);
    }
    await delay(200);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  deliver: async () => {
    if (!isNative) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(60);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await delay(60);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
