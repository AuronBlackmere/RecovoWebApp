import { useAppStore } from '@/store/useAppStore';
import { COLORS } from '@/utils/theme';

export function useTheme() {
  const { profile } = useAppStore();
  const appearanceMode = profile?.appearance || 'dark';
  const isLight = appearanceMode === 'light';

  return {
    isLight,
    appearanceMode,
    colors: {
      ...COLORS,
      bg: isLight ? '#F4F4F5' : '#0A0A0B',
      bgCard: isLight ? '#FFFFFF' : '#18181B',
      bgCardHover: isLight ? '#E4E4E7' : '#1C1C1F',
      surface: isLight ? '#FFFFFF' : '#18181B',
      surfaceAlt: isLight ? '#F4F4F5' : '#1C1C1F',
      border: isLight ? '#E4E4E7' : '#27272A',
      borderAccent: isLight ? '#D4D4D8' : '#3F3F46',
      textPrimary: isLight ? '#09090B' : '#FAFAFA',
      textSecondary: isLight ? '#71717A' : '#A1A1AA',
      textMuted: isLight ? '#A1A1AA' : '#52525B',
    }
  };
}
