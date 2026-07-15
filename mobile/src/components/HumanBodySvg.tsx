import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Svg, {
  Defs, LinearGradient, Stop, Path, Circle, G, RadialGradient, Filter
} from 'react-native-svg';

export interface BodyRegion {
  id: string;
  label: string;
  cx: number;
  cy: number;
  r: number;
}

export const BODY_REGIONS: BodyRegion[] = [
  { id: 'head', label: 'Head', cx: 100, cy: 30, r: 18 },
  { id: 'neck', label: 'Neck', cx: 100, cy: 60, r: 12 },
  { id: 'left-shoulder', label: 'Left Shoulder', cx: 60, cy: 85, r: 16 },
  { id: 'right-shoulder', label: 'Right Shoulder', cx: 140, cy: 85, r: 16 },
  { id: 'left-chest', label: 'Left Chest', cx: 75, cy: 110, r: 18 },
  { id: 'right-chest', label: 'Right Chest', cx: 125, cy: 110, r: 18 },
  { id: 'core', label: 'Core / Abs', cx: 100, cy: 150, r: 22 },
  { id: 'left-hip', label: 'Left Hip', cx: 75, cy: 190, r: 16 },
  { id: 'right-hip', label: 'Right Hip', cx: 125, cy: 190, r: 16 },
  { id: 'left-quad', label: 'Left Quad', cx: 75, cy: 240, r: 18 },
  { id: 'right-quad', label: 'Right Quad', cx: 125, cy: 240, r: 18 },
  { id: 'left-knee', label: 'Left Knee', cx: 75, cy: 285, r: 14 },
  { id: 'right-knee', label: 'Right Knee', cx: 125, cy: 285, r: 14 },
  { id: 'left-shin', label: 'Left Shin', cx: 75, cy: 330, r: 14 },
  { id: 'right-shin', label: 'Right Shin', cx: 125, cy: 330, r: 14 },
  { id: 'left-foot', label: 'Left Foot', cx: 75, cy: 375, r: 12 },
  { id: 'right-foot', label: 'Right Foot', cx: 125, cy: 375, r: 12 },
];

interface HumanBodySvgProps {
  onRegionTap?: (region: BodyRegion) => void;
  activeRegionIds?: Set<string>;
  getMarkerColor?: (regionLabel: string) => string;
}

