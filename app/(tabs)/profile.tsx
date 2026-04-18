import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, SafeAreaView, Modal, Platform } from 'react-native';
import { showAlert } from '../../lib/alert';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db, UserProfile } from '../../lib/firebase';
import { generateAvatarColors } from '../../lib/openai';
import { HapticPatterns } from '../../lib/haptics';
import { Sounds } from '../../lib/audio';
import { Colors, Gradients } from '../../constants/theme';
import { usePostsContext } from '../../lib/PostsContext';
import AvatarView from '../../components/AvatarView';
import InviteCard from '../../components/InviteCard';
import OpenAI from 'openai';

const ACHIEVEMENTS = [
  { min: 500, label: '宇宙先锋', icon: '✺', next: null },
  { min: 200, label: '能量守护者', icon: '★', next: 500 },
  { min: 80, label: '星光探索者', icon: '⭐', next: 200 },
  { min: 20, label: '微光使者', icon: '✦', next: 80 },
  { min: 0, label: '初升之星', icon: '☆', next: 20 },
];

function getAchievement(score: number) {
  return ACHIEVEMENTS.find((a) => score >= a.min) ?? ACHIEVEMENTS[ACHIEVEMENTS.length - 1];
}

type Breakthrough = {
  id: string;
  senderId: string;
  targetId: string;
  originalContent: string;
  polishedContent: string;
  isLiked: boolean;
  senderProfile?: UserProfile;
  targetProfile?: UserProfile;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showBreakthrough, setShowBreakthrough] = useState(false);
  const [received, setReceived] = useState<Breakthrough[]>([]);
  const [sent, setSent] = useState<Breakthrough[]>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [targetResults, setTargetResults] = useState<UserProfile[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<UserProfile | null>(null);
  const [btContent, setBtContent] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [polished, setPolished] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const { uid } = usePostsContext();

  useEffect(() => { if (uid) loadAll(); }, [uid]);

  const loadAll = async () => {
    if (!uid) return;
    const pSnap = await getDoc(doc(db, 'users', uid));
    if (pSnap.exists()) setProfile({ id: pSnap.id, ...pSnap.data() } as UserProfile);

    const btSnap = await getDocs(collection(db, 'breakthroughs'));
    const allBt = btSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Breakthrough));

    const recvList: Breakthrough[] = [];
    const sentList: Breakthrough[] = [];
    for (const bt of allBt) {
      if (bt.targetId === uid) {
        const sSnap = await getDoc(doc(db, 'users', bt.senderId));
        recvList.push({ ...bt, senderProfile: sSnap.exists() ? { id: sSnap.id, ...sSnap.data() } as UserProfile : undefined });
      }
      if (bt.senderId === uid) {
        const tSnap = await getDoc(doc(db, 'users', bt.targetId));
        sentList.push({ ...bt, targetProfile: tSnap.exists() ? { id: tSnap.id, ...tSnap.data() } as UserProfile : undefined });
      }
    }
    setReceived(recvList);
    setSent(sentList);
  };

  const regenerateAvatar = async () => {
    if (!profile || !uid) return;
    const colors = await generateAvatarColors(profile.username);
    await updateDoc(doc(db, 'users', uid), { avatarColors: colors, avatarUrl: '' });
    setProfile({ ...profile, avatarColors: colors, avatarUrl: undefined });
  };

  const pickAndUploadAvatar = async () => {
    if (!uid) return;

    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);

      const cleanup = () => {
        if (document.body.contains(input)) document.body.removeChild(input);
      };

      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        cleanup();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const src = ev.target?.result as string;
          if (!src) return;
          const img = new Image();
          img.onload = async () => {
            const size = 300;
            const canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            const min = Math.min(img.width, img.height);
            const sx = (img.width - min) / 2;
            const sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            const dataUri = canvas.toDataURL('image/jpeg', 0.6);
            try {
              await updateDoc(doc(db, 'users', uid), { avatarUrl: dataUri });
              setProfile((prev) => prev ? { ...prev, avatarUrl: dataUri } : prev);
            } catch (err: any) {
              showAlert('上传失败', err.message);
            }
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
      };

      // 用户取消选择时清理（window focus 在对话框关闭后触发）
      const onFocus = () => { setTimeout(cleanup, 300); window.removeEventListener('focus', onFocus); };
      window.addEventListener('focus', onFocus);

      input.click();
      return;
    }

    // native
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('需要相册权限'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true,
      aspect: [1, 1], quality: 0.5, base64: true,
    });
    if (result.canceled) return;
    try {
      const b64 = result.assets[0].base64;
      if (!b64) return;
      const dataUri = `data:image/jpeg;base64,${b64}`;
      await updateDoc(doc(db, 'users', uid), { avatarUrl: dataUri });
      setProfile((prev) => prev ? { ...prev, avatarUrl: dataUri } : prev);
    } catch (err: any) {
      showAlert('上传失败', err.message);
    }
  };

  const searchTarget = async (q: string) => {
    if (!q.trim()) { setTargetResults([]); return; }
    const snap = await getDocs(collection(db, 'users'));
    setTargetResults(
      snap.docs.filter((d) => d.id !== uid && (d.data().username as string).toLowerCase().includes(q.toLowerCase()))
        .map((d) => ({ id: d.id, ...d.data() } as UserProfile)).slice(0, 8)
    );
  };

  const polishContent = async () => {
    if (!btContent.trim()) return;
    setPolishing(true);
    const client = new OpenAI({ apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY!, dangerouslyAllowBrowser: true });
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '你是文案专家，将用户事迹润色为简洁有力的"高光简报"，适合展示给目标人物。保留核心事实，语气自信不浮夸，100字以内。只返回润色后的文案。' },
        { role: 'user', content: btContent },
      ],
    });
    setPolished(res.choices[0].message.content ?? '');
    HapticPatterns.aiSuccess();
    Sounds.aiDone();
    setPolishing(false);
  };

  const sendBreakthrough = async () => {
    if (!selectedTarget || !polished || !uid) return;
    await addDoc(collection(db, 'breakthroughs'), {
      senderId: uid, targetId: selectedTarget.id,
      originalContent: btContent, polishedContent: polished,
      isLiked: false, createdAt: serverTimestamp(),
    });
    HapticPatterns.deliver();
    Sounds.deliver();
    showAlert('已投递', `高光简报已送达 ${selectedTarget.username}`);
    setShowBreakthrough(false);
    setBtContent(''); setPolished(''); setSelectedTarget(null);
    loadAll();
  };

  const likeBreakthrough = async (btId: string) => {
    await updateDoc(doc(db, 'breakthroughs', btId), { isLiked: true });
    setReceived((prev) => prev.map((b) => b.id === btId ? { ...b, isLiked: true } : b));
  };

  const avatarColors = (profile?.avatarColors ?? ['#7C3AED', '#EC4899', '#F59E0B']) as [string, string, string];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#E1F0F7', '#F8FBFE', '#FFF5ED']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>我</Text>
          <TouchableOpacity onPress={() => signOut(auth)} style={styles.signOutBtn}>
            <Text style={styles.signOutText}>退出</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown} style={styles.avatarSection}>
          <AvatarView url={profile?.avatarUrl} colors={avatarColors} size={100} borderWidth={2} borderColor={Colors.primary} />
          <Text style={styles.username}>{profile?.username}</Text>
          <Text style={styles.energyScore}>能量值 {profile?.energyScore ?? 0}</Text>
          <AchievementBadge score={profile?.energyScore ?? 0} />
          <View style={styles.avatarBtns}>
            <TouchableOpacity style={styles.avatarBtn} onPress={pickAndUploadAvatar}>
              <Text style={styles.avatarBtnText}>上传照片</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatarBtn} onPress={regenerateAvatar}>
              <Text style={styles.avatarBtnText}>AI 重新生成</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInvite(true)}>
            <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inviteBtnGradient}>
              <Text style={styles.inviteBtnText}>生成邀请卡 ★</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.btLaunchBtn} onPress={() => setShowBreakthrough(true)}>
          <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.btGradient}>
            <Text style={styles.btLaunchText}>⚡ 攻坚模式</Text>
            <Text style={styles.btLaunchSub}>将事迹精准投递给目标人物</Text>
          </LinearGradient>
        </TouchableOpacity>

        {received.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>收到的高光简报 ({received.length})</Text>
            {received.map((bt) => (
              <View key={bt.id} style={styles.btCard}>
                <Text style={styles.btFrom}>来自 {bt.senderProfile?.username}</Text>
                <Text style={styles.btContent}>{bt.polishedContent}</Text>
                {!bt.isLiked ? (
                  <TouchableOpacity style={styles.likeBtn} onPress={() => likeBreakthrough(bt.id)}>
                    <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.likeBtnGradient}>
                      <Text style={styles.likeBtnText}>点亮 TA ✦</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : <Text style={styles.likedTag}>已点亮 ✦</Text>}
              </View>
            ))}
          </View>
        )}

        {sent.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>已发送的简报 ({sent.length})</Text>
            {sent.map((bt) => (
              <View key={bt.id} style={[styles.btCard, styles.btSent]}>
                <Text style={styles.btFrom}>→ {bt.targetProfile?.username}</Text>
                <Text style={styles.btContent} numberOfLines={2}>{bt.polishedContent}</Text>
                <Text style={[styles.btStatus, bt.isLiked && styles.btStatusLiked]}>{bt.isLiked ? '已被点亮 ✦' : '等待回应...'}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <InviteCard
        visible={showInvite}
        username={profile?.username ?? ''}
        energyScore={profile?.energyScore ?? 0}
        avatarColors={avatarColors}
        avatarUrl={profile?.avatarUrl}
        userId={uid ?? ''}
        onClose={() => setShowInvite(false)}
      />

      <Modal visible={showBreakthrough} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowBreakthrough(false)}><Text style={styles.cancelText}>取消</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>攻坚模式</Text>
            <TouchableOpacity onPress={sendBreakthrough} disabled={!polished || !selectedTarget}>
              <Text style={[styles.sendText, (!polished || !selectedTarget) && { opacity: 0.3 }]}>投递</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll}>
            <Text style={styles.fieldLabel}>目标人物</Text>
            <TextInput style={styles.searchInput} placeholder="搜索用户名..." placeholderTextColor={Colors.textMuted}
              value={targetSearch} onChangeText={(t) => { setTargetSearch(t); searchTarget(t); }} />
            {targetResults.map((u) => (
              <TouchableOpacity key={u.id} style={[styles.targetRow, selectedTarget?.id === u.id && styles.targetRowSelected]}
                onPress={() => { setSelectedTarget(u); setTargetResults([]); setTargetSearch(u.username); }}>
                <Text style={styles.targetName}>{u.username}</Text>
                {selectedTarget?.id === u.id && <Text style={styles.selectedMark}>✓</Text>}
              </TouchableOpacity>
            ))}
            <Text style={styles.fieldLabel}>你的事迹</Text>
            <TextInput style={[styles.searchInput, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder="描述你想展示的成就..." placeholderTextColor={Colors.textMuted}
              value={btContent} onChangeText={setBtContent} multiline />
            <TouchableOpacity style={[styles.polishBtn, (!btContent.trim() || polishing) && { opacity: 0.4 }]}
              onPress={polishContent} disabled={!btContent.trim() || polishing}>
              <Text style={styles.polishBtnText}>{polishing ? 'AI 润色中...' : 'AI 一键润色 ✦'}</Text>
            </TouchableOpacity>
            {polished ? (
              <View style={styles.polishedBox}>
                <Text style={styles.polishedLabel}>高光简报预览</Text>
                <Text style={styles.polishedText}>{polished}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function AchievementBadge({ score }: { score: number }) {
  const ach = getAchievement(score);
  const progress = ach.next ? Math.min(1, score / ach.next) : 1;
  return (
    <View style={achStyles.container}>
      <View style={achStyles.badge}>
        <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <Text style={achStyles.icon}>{ach.icon}</Text>
        <Text style={achStyles.label}>{ach.label}</Text>
      </View>
      {ach.next && (
        <View style={achStyles.progressRow}>
          <View style={achStyles.progressBar}>
            <View style={[achStyles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
          <Text style={achStyles.progressText}>{score} / {ach.next}</Text>
        </View>
      )}
    </View>
  );
}

const achStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: 8, width: '100%' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7, overflow: 'hidden' },
  icon: { color: '#fff', fontSize: 14 },
  label: { color: '#fff', fontSize: 13, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, width: '100%' },
  progressBar: { flex: 1, height: 4, backgroundColor: 'rgba(52,73,94,0.08)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  progressText: { color: Colors.textMuted, fontSize: 11, minWidth: 48, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '600', letterSpacing: 1 },
  signOutBtn: { padding: 8 },
  signOutText: { color: Colors.textMuted, fontSize: 14 },
  scroll: { paddingHorizontal: 20, paddingBottom: 70 },
  avatarSection: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  username: { color: Colors.textPrimary, fontSize: 22, fontWeight: '500', letterSpacing: 1 },
  avatarBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  avatarBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  avatarBtnText: { color: Colors.textSecondary, fontSize: 13 },
  inviteBtn: { borderRadius: 20, overflow: 'hidden', marginTop: 4 },
  inviteBtnGradient: { paddingHorizontal: 24, paddingVertical: 10 },
  inviteBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  energyScore: { color: Colors.primary, fontSize: 13 },
  btLaunchBtn: { borderRadius: 20, overflow: 'hidden', marginBottom: 32 },
  btGradient: { padding: 20, alignItems: 'center', gap: 6 },
  btLaunchText: { color: '#fff', fontSize: 18, fontWeight: '500' },
  btLaunchSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 13, letterSpacing: 1, marginBottom: 12 },
  btCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  btSent: { borderColor: 'rgba(255,172,129,0.2)' },
  btFrom: { color: Colors.textMuted, fontSize: 12 },
  btContent: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22 },
  likeBtn: { borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' },
  likeBtnGradient: { paddingHorizontal: 16, paddingVertical: 8 },
  likeBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  likedTag: { color: Colors.primary, fontSize: 13 },
  btStatus: { color: Colors.textMuted, fontSize: 12 },
  btStatusLiked: { color: Colors.primary },
  modal: { flex: 1, backgroundColor: 'rgba(255,255,255,0.97)' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  cancelText: { color: Colors.textMuted, fontSize: 16 },
  modalTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '500' },
  sendText: { color: Colors.primary, fontSize: 16, fontWeight: '600' },
  modalScroll: { padding: 20 },
  fieldLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 8, marginTop: 16 },
  searchInput: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.textPrimary, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 6 },
  targetRowSelected: { borderWidth: 1, borderColor: Colors.primary },
  targetName: { color: Colors.textPrimary, fontSize: 15 },
  selectedMark: { color: Colors.primary, fontSize: 16 },
  polishBtn: { backgroundColor: 'rgba(255,172,129,0.12)', borderRadius: 20, paddingVertical: 14, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,172,129,0.35)' },
  polishBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '500' },
  polishedBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,172,129,0.25)', gap: 10 },
  polishedLabel: { color: Colors.primary, fontSize: 12, letterSpacing: 1 },
  polishedText: { color: Colors.textPrimary, fontSize: 16, lineHeight: 26 },
});
