import React from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface BouncyButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
}

export function BouncyButton({ onPress, children, style, disabled, scaleTo = 0.95 }: BouncyButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Pressable
      onPressIn={() => {
        if (!disabled) {
          scale.value = withSpring(scaleTo, { damping: 10, stiffness: 400 });
        }
      }}
      onPressOut={() => {
        if (!disabled) {
          scale.value = withSpring(1, { damping: 10, stiffness: 400 });
        }
      }}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
