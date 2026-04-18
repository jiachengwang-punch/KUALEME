import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, SlideInDown } from 'react-native-reanimated';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { checkCommentTone } from '../lib/openai';
import { Colors } from '../constants/theme';

type Comment = {
  id: string;
  userId: string;
  content: string;
  sincerityScore: number;
  createdAt: any;
  username?: string;
  avatarColors?: string[];
};

type Props = {
  visible: boolean;
  postId: string;
  postContent: string;
  onClose: () => void;
  onSubmit: (text: string, score: number) => Promise<void>;
};

export default function CommentsSheet({ visible, postId, postContent, onClose, onSubmit }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && postId) fetchComments();
  }, [visible, postId]);

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const q = query(collection(db, 'comments'), where('postId', '==', postId));
      const snap = await getDocs(q);
      const list: Comment[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        let username = '匿名';
        let avatarColors;
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const uSnap = await getDoc(doc(db, 'users', data.userId));
          if (uSnap.exists()) {
            username = uSnap.data().username;
            avatarColors = uSnap.data().avatarColors;
          }
        } catch {}
        list.push({ id: d.id, ...data, username, avatarColors } as Comment);
      }
      list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setComments(list);
    } finally {
      setLoadingComments(false);
    }
  };

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

    setSubmitting(true);
    const score = Math.min(100, 60 + text.length * 0.5);
    await onSubmit(text, score);
    setText('');
    setWarning(null);
    setSubmitting(false);
    fetchComments();
  };

  const useSuggestion = () => { if (warning) setText(warning); setWarning(null); };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kvWrapper}>
          <Animated.View entering={SlideInDown.springify().damping(20)} style={styles.sheet}>
            <View style={styles.handle} />

            <View style={styles.postPreview}>
              <Text style={styles.postPreviewText} numberOfLines={2}>{postContent}</Text>
            </View>

            <Text style={styles.sectionLabel}>
              {loadingComments ? '加载中...' : `${comments.length} 条温暖留言`}
            </Text>

            {loadingComments ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                style={styles.commentList}
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <View style={styles.commentAvatar}>
                      <LinearGradient
                        colors={(item.avatarColors ?? ['#F4845F', '#EC7FA9', '#F5C842']) as [string, string, string]}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.commentBody}>
                      <Text style={styles.commentUsername}>{item.username}</Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                      {item.sincerityScore >= 85 && (
                        <Text style={styles.sincerityBadge}>真诚暴击 ✦</Text>
                      )}
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>还没有留言，来第一个吧</Text>
                }
              />
            )}

            {warning && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>检测到一点寒意 ❄️</Text>
                <Text style={styles.warningSuggestion}>"{warning}"</Text>
                <TouchableOpacity style={styles.useBtn} onPress={useSuggestion}>
                  <Text style={styles.useBtnText}>一键采用</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="说点温暖的话..."
                placeholderTextColor={Colors.textMuted}
                value={text}
                onChangeText={(t) => { setText(t); setWarning(null); }}
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || checking || submitting) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!text.trim() || checking || submitting}
              >
                {checking || submitting
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
    backgroundColor: '#1E0F10', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, maxHeight: '80%',
    borderTopWidth: 1, borderColor: Colors.border,
  },
  handle: { width: 36, height: 4, backgroundColor: Colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  postPreview: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 14 },
  postPreviewText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  sectionLabel: { color: Colors.textMuted, fontSize: 12, letterSpacing: 1, marginBottom: 12 },
  commentList: { maxHeight: 280 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', flexShrink: 0 },
  commentBody: { flex: 1, gap: 4 },
  commentUsername: { color: Colors.textMuted, fontSize: 12 },
  commentText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  sincerityBadge: { color: Colors.primary, fontSize: 11 },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  warningBox: {
    backgroundColor: 'rgba(249,115,22,0.1)', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', gap: 6,
  },
  warningTitle: { color: '#FB923C', fontSize: 13, fontWeight: '600' },
  warningSuggestion: { color: Colors.textPrimary, fontSize: 13 },
  useBtn: { backgroundColor: 'rgba(249,115,22,0.2)', borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  useBtnText: { color: '#FB923C', fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12, color: Colors.textPrimary,
    fontSize: 14, borderWidth: 1, borderColor: Colors.border,
  },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
