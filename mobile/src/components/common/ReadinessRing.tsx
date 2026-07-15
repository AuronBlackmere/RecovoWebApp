import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS, FONTS } from '@/utils/theme';
import { getReadinessLabel } from '@/utils/calculations';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';

interface ReadinessRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ReadinessRing: React.FC<ReadinessRingProps> = ({
  score,
  size = 160,
  strokeWidth = 12,
  showLabel = true,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const { t } = useTranslation();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const { label, color } = getReadinessLabel(score, t);
  const { colors } = useTheme();

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: score / 100,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [score]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    // @ts-ignore
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="100%" stopColor={COLORS.purple} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>

      <View style={styles.center}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        {showLabel && (
          <Text style={[styles.label, { color }]}>{label}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontFamily: FONTS.display,
    fontSize: 42,
    letterSpacing: 2,
    lineHeight: 46,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 2,
  },
});
