import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, Gradients } from '../../constants/theme';
import { useRouter, usePathname } from 'expo-router';
import { PostsProvider } from '../../lib/PostsContext';

const tabs = [
  { name: 'plaza', label: '广场', icon: '◈' },
  { name: 'friends', label: '星链', icon: '◎' },
  { name: 'champions', label: '冠军', icon: '★' },
  { name: 'profile', label: '我', icon: '◐' },
];

function TabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(248,251,254,0)', 'rgba(248,251,254,0.95)']}
        style={styles.gradient}
        pointerEvents="none"
      />
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const active = pathname.includes(tab.name);
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tab}
              onPress={() => router.push(`/(tabs)/${tab.name}` as any)}
            >
              <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                {active && (
                  <LinearGradient
                    colors={Gradients.starlight}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <PostsProvider>
      <Tabs
        tabBar={() => <TabBar />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="plaza" />
        <Tabs.Screen name="friends" />
        <Tabs.Screen name="champions" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </PostsProvider>
  );
}

const styles = StyleSheet.create({
  container: { shadowColor: '#D1E1E9', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.2, shadowRadius: 10, borderTopWidth: 0 },
  gradient: { position: 'absolute', top: -24, left: 0, right: 0, height: 24 },
  tabBar: {
    flexDirection: 'row',
    paddingBottom: 10,
    paddingTop: 5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  iconWrapActive: {},
  tabIcon: { fontSize: 13, color: '#BFC9CA' },
  tabIconActive: { color: '#FF8C69' },
  tabLabel: { fontSize: 10, color: '#BFC9CA', letterSpacing: 0.5 },
  tabLabelActive: { color: '#FF8C69', fontWeight: '500' },
});
