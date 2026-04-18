import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { collection, doc, getDocs, setDoc, updateDoc, query, where, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, UserProfile } from '../../lib/firebase';
import { Colors, Gradients } from '../../constants/theme';
import StarGalaxy from '../../components/StarGalaxy';
import AvatarView from '../../components/AvatarView';

type FriendEntry = { id: string; profile: UserProfile; interactionScore?: number };
type Request = { id: string; requesterId: string; profile: UserProfile };

export default function FriendsScreen() {
  const [view, setView] = useState<'galaxy' | 'list'>('galaxy');
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [closeFriendIds, setCloseFriendIds] = useState<Set<string>>(new Set());
  const [requests, setRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => { if (uid) { fetchFriends(); fetchRequests(); fetchCloseFriends(); } }, [uid]);

  const fetchFriends = async () => {
    if (!uid) return;
    const snap = await getDocs(collection(db, 'users', uid, 'friends'));
    const list: FriendEntry[] = [];
    for (const d of snap.docs) {
      const pSnap = await getDoc(doc(db, 'users', d.id));
      if (pSnap.exists()) list.push({
        id: d.id,
        profile: { id: pSnap.id, ...pSnap.data() } as UserProfile,
        interactionScore: (d.data() as any).interactionScore ?? 0,
      });
    }
    setFriends(list);
  };

  const fetchCloseFriends = async () => {
    if (!uid) return;
    const snap = await getDocs(collection(db, 'users', uid, 'closeFriends'));
    setCloseFriendIds(new Set(snap.docs.map((d) => d.id)));
  };

  const fetchRequests = async () => {
    if (!uid) return;
    const snap = await getDocs(collection(db, 'users', uid, 'friendRequests'));
    const list: Request[] = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (data.status === 'pending') {
        const pSnap = await getDoc(doc(db, 'users', d.id));
        if (pSnap.exists()) list.push({ id: d.id, requesterId: d.id, profile: { id: pSnap.id, ...pSnap.data() } as UserProfile });
      }
    }
    setRequests(list);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const snap = await getDocs(collection(db, 'users'));
    const results = snap.docs
      .filter((d) => d.id !== uid && (d.data().username as string).toLowerCase().includes(q.toLowerCase()))
      .map((d) => ({ id: d.id, ...d.data() } as UserProfile))
      .slice(0, 10);
    setSearchResults(results);
  };

  const sendRequest = async (targetId: string) => {
    if (!uid) return;
    await setDoc(doc(db, 'users', targetId, 'friendRequests', uid), {
      status: 'pending', createdAt: serverTimestamp(),
    });
    Alert.alert('已发送', '好友请求已发出');
  };

  const acceptRequest = async (requesterId: string) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid, 'friendRequests', requesterId), { status: 'accepted' });
    await setDoc(doc(db, 'users', uid, 'friends', requesterId), { createdAt: serverTimestamp() });
    await setDoc(doc(db, 'users', requesterId, 'friends', uid), { createdAt: serverTimestamp() });
    fetchFriends();
    fetchRequests();
  };

  const toggleCloseFriend = async (friendId: string) => {
    if (!uid) return;
    if (closeFriendIds.has(friendId)) {
      await deleteDoc(doc(db, 'users', uid, 'closeFriends', friendId));
      setCloseFriendIds((prev) => { const s = new Set(prev); s.delete(friendId); return s; });
    } else {
      if (closeFriendIds.size >= 12) { Alert.alert('核心圈已满', '最多12人'); return; }
      await setDoc(doc(db, 'users', uid, 'closeFriends', friendId), { createdAt: serverTimestamp() });
      setCloseFriendIds((prev) => new Set([...prev, friendId]));
    }
  };

  const interactionScores: Record<string, number> = {};
  friends.forEach((f) => { interactionScores[f.id] = f.interactionScore ?? 0; });
  const galaxyFriends = friends.map((f) => ({ addressee_id: f.id, profiles: { username: f.profile.username, avatar_colors: f.profile.avatarColors, avatar_url: f.profile.avatarUrl } }));
  const galaxyClose = [...closeFriendIds].map((id) => ({ friend_id: id, last_interaction: '', profiles: undefined }));

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A0F1E', '#161B2D']} style={StyleSheet.absoluteFill} />
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>星链</Text>
          <View style={styles.viewToggle}>
            {(['galaxy', 'list'] as const).map((v) => (
              <TouchableOpacity key={v} onPress={() => setView(v)} style={[styles.toggleBtn, view === v && styles.toggleActive]}>
                <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>{v === 'galaxy' ? '星系' : '列表'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {view === 'galaxy' ? (
        <StarGalaxy friends={galaxyFriends} closeFriends={galaxyClose} interactionScores={interactionScores} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {requests.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>待接受 ({requests.length})</Text>
                  {requests.map((req) => (
                    <View key={req.id} style={styles.row}>
                      <AvatarCircle colors={req.profile.avatarColors} url={req.profile.avatarUrl} size={40} />
                      <Text style={styles.username}>{req.profile.username}</Text>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(req.requesterId)}>
                        <Text style={styles.acceptBtnText}>接受</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>搜索用户</Text>
                <TextInput style={styles.searchInput} placeholder="输入昵称..." placeholderTextColor={Colors.textMuted}
                  value={searchQuery} onChangeText={(t) => { setSearchQuery(t); searchUsers(t); }} />
                {searchResults.map((u) => (
                  <View key={u.id} style={styles.row}>
                    <AvatarCircle colors={u.avatarColors} url={u.avatarUrl} size={40} />
                    <Text style={styles.username}>{u.username}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(u.id)}>
                      <Text style={styles.addBtnText}>+ 加友</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              <Text style={styles.sectionTitle}>好友 ({friends.length})</Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50)} style={styles.friendRow}>
              <AvatarCircle colors={item.profile.avatarColors} url={item.profile.avatarUrl} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.username}>{item.profile.username}</Text>
                {closeFriendIds.has(item.id) && <Text style={styles.coreTag}>核心圈 ✦</Text>}
              </View>
              <TouchableOpacity style={[styles.coreBtn, closeFriendIds.has(item.id) && styles.coreBtnActive]} onPress={() => toggleCloseFriend(item.id)}>
                <Text style={styles.coreBtnText}>{closeFriendIds.has(item.id) ? '已在核心圈' : '加入核心圈'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function AvatarCircle({ colors, url, size }: { colors?: string[]; url?: string; size: number }) {
  return <AvatarView url={url} colors={colors} size={size} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '600', letterSpacing: 1 },
  viewToggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  toggleActive: { backgroundColor: 'rgba(255,179,71,0.15)', borderColor: Colors.primary },
  toggleText: { color: Colors.textMuted, fontSize: 13 },
  toggleTextActive: { color: Colors.primary },
  list: { paddingBottom: 70 },
  listHeader: { paddingHorizontal: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 13, letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  searchInput: { backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, color: Colors.textPrimary, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 20 },
  username: { color: Colors.textPrimary, fontSize: 15 },
  coreTag: { color: Colors.primary, fontSize: 11, marginTop: 2 },
  acceptBtn: { backgroundColor: 'rgba(255,179,71,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.primary },
  acceptBtnText: { color: Colors.primary, fontSize: 13 },
  addBtn: { backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  addBtnText: { color: Colors.textSecondary, fontSize: 13 },
  coreBtn: { backgroundColor: Colors.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border },
  coreBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(255,179,71,0.15)' },
  coreBtnText: { color: Colors.textMuted, fontSize: 12 },
});