export default function HumanBodySvg({ onRegionTap, activeRegionIds = new Set(), getMarkerColor }: HumanBodySvgProps) {
  const bodyPath = `
    M 100 10
    C 112 10, 116 18, 115 28
    C 114 38, 108 45, 108 52
    C 120 55, 140 60, 148 70
    C 155 80, 150 90, 145 100
    L 138 120
    C 135 110, 130 115, 130 130
    C 130 150, 128 170, 125 190
    C 135 210, 138 230, 135 250
    C 132 270, 130 280, 130 290
    C 135 320, 135 340, 130 360
    C 125 380, 135 385, 135 390
    C 135 395, 115 395, 115 390
    C 115 385, 118 360, 115 340
    C 112 320, 108 280, 108 260
    C 108 240, 105 200, 105 210
    C 105 190, 95 190, 95 210
    C 95 200, 92 240, 92 260
    C 92 280, 88 320, 85 340
    C 82 360, 85 385, 85 390
    C 85 395, 65 395, 65 390
    C 65 385, 75 380, 70 360
    C 65 340, 65 320, 70 290
    C 70 280, 68 270, 65 250
    C 62 230, 65 210, 75 190
    C 72 170, 70 150, 70 130
    C 70 115, 65 110, 62 120
    L 55 100
    C 50 90, 45 80, 52 70
    C 60 60, 80 55, 92 52
    C 92 45, 86 38, 85 28
    C 84 18, 88 10, 100 10
    Z
  `;

  const contourPath = `
    M 100 14
    C 110 14, 113 20, 112 28
    C 111 36, 106 43, 106 49
    C 116 52, 134 57, 142 66
    C 148 75, 144 84, 139 93
    L 133 112
    C 130 102, 126 107, 126 120
    C 126 140, 124 160, 121 180
    C 130 200, 132 218, 130 236
    C 127 254, 126 264, 126 274
    C 130 302, 130 320, 126 339
    C 121 358, 130 363, 130 368
    C 130 373, 112 373, 112 368
    C 112 363, 114 340, 112 320
    C 109 302, 105 264, 105 245
    C 105 226, 102 188, 102 198
    C 102 180, 93 180, 93 198
    C 93 188, 90 226, 90 245
    C 90 264, 87 302, 84 320
    C 81 339, 84 363, 84 368
    C 84 373, 66 373, 66 368
    C 66 363, 75 358, 70 339
    C 66 320, 66 302, 70 274
    C 70 264, 69 254, 66 236
    C 63 218, 66 200, 75 180
    C 72 160, 70 140, 70 120
    C 70 107, 66 102, 63 112
    L 57 93
    C 52 84, 48 75, 54 66
    C 62 57, 80 52, 90 49
    C 90 43, 85 36, 84 28
    C 83 20, 86 14, 100 14
    Z
  `;

  const absPath = `
    M 90 120 C 100 125, 110 120, 110 120
    M 92 135 C 100 140, 108 135, 108 135
    M 93 150 C 100 155, 107 150, 107 150
    M 95 165 C 100 170, 105 165, 105 165
  `;
  const chestPath = `
    M 70 100 C 85 110, 100 100, 100 100
    M 130 100 C 115 110, 100 100, 100 100
    M 100 65 L 100 100
  `;

  return (
    <View style={styles.container}>
      <Svg width={240} height={420} viewBox="0 0 200 400">
        <Defs>
          <LinearGradient id="bodyGradient" x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#334155" stopOpacity="1" />
            <Stop offset="0.4" stopColor="#1E293B" stopOpacity="1" />
            <Stop offset="1" stopColor="#0F172A" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="highlight" x1="0" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.15" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id="innerGlow" cx="50%" cy="40%" rx="60%" ry="60%">
            <Stop offset="0%" stopColor="#475569" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#1E293B" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Shadow */}
        <Path d={bodyPath} fill="#000000" opacity={0.6} transform="translate(0, 10)" />
        
        {/* Base Body */}
        <Path d={bodyPath} fill="url(#bodyGradient)" stroke="#475569" strokeWidth="1.5" />
        <Path d={contourPath} fill="url(#innerGlow)" />
        <Path d={bodyPath} fill="url(#highlight)" />

        {/* Muscle Detailing */}
        <Path d={chestPath} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeOpacity="0.8" strokeLinecap="round" />
        <Path d={absPath} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round" />
        <Path d="M 100 100 L 100 180" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeOpacity="0.5" strokeLinecap="round" />
        <Path d="M 68 85 C 60 100, 58 115, 62 120" fill="none" stroke="#64748B" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
        <Path d="M 132 85 C 140 100, 142 115, 138 120" fill="none" stroke="#64748B" strokeWidth="1" strokeOpacity="0.6" strokeLinecap="round" />
        <Path d="M 90 200 C 85 240, 85 280, 88 320" fill="none" stroke="#64748B" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
        <Path d="M 110 200 C 115 240, 115 280, 112 320" fill="none" stroke="#64748B" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />

        {/* Tappable Regions overlay */}
        {BODY_REGIONS.map((region) => {
          const isActive = activeRegionIds.has(region.id);
          const markerColor = getMarkerColor ? getMarkerColor(region.label) : '#FF5A1F';
          
          return (
            <G 
              key={region.id} 
              onPress={() => onRegionTap && onRegionTap(region)}
            >
              <Circle
                cx={region.cx}
                cy={region.cy}
                r={region.r + 12}
                fill="transparent"
              />
              <Circle
                cx={region.cx} cy={region.cy} r={region.r}
                fill={isActive ? markerColor : 'transparent'}
                fillOpacity={isActive ? 0.25 : 0}
                stroke={isActive ? markerColor : '#94A3B8'}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeDasharray={isActive ? '' : '4 4'}
              />
              {isActive && (
                <Circle cx={region.cx} cy={region.cy} r={8} fill={markerColor} />
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  }
});
