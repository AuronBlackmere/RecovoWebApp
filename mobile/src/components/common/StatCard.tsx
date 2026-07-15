import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '@/utils/theme';
import { useTheme } from '@/hooks/useTheme';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  sub?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, unit, accent = COLORS.accent, sub,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: accent }]}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color: accent }]}>{unit}</Text>}
      </View>
      {sub && <Text style={[styles.sub, { color: colors.textMuted }]}>{sub}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    flex: 1,
    minWidth: 100,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  value: {
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 1,
    lineHeight: 32,
  },
  unit: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginBottom: 4,
  },
  sub: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    marginTop: 4,
  },
});
