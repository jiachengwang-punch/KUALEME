export const Colors = {
  bg: '#0A0F1E',
  bgEnd: '#161B2D',
  surface: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
  borderLight: 'rgba(255,255,255,0.06)',
  primary: '#FFB347',
  primaryAlt: '#FF7E5F',
  secondary: '#70A1FF',
  gold: '#FFCC33',
  textPrimary: '#FFFFFF',
  textBody: 'rgba(255,255,255,0.9)',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.35)',
};

export const Gradients = {
  starlight: ['#FFB347', '#FF7E5F'] as const,
  glimmer: ['#70A1FF', '#7ECEF4'] as const,
  splash: ['#060A14', '#0A0F1E', '#161B2D'] as const,
  publishBtn: ['#FFB347', '#FFCC33'] as const,
  bg: ['#0A0F1E', '#161B2D'] as const,
};

export const Layout = {
  cardRadius: 20,
  cardMarginH: 16,
  cardMarginV: 12,
  blur: 20,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
};

export const Typography = {
  heading: { fontSize: 24, fontWeight: '600' as const, letterSpacing: 1 },
  username: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24 },
  caption: { fontSize: 12, fontWeight: '400' as const },
};
