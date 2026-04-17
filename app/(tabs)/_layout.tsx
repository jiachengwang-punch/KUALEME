import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/theme';
import { useRouter, usePathname } from 'expo-router';

const tabs = [
  { name: 'plaza', label: '广场', icon: '✦' },
  { name: 'friends', label: '星链', icon: '◎' },
  { name: 'champions', label: '冠军', icon: '★' },
  { name: 'profile', label: '我', icon: '◐' },
];

function TabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const active = pathname.includes(tab.name);
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => router.push(`/(tabs)/${tab.name}` as any)}
          >
            <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={() => <TabBar />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="plaza" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="champions" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(13,13,20,0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 24,
    paddingTop: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabIcon: { fontSize: 18, color: Colors.textMuted },
  tabIconActive: { color: Colors.primary },
  tabLabel: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  tabLabelActive: { color: Colors.primary },
});
