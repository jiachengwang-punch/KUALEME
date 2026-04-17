import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '../../lib/supabase';
import { Colors, Gradients } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return;
    setLoading(true);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert('注册失败', error.message);
      } else if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          username: username || email.split('@')[0],
          avatar_colors: ['#7C3AED', '#EC4899', '#F59E0B'],
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) Alert.alert('登录失败', error.message);
    }

    setLoading(false);
  };

  return (
    <LinearGradient colors={Gradients.splash} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <Animated.View entering={FadeInDown.duration(600).delay(100)}>
          <Text style={styles.logo}>夸了嘛</Text>
          <Text style={styles.subtitle}>美好世界，美丽心情</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.form}>
          {isSignUp && (
            <TextInput
              style={styles.input}
              placeholder="昵称"
              placeholderTextColor={Colors.textMuted}
              value={username}
              onChangeText={setUsername}
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="邮箱"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="密码"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <LinearGradient
              colors={['#7C3AED', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btnGradient}
            >
              <Text style={styles.btnText}>{loading ? '处理中...' : (isSignUp ? '注册' : '进入')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggle}>
            <Text style={styles.toggleText}>
              {isSignUp ? '已有账号？去登录' : '还没账号？去注册'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 40, color: Colors.textPrimary, textAlign: 'center', fontWeight: '300', letterSpacing: 6 },
  subtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 8, letterSpacing: 2 },
  form: { marginTop: 48, gap: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnGradient: { paddingVertical: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  toggle: { alignItems: 'center', paddingVertical: 12 },
  toggleText: { color: Colors.textMuted, fontSize: 14 },
});
