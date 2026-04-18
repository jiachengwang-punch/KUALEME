import { ReactNode } from 'react';
import { View, StyleSheet, SafeAreaView, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Typography } from '../constants/theme';

type Props = {
  title: string;
  right?: ReactNode;
  children: ReactNode;
};

export default function ScreenLayout({ title, right, children }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.bg} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {right}
        </View>
      </SafeAreaView>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { ...Typography.heading, color: Colors.textPrimary },
});
