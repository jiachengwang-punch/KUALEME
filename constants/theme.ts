export const Colors = {
  bg: '#F8FBFE',
  bgEnd: '#FFF5ED',
  surface: 'rgba(255,255,255,0.6)',
  border: 'rgba(255,255,255,0.8)',
  borderLight: 'rgba(255,255,255,0.6)',
  primary: '#FFAC81',
  primaryAlt: '#FFD194',
  secondary: '#AED6F1',
  gold: '#FFD194',
  textPrimary: '#34495E',
  textBody: '#5D6D7E',
  textSecondary: '#7F8C8D',
  textMuted: '#ABB2B9',
  tabActive: '#FF8C69',
  tabInactive: '#BFC9CA',
};

export const Gradients = {
  starlight: ['#FFD194', '#FFAC81'] as const,
  glimmer: ['#AED6F1', '#85C1E9'] as const,
  splash: ['#E1F0F7', '#F8FBFE', '#FFF5ED'] as const,
  publishBtn: ['#FFD194', '#FFAC81'] as const,
  bg: ['#E1F0F7', '#F8FBFE', '#FFF5ED'] as const,
};

export const Layout = {
  cardRadius: 20,
  cardMarginH: 16,
  cardMarginV: 16,
  blur: 20,
};

export const Shadow = {
  card: {
    shadowColor: '#D1E1E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const Typography = {
  heading: { fontSize: 24, fontWeight: '600' as const, letterSpacing: 1 },
  username: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '400' as const },
};
