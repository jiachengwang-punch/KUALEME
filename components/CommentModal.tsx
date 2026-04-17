import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { checkCommentTone } from '../lib/openai';
import { Colors } from '../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (text: string, score: number) => void;
};

export default function CommentModal({ visible, onClose, onSubmit }: Props) {
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleSend = async () => {
    if (!text.trim()) return;
    setChecking(true);
    setWarning(null);

    const { isWarm, suggestion } = await checkCommentTone(text);
    setChecking(false);

    if (!isWarm && suggestion) {
      setWarning(suggestion);
      return;
    }

    const score = Math.min(100, 60 + text.length * 0.5);
    onSubmit(text, score);
    setText('');
    setWarning(null);
    onClose();
  };

  const useSuggestion = () => {
    if (warning) setText(warning);
    setWarning(null);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kvWrapper}>
          <Animated.View entering={SlideInDown.springify().damping(20)} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>说点什么</Text>

            {warning && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>检测到一点点寒意 ❄️</Text>
                <Text style={styles.warningBody}>换成这种说法 TA 会更开心哦：</Text>
                <Text style={styles.warningSuggestion}>"{warning}"</Text>
                <TouchableOpacity style={styles.useBtn} onPress={useSuggestion}>
                  <Text style={styles.useBtnText}>一键采用</Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={styles.input}
              multiline
              placeholder="温暖的话让彼此都发光..."
              placeholderTextColor={Colors.textMuted}
              value={text}
              onChangeText={(t) => { setText(t); setWarning(null); }}
              maxLength={200}
            />

            <View style={styles.footer}>
              <Text style={styles.charCount}>{text.length}/200</Text>
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || checking) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || checking}
              >
                {checking
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.sendBtnText}>发送</Text>
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  kvWrapper: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  handle: {
    width: 36, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  warningBox: {
    backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 16,
    padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  warningTitle: { color: '#FB923C', fontSize: 14, fontWeight: '600' },
  warningBody: { color: Colors.textSecondary, fontSize: 13, marginTop: 4 },
  warningSuggestion: { color: Colors.textPrimary, fontSize: 14, marginTop: 8, lineHeight: 20 },
  useBtn: {
    marginTop: 12, backgroundColor: 'rgba(249,115,22,0.2)',
    borderRadius: 12, paddingVertical: 8, alignItems: 'center',
  },
  useBtnText: { color: '#FB923C', fontSize: 14, fontWeight: '500' },
  input: {
    backgroundColor: Colors.surface, borderRadius: 16,
    padding: 16, color: Colors.textPrimary, fontSize: 15,
    minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: Colors.border,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  charCount: { color: Colors.textMuted, fontSize: 12 },
  sendBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
