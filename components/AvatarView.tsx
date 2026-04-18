import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  url?: string;
  colors?: string[];
  size: number;
  borderColor?: string;
  borderWidth?: number;
};

export default function AvatarView({ url, colors, size, borderColor, borderWidth = 0 }: Props) {
  const c = (colors?.length ? colors : ['#FFB347', '#FF7E5F', '#70A1FF']) as [string, string, string];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth, borderColor }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
      ) : (
        <LinearGradient colors={c} style={{ flex: 1 }} />
      )}
    </View>
  );
}
