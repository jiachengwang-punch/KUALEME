import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Profile } from '../../lib/supabase';
import { Colors } from '../../constants/theme';
import StarGalaxy from '../../components/StarGalaxy';

type Friendship = {
  id: string;
  status: 'pending' | 'accepted';
  requester_id: string;
  addressee_id: string;
  profiles?: Profile;
  energy_score?: number;
  last_interaction?: string;
};

type CloseFriend = {
  id: string;
  friend_id: string;
  last_interaction: string;
  profiles?: Profile;
};

export default function FriendsScreen() {
  const [view, setView] = useState<'galaxy' | 'list'>('galaxy');
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [closeFriends, setCloseFriends] = useState<CloseFriend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        fetchFriends(user.id);
        fetchCloseFriends(user.id);
        fetchPendingRequests(user.id);
      }
    });
  }, []);

  const fetchFriends = async (uid: string) => {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_addressee_id_fkey(id, username, avatar_colors, energy_score)')
      .eq('requester_id', uid)
      .eq('status', 'accepted');
    if (data) setFriends(data as Friendship[]);
  };

  const fetchCloseFriends = async (uid: string) => {
    const { data } = await supabase
      .from('close_friends')
      .select('*, profiles!close_friends_friend_id_fkey(id, username, avatar_colors, energy_score)')
      .eq('user_id', uid);
    if (data) setCloseFriends(data as CloseFriend[]);
  };

  const fetchPendingRequests = async (uid: string) => {
    const { data } = await supabase
      .from('friendships')
      .select('*, profiles!friendships_requester_id_fkey(id, username, avatar_colors)')
      .eq('addressee_id', uid)
      .eq('status', 'pending');
    if (data) setPendingRequests(data as Friendship[]);
  };

  const searchUsers = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_colors')
      .ilike('username', `%${q}%`)
      .neq('id', currentUserId)
      .limit(10);
    if (data) setSearchResults(data as Profile[]);
  };

  const sendRequest = async (targetId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: targetId,
    });
    if (error) Alert.alert('发送失败', error.message);
    else Alert.alert('已发送', '好友请求已发出');
  };

  const acceptRequest = async (friendshipId: string, requesterId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    await supabase.from('friendships').insert({
      requester_id: currentUserId,
      addressee_id: requesterId,
      status: 'accepted',
    });
    if (currentUserId) fetchPendingRequests(currentUserId);
    if (currentUserId) fetchFriends(currentUserId);
  };

  const addToCloseFriends = async (friendId: string) => {
    if (closeFriends.length >= 12) {
      Alert.alert('核心圈已满', '亲密关系最多12人');
      return;
    }
    if (!currentUserId) return;
    await supabase.from('close_friends').insert({ user_id: currentUserId, friend_id: friendId });
    fetchCloseFriends(currentUserId);
  };

  const removeFromCloseFriends = async (friendId: string) => {
    if (!currentUserId) return;
    await supabase.from('close_friends').delete()
      .eq('user_id', currentUserId).eq('friend_id', friendId);
    fetchCloseFriends(currentUserId);
  };

  const isCloseFriend = (fid: string) => closeFriends.some((cf) => cf.friend_id === fid);

  return (
    <View style={styles.container}>
      <SafeAreaView>
        <View style={styles.header}>
          <Text style={styles.title}>星链</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity onPress={() => setView('galaxy')} style={[styles.toggleBtn, view === 'galaxy' && styles.toggleActive]}>
              <Text style={[styles.toggleText, view === 'galaxy' && styles.toggleTextActive]}>星系</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setView('list')} style={[styles.toggleBtn, view === 'list' && styles.toggleActive]}>
              <Text style={[styles.toggleText, view === 'list' && styles.toggleTextActive]}>列表</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {view === 'galaxy' ? (
        <StarGalaxy friends={friends} closeFriends={closeFriends} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {pendingRequests.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>待接受 ({pendingRequests.length})</Text>
                  {pendingRequests.map((req) => (
                    <View key={req.id} style={styles.requestRow}>
                      <AvatarCircle colors={req.profiles?.avatar_colors} size={40} />
                      <Text style={styles.username}>{req.profiles?.username}</Text>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => acceptRequest(req.id, req.requester_id)}
                      >
                        <Text style={styles.acceptBtnText}>接受</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>搜索用户</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="输入昵称..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={(t) => { setSearchQuery(t); searchUsers(t); }}
                />
                {searchResults.map((user) => (
                  <View key={user.id} style={styles.requestRow}>
                    <AvatarCircle colors={user.avatar_colors} size={40} />
                    <Text style={styles.username}>{user.username}</Text>
                    <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(user.id)}>
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
              <AvatarCircle colors={(item as any).profiles?.avatar_colors} size={44} />
              <View style={styles.friendInfo}>
                <Text style={styles.username}>{(item as any).profiles?.username}</Text>
                {isCloseFriend(item.addressee_id) && (
                  <Text style={styles.coreTag}>核心圈 ✦</Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.coreBtn, isCloseFriend(item.addressee_id) && styles.coreBtnActive]}
                onPress={() =>
                  isCloseFriend(item.addressee_id)
                    ? removeFromCloseFriends(item.addressee_id)
                    : addToCloseFriends(item.addressee_id)
                }
              >
                <Text style={styles.coreBtnText}>
                  {isCloseFriend(item.addressee_id) ? '已在核心圈' : '加入核心圈'}
                </Text>
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

function AvatarCircle({ colors, size }: { colors?: string[]; size: number }) {
  const c = (colors ?? ['#7C3AED', '#EC4899', '#F59E0B']) as [string, string, string];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <LinearGradient colors={c} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  title: { color: Colors.textPrimary, fontSize: 28, fontWeight: '300', letterSpacing: 2 },
  viewToggle: { flexDirection: 'row', gap: 8 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: Colors.surface },
  toggleActive: { backgroundColor: 'rgba(192,132,252,0.2)' },
  toggleText: { color: Colors.textMuted, fontSize: 13 },
  toggleTextActive: { color: Colors.primary },
  list: { paddingBottom: 100 },
  listHeader: { paddingHorizontal: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { color: Colors.textSecondary, fontSize: 13, letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  searchInput: {
    backgroundColor: Colors.surface, borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 12, color: Colors.textPrimary, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  requestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 20,
  },
  friendInfo: { flex: 1 },
  username: { color: Colors.textPrimary, fontSize: 15 },
  coreTag: { color: Colors.primary, fontSize: 11, marginTop: 2 },
  acceptBtn: {
    backgroundColor: 'rgba(192,132,252,0.2)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  acceptBtnText: { color: Colors.primary, fontSize: 13 },
  addBtn: {
    backgroundColor: Colors.surface, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border,
  },
  addBtnText: { color: Colors.textSecondary, fontSize: 13 },
  coreBtn: {
    backgroundColor: Colors.surface, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border,
  },
  coreBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(192,132,252,0.15)' },
  coreBtnText: { color: Colors.textMuted, fontSize: 12 },
});
