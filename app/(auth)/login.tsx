import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { Colors, Gradients } from '../../constants/theme';

const ERROR_MAP: Record<string, string> = {
  'auth/email-already-in-use': '该邮箱已被注册',
  'auth/invalid-email': '邮箱格式不正确',
  'auth/weak-password': '密码至少需要6位',
  'auth/user-not-found': '账号不存在',
  'auth/wrong-password': '密码错误',
  'auth/invalid-credential': '邮箱或密码错误',
  'auth/too-many-requests': '尝试次数过多，请稍后再试',
  'auth/network-request-failed': '网络连接失败，请检查网络',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password) { setError('请填写邮箱和密码'); return; }
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', user.uid), {
          username: username || email.split('@')[0],
          avatarColors: ['#7C3AED', '#EC4899', '#F59E0B'],
          energyScore: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      setError(ERROR_MAP[e.code] ?? e.message ?? '操作失败，请重试');
    }
    setLoading(false);
  };

  return (
    <LinearGradient colors={Gradients.splash} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <Animated.View entering={FadeInDown.duration(600).delay(100)}>
          <Text style={styles.logo}>夸了嘛</Text>
          <Text style={styles.subtitle}>美好世界，美丽心情</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(300)} style={styles.form}>
          {isSignUp && (
            <TextInput style={styles.input} placeholder="昵称" placeholderTextColor={Colors.textMuted}
              value={username} onChangeText={setUsername} />
          )}
          <TextInput style={styles.input} placeholder="邮箱" placeholderTextColor={Colors.textMuted}
            value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.input} placeholder="密码（至少6位）" placeholderTextColor={Colors.textMuted}
            value={password} onChangeText={setPassword} secureTextEntry />

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleAuth} disabled={loading}>
            <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btnGradient}>
              <Text style={styles.btnText}>{loading ? '处理中...' : (isSignUp ? '注册' : '进入')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); }} style={styles.toggle}>
            <Text style={styles.toggleText}>{isSignUp ? '已有账号？去登录' : '还没账号？去注册'}</Text>
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
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center' },
  btn: { borderRadius: 16, overflow: 'hidden', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnGradient: { paddingVertical: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  toggle: { alignItems: 'center', paddingVertical: 12 },
  toggleText: { color: Colors.textMuted, fontSize: 14 },
});
