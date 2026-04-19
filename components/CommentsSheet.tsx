import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator,
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
  replyToUsername?: string;
};

type Props = {
  visible: boolean;
  postId: string;
  postContent: string;
  onClose: () => void;
  onSubmit: (text: string, score: number, replyTo?: { id: string; username: string }) => Promise<void>;
};

export default function CommentsSheet({ visible, postId, postContent, onClose, onSubmit }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);

  useEffect(() => {
    if (visible && postId) fetchComments();
    if (!visible) { setReplyTo(null); setText(''); setWarning(null); }
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
      list.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
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
    await onSubmit(text, score, replyTo ?? undefined);
    setText('');
    setWarning(null);
    setReplyTo(null);
    setSubmitting(false);
    fetchComments();
  };

  const useSuggestion = () => { if (warning) setText(warning); setWarning(null); };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
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
              <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
                {comments.length === 0 && (
                  <Text style={styles.emptyText}>还没有留言，来第一个吧</Text>
                )}
                {comments.map((item) => (
                  <View key={item.id} style={[styles.commentRow, !!item.replyToUsername && styles.commentReply]}>
                    {!!item.replyToUsername && <View style={styles.replyLine} />}
                    <View style={styles.commentAvatar}>
                      <LinearGradient
                        colors={(item.avatarColors ?? ['#FFD194', '#FFAC81', '#AED6F1']) as [string, string, string]}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentUsername}>{item.username}</Text>
                        <TouchableOpacity onPress={() => { setReplyTo({ id: item.id, username: item.username ?? '匿名' }); }}>
                          <Text style={styles.replyBtn}>回复</Text>
                        </TouchableOpacity>
                      </View>
                      {item.replyToUsername && (
                        <Text style={styles.replyTag}>@ {item.replyToUsername}</Text>
                      )}
                      <Text style={styles.commentText}>{item.content}</Text>
                      {item.sincerityScore >= 85 && (
                        <Text style={styles.sincerityBadge}>真诚暴击 ✦</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
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

            {replyTo && (
              <View style={styles.replyIndicator}>
                <Text style={styles.replyIndicatorText}>回复 @{replyTo.username}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Text style={styles.replyIndicatorCancel}>×</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder={replyTo ? `回复 @${replyTo.username}...` : '说点温暖的话...'}
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
    backgroundColor: 'rgba(255,255,255,0.97)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36, maxHeight: '80%',
    borderTopWidth: 1, borderColor: 'rgba(52,73,94,0.1)',
  },
  handle: { width: 36, height: 4, backgroundColor: 'rgba(52,73,94,0.12)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  postPreview: { backgroundColor: 'rgba(52,73,94,0.05)', borderRadius: 14, padding: 12, marginBottom: 14 },
  postPreviewText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20 },
  sectionLabel: { color: Colors.textMuted, fontSize: 12, letterSpacing: 1, marginBottom: 12 },
  commentList: { maxHeight: 300 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  commentReply: { paddingLeft: 16 },
  replyLine: { position: 'absolute', left: 6, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(52,73,94,0.08)', borderRadius: 1 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden', flexShrink: 0 },
  commentBody: { flex: 1, gap: 3 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentUsername: { color: Colors.textMuted, fontSize: 12 },
  replyBtn: { color: Colors.primary, fontSize: 11 },
  replyTag: { color: Colors.primary, fontSize: 11, opacity: 0.7 },
  commentText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  sincerityBadge: { color: Colors.primary, fontSize: 11 },
  emptyText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
  warningBox: {
    backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', gap: 6,
  },
  warningTitle: { color: '#FB923C', fontSize: 13, fontWeight: '600' },
  warningSuggestion: { color: Colors.textPrimary, fontSize: 13 },
  useBtn: { backgroundColor: 'rgba(249,115,22,0.15)', borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  useBtnText: { color: '#FB923C', fontSize: 13 },
  replyIndicator: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(255,172,129,0.1)', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 8,
  },
  replyIndicatorText: { color: Colors.primary, fontSize: 12 },
  replyIndicatorCancel: { color: Colors.textMuted, fontSize: 16, paddingLeft: 12 },
  inputRow: { flexDirection: 'row', gap: 10, marginTop: 4, alignItems: 'center' },
  input: {
    flex: 1, backgroundColor: 'rgba(52,73,94,0.05)', borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12, color: Colors.textPrimary,
    fontSize: 14, borderWidth: 1, borderColor: 'rgba(52,73,94,0.1)',
  },
  sendBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
