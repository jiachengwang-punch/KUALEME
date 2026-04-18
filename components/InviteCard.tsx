import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, SlideInUp } from 'react-native-reanimated';
import { Colors, Gradients } from '../constants/theme';
import AvatarView from './AvatarView';

type Props = {
  visible: boolean;
  username: string;
  energyScore: number;
  avatarColors?: string[];
  avatarUrl?: string;
  userId: string;
  onClose: () => void;
};

export default function InviteCard({ visible, username, energyScore, avatarColors, avatarUrl, userId, onClose }: Props) {
  const inviteCode = userId.slice(0, 6).toUpperCase();
  const inviteUrl = `https://kualeme-nwnl.vercel.app`;

  const copyLink = async () => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${inviteUrl}\n邀请码：${inviteCode}`);
      Alert.alert('已复制', '邀请链接已复制到剪贴板');
    }
  };

  const downloadCard = () => {
    if (Platform.OS !== 'web') return;
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 560;
    const ctx = canvas.getContext('2d')!;

    // background
    const bg = ctx.createLinearGradient(0, 0, 400, 560);
    bg.addColorStop(0, '#E1F0F7');
    bg.addColorStop(0.5, '#F8FBFE');
    bg.addColorStop(1, '#FFF5ED');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 400, 560);

    // border
    ctx.strokeStyle = 'rgba(255,172,129,0.4)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(10, 10, 380, 540, 24);
    ctx.stroke();

    // avatar circle
    const avatarGrad = ctx.createLinearGradient(160, 80, 240, 160);
    const c = avatarColors ?? ['#FFD194', '#FFAC81', '#AED6F1'];
    avatarGrad.addColorStop(0, c[0]);
    avatarGrad.addColorStop(1, c[c.length - 1]);
    ctx.beginPath();
    ctx.arc(200, 140, 52, 0, Math.PI * 2);
    ctx.fillStyle = avatarGrad;
    ctx.fill();
    ctx.strokeStyle = '#FFAC81';
    ctx.lineWidth = 2;
    ctx.stroke();

    // title
    ctx.fillStyle = '#34495E';
    ctx.font = '700 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('夸了嘛', 200, 240);

    // tagline
    ctx.fillStyle = '#ABB2B9';
    ctx.font = '400 13px sans-serif';
    ctx.fillText('美好世界，美丽心情', 200, 268);

    // divider
    ctx.strokeStyle = 'rgba(52,73,94,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 290);
    ctx.lineTo(340, 290);
    ctx.stroke();

    // username
    ctx.fillStyle = '#34495E';
    ctx.font = '500 20px sans-serif';
    ctx.fillText(username, 200, 330);

    // energy
    ctx.fillStyle = '#FFAC81';
    ctx.font = '400 13px sans-serif';
    ctx.fillText(`能量值 ${energyScore}`, 200, 358);

    // invite code label
    ctx.fillStyle = '#ABB2B9';
    ctx.font = '400 11px sans-serif';
    ctx.fillText('邀请码', 200, 420);

    // invite code value
    const codeGrad = ctx.createLinearGradient(140, 430, 260, 450);
    codeGrad.addColorStop(0, '#FFD194');
    codeGrad.addColorStop(1, '#FFAC81');
    ctx.fillStyle = codeGrad;
    ctx.font = '700 22px monospace';
    ctx.fillText(inviteCode, 200, 448);

    // bottom url
    ctx.fillStyle = '#BFC9CA';
    ctx.font = '400 11px sans-serif';
    ctx.fillText(inviteUrl, 200, 510);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `kualeme-invite-${inviteCode}.png`;
    a.click();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn} style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInUp.springify().damping(18)} style={styles.sheet}>

          {/* card preview */}
          <View style={styles.card}>
            <LinearGradient colors={['rgba(255,179,71,0.15)', 'rgba(112,161,255,0.08)']} style={StyleSheet.absoluteFill} />
            <View style={styles.cardInner}>
              <AvatarView url={avatarUrl} colors={avatarColors} size={80} borderWidth={2} borderColor={Colors.primary} />
              <Text style={styles.appName}>夸了嘛</Text>
              <Text style={styles.appTagline}>美好世界，美丽心情</Text>
              <View style={styles.divider} />
              <Text style={styles.cardUsername}>{username}</Text>
              <Text style={styles.cardEnergy}>能量值 {energyScore}</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>邀请码</Text>
                <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.codeGradient}>
                  <Text style={styles.codeText}>{inviteCode}</Text>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={copyLink}>
              <Text style={styles.actionBtnText}>复制邀请链接</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' && (
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={downloadCard}>
                <LinearGradient colors={Gradients.starlight} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.actionGradient}>
                  <Text style={styles.actionBtnPrimaryText}>下载邀请卡</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>关闭</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(52,73,94,0.3)' },
  sheet: {
    backgroundColor: 'rgba(248,251,254,0.97)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: 'rgba(52,73,94,0.1)',
    alignItems: 'center', gap: 16,
  },
  card: {
    width: '100%', borderRadius: 24, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,172,129,0.3)',
  },
  cardInner: { alignItems: 'center', padding: 28, gap: 8 },
  appName: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', letterSpacing: 2 },
  appTagline: { color: Colors.textMuted, fontSize: 12, letterSpacing: 1 },
  divider: { width: '60%', height: 1, backgroundColor: 'rgba(52,73,94,0.08)', marginVertical: 8 },
  cardUsername: { color: Colors.textPrimary, fontSize: 20, fontWeight: '500' },
  cardEnergy: { color: Colors.primary, fontSize: 13 },
  codeBox: { alignItems: 'center', gap: 4, marginTop: 8 },
  codeLabel: { color: Colors.textMuted, fontSize: 11, letterSpacing: 1 },
  codeGradient: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  codeText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 4 },
  actions: { flexDirection: 'row', gap: 10, width: '100%' },
  actionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 20, alignItems: 'center',
    backgroundColor: 'rgba(52,73,94,0.06)', borderWidth: 1, borderColor: 'rgba(52,73,94,0.12)',
  },
  actionBtnText: { color: Colors.textSecondary, fontSize: 14 },
  actionBtnPrimary: { overflow: 'hidden', borderWidth: 0 },
  actionGradient: { width: '100%', paddingVertical: 14, alignItems: 'center', borderRadius: 20 },
  actionBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  closeBtn: { paddingVertical: 8 },
  closeBtnText: { color: Colors.textMuted, fontSize: 14 },
});
