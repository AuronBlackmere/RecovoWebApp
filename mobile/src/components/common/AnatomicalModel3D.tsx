import { useTranslation } from '@/hooks/useTranslation';
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Platform
} from 'react-native';
import Svg, { Circle, Line, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, SPACING, RADIUS } from '@/utils/theme';

export interface PainMarker {
  id?: string;
  uid: string;
  bodyPart: string;
  side: 'left' | 'right' | 'center';
  x: number;
  y: number;
  painType: 'sharp' | 'dull' | 'burning' | 'aching';
  intensity: number;
  notes?: string;
  timestamp: number;
  resolved: boolean;
}

export const VERTICES = [
  { x: 0, y: -90, z: 0 },    // 0: Head Center
  { x: 0, y: -70, z: 0 },    // 1: Neck
  { x: -30, y: -60, z: 0 },  // 2: L Shoulder
  { x: 30, y: -60, z: 0 },   // 3: R Shoulder
  { x: -18, y: -20, z: 12 }, // 4: L Chest Front
  { x: 18, y: -20, z: 12 },  // 5: R Chest Front
  { x: -18, y: -20, z: -12 },// 6: L Back
  { x: 18, y: -20, z: -12 }, // 7: R Back
  { x: -18, y: 15, z: 12 },  // 8: L Waist Front
  { x: 18, y: 15, z: 12 },   // 9: R Waist Front
  { x: -18, y: 15, z: -12 }, // 10: L Lumbar Back
  { x: 18, y: 15, z: -12 },  // 11: R Lumbar Back
  { x: -22, y: 35, z: 0 },   // 12: L Hip
  { x: 22, y: 35, z: 0 },    // 13: R Hip
  { x: -40, y: -15, z: 5 },  // 14: L Elbow
  { x: 40, y: -15, z: 5 },   // 15: R Elbow
  { x: -45, y: 25, z: 8 },   // 16: L Wrist
  { x: 45, y: 25, z: 8 },    // 17: R Wrist
  { x: -20, y: 80, z: 0 },   // 18: L Knee
  { x: 20, y: 80, z: 0 },    // 19: R Knee
  { x: -20, y: 125, z: 0 },  // 20: L Ankle
  { x: 20, y: 125, z: 0 },   // 21: R Ankle
  { x: -20, y: 135, z: 15 }, // 22: L Toe
  { x: 20, y: 135, z: 15 },  // 23: R Toe
];

export const EDGES = [
  { u: 0, v: 1 },   // Neck to Head
  { u: 1, v: 2 },   // Neck to L Shoulder
  { u: 1, v: 3 },   // Neck to R Shoulder
  // Torso Front
  { u: 2, v: 4 }, { u: 4, v: 8 }, { u: 8, v: 12 },
  { u: 3, v: 5 }, { u: 5, v: 9 }, { u: 9, v: 13 },
  { u: 4, v: 5 }, { u: 8, v: 9 }, { u: 12, v: 13 },
  // Torso Back
  { u: 2, v: 6 }, { u: 6, v: 10 }, { u: 10, v: 12 },
  { u: 3, v: 7 }, { u: 7, v: 11 }, { u: 11, v: 13 },
  { u: 6, v: 7 }, { u: 10, v: 11 },
  // Side connectors
  { u: 4, v: 6 }, { u: 5, v: 7 },
  { u: 8, v: 10 }, { u: 9, v: 11 },
  // Arms
  { u: 2, v: 14 }, { u: 14, v: 16 }, // L Arm
  { u: 3, v: 15 }, { u: 15, v: 17 }, // R Arm
  // Legs
  { u: 12, v: 18 }, { u: 18, v: 20 }, { u: 20, v: 22 }, // L Leg
  { u: 13, v: 19 }, { u: 19, v: 21 }, { u: 21, v: 23 }, // R Leg
];

export const BODY_REGIONS_3D = [
  { id: 'head', label: 'Head', x: 0, y: -90, z: 10, key: 'Head' },
  { id: 'neck', label: 'Neck', x: 0, y: -70, z: 8, key: 'Neck' },
  { id: 'left-shoulder', label: 'Left Shoulder', x: -30, y: -60, z: 8, key: 'Shoulder' },
  { id: 'right-shoulder', label: 'Right Shoulder', x: 30, y: -60, z: 8, key: 'Shoulder' },
  { id: 'chest', label: 'Chest', x: 0, y: -30, z: 15, key: 'Chest' },
  { id: 'upper-back', label: 'Upper Back', x: 0, y: -30, z: -15, key: 'Upper Back' },
  { id: 'core', label: 'Core / Abs', x: 0, y: 0, z: 15, key: 'Core' },
  { id: 'lower-back', label: 'Lower Back', x: 0, y: 0, z: -15, key: 'Lower Back' },
  { id: 'left-hip', label: 'Left Hip', x: -20, y: 35, z: 8, key: 'Hip' },
  { id: 'right-hip', label: 'Right Hip', x: 20, y: 35, z: 8, key: 'Hip' },
  { id: 'left-quad', label: 'Left Quad', x: -20, y: 55, z: 12, key: 'Quad' },
  { id: 'right-quad', label: 'Right Quad', x: 20, y: 55, z: 12, key: 'Quad' },
  { id: 'left-hamstring', label: 'Left Hamstring', x: -20, y: 55, z: -12, key: 'Hamstring' },
  { id: 'right-hamstring', label: 'Right Hamstring', x: 20, y: 55, z: -12, key: 'Hamstring' },
  { id: 'left-knee', label: 'Left Knee', x: -20, y: 80, z: 10, key: 'Knee' },
  { id: 'right-knee', label: 'Right Knee', x: 20, y: 80, z: 10, key: 'Knee' },
  { id: 'left-calf', label: 'Left Calf', x: -20, y: 105, z: -10, key: 'Calf' },
  { id: 'right-calf', label: 'Right Calf', x: 20, y: 105, z: -10, key: 'Calf' },
  { id: 'left-shin', label: 'Left Shin', x: -20, y: 105, z: 10, key: 'Lower Leg' },
  { id: 'right-shin', label: 'Right Shin', x: 20, y: 105, z: 10, key: 'Lower Leg' },
  { id: 'left-foot', label: 'Left Foot', x: -20, y: 135, z: 12, key: 'Foot' },
  { id: 'right-foot', label: 'Right Foot', x: 20, y: 135, z: 12, key: 'Foot' },
  { id: 'left-ankle', label: 'Left Ankle', x: -20, y: 125, z: 5, key: 'Ankle' },
  { id: 'right-ankle', label: 'Right Ankle', x: 20, y: 125, z: 5, key: 'Ankle' },
  { id: 'left-elbow', label: 'Left Elbow', x: -40, y: -15, z: 5, key: 'Elbow' },
  { id: 'right-elbow', label: 'Right Elbow', x: 40, y: -15, z: 5, key: 'Elbow' },
];

export const PAIN_TYPES = ['sharp', 'dull', 'burning', 'aching'] as const;
export const PAIN_TYPE_COLORS = {
  sharp: COLORS.danger,   // Red
  dull: COLORS.warning,   // Yellow
  burning: '#F97316',      // Orange
  aching: COLORS.purple,   // Purple
};

interface AnatomicalModel3DProps {
  activeRegionIds: Set<string>;
  activeInjuries: PainMarker[];
  selectedRegion: typeof BODY_REGIONS_3D[0] | null;
  onRegionSelect: (region: typeof BODY_REGIONS_3D[0] | null) => void;
  scale?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function AnatomicalModel3D({
  activeRegionIds,
  activeInjuries,
  selectedRegion,
  onRegionSelect,
  scale = 1.10,
  onDragStart,
  onDragEnd,
}: AnatomicalModel3DProps) {
  const [angleY, setAngleY] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const { t } = useTranslation();



  // Layout measurements
  const svgRef = useRef<any>(null);
  const containerPageX = useRef(0);
  const containerPageY = useRef(0);

  // Local coordinate tracking for scroll-independent clicks
  const touchStartXLocal = useRef(0);
  const touchStartYLocal = useRef(0);

  // Gesture references
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const lastX = useRef(0);
  const hasMoved = useRef(false);

  // Animation frame reference
  const animFrameId = useRef<number | null>(null);

  // 60fps auto rotation
  useEffect(() => {
    if (!autoRotate) {
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current);
        animFrameId.current = null;
      }
      return;
    }

    const tick = () => {
      setAngleY((prev) => (prev + 0.015) % (2 * Math.PI));
      animFrameId.current = requestAnimationFrame(tick);
    };

    animFrameId.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [autoRotate]);

  // Rotate & project vertices
  const project = (x: number, y: number, z: number) => {
    const cosVal = Math.cos(angleY);
    const sinVal = Math.sin(angleY);
    const xRot = x * cosVal - z * sinVal;
    const zRot = x * sinVal + z * cosVal;
    return {
      x: 95 + xRot * scale,
      y: 146 + y * scale,
      z: zRot * scale,
    };
  };

  const projectedVertices = VERTICES.map((v) => project(v.x, v.y, v.z));
  
  const projectedRegions = BODY_REGIONS_3D.map((r) => {
    const proj = project(r.x, r.y, r.z);
    return { ...r, cx: proj.x, cy: proj.y, cz: proj.z };
  });

  // Sort regions by depth (Z order) so front-facing nodes render last (on top)
  const sortedRegions = [...projectedRegions].sort((a, b) => a.cz - b.cz);

  // Measure Svg container bounds on start to anchor page coordinate translation
  const updateLayoutMeasurements = () => {
    svgRef.current?.measureInWindow((x: number, y: number) => {
      containerPageX.current = x;
      containerPageY.current = y;
    });
  };

  // Gestures
  const handleStart = (e: any) => {
    setAutoRotate(false);
    onDragStart?.();
    updateLayoutMeasurements();

    const pageX = e.nativeEvent.pageX;
    const pageY = e.nativeEvent.pageY;
    let locationX = e.nativeEvent.locationX;
    let locationY = e.nativeEvent.locationY;

    if (Platform.OS === 'web') {
      const rect = e.currentTarget?.getBoundingClientRect?.() || e.target?.getBoundingClientRect?.();
      if (rect) {
        const clientX = e.nativeEvent.clientX ?? (e.nativeEvent.touches?.[0]?.clientX);
        const clientY = e.nativeEvent.clientY ?? (e.nativeEvent.touches?.[0]?.clientY);
        if (clientX !== undefined && clientY !== undefined) {
          locationX = clientX - rect.left;
          locationY = clientY - rect.top;
        }
      }
    }
    
    touchStartX.current = pageX;
    touchStartY.current = pageY;
    touchStartXLocal.current = locationX;
    touchStartYLocal.current = locationY;
    lastX.current = pageX;
    touchStartTime.current = Date.now();
    hasMoved.current = false;
  };

  const handleMove = (e: any) => {
    const pageX = e.nativeEvent.pageX;
    const pageY = e.nativeEvent.pageY;
    const deltaX = pageX - lastX.current;
    lastX.current = pageX;

    const dist = Math.sqrt(
      (pageX - touchStartX.current) ** 2 + 
      (pageY - touchStartY.current) ** 2
    );
    if (dist > 5) {
      hasMoved.current = true;
    }

    // Increased yaw sensitivity to 0.024 for quick, responsive rotation
    setAngleY((prev) => prev + deltaX * 0.024);
  };

  const handleRegionTap = (region: typeof BODY_REGIONS_3D[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedRegion?.id === region.id) {
      onRegionSelect(null);
    } else {
      onRegionSelect(region);
    }
  };

  const handleRelease = (e: any) => {
    onDragEnd?.();
    const elapsed = Date.now() - touchStartTime.current;
    const pageX = e.nativeEvent.pageX;
    const pageY = e.nativeEvent.pageY;
    const dx = pageX - touchStartX.current;
    const dy = pageY - touchStartY.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // If tap conditions are met: short duration and small distance
    if (elapsed < 350 && dist < 20) {
      // Find the closest region that is facing the camera
      let closestRegion: any = null;
      let minDistance = Infinity;

      projectedRegions.forEach((region) => {
        // ONLY CONSIDER FACING REGIONS! Back-facing regions cannot intercept front taps.
        if (region.cz <= 0) return;

        // Calculate the distance in 2D space relative to the starting touch coordinate
        const d = Math.sqrt(
          (touchStartXLocal.current - region.cx) ** 2 +
          (touchStartYLocal.current - region.cy) ** 2
        );
        if (d < minDistance) {
          minDistance = d;
          closestRegion = region;
        }
      });

      // Accessible 34px threshold for comfortable hit detection
      if (closestRegion && minDistance < 34) {
        handleRegionTap(closestRegion);
      }
    }
  };

  const normalizedAngle = ((angleY % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const isFrontView = normalizedAngle < Math.PI / 2 || normalizedAngle > (3 * Math.PI) / 2;

  return (
    <View style={styles.canvasCard}>
      <Text style={styles.canvasLabel}>{t.anatomicalModelTitle}</Text>
      
      <View style={styles.hudBadge}>
        <Text style={styles.hudText}>{isFrontView ? t.frontView : t.backView}</Text>
      </View>
      
      <View
        ref={svgRef}
        style={{ width: 190, height: 300, position: 'relative' }}
        onLayout={updateLayoutMeasurements}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleStart}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminationRequest={() => false}
      >
        <Svg
          width={190}
          height={300}
          viewBox="0 0 190 300"
          style={styles.svgContainer}
          pointerEvents="none"
        >
          {/* Visual elements grouped with pointerEvents="none" so targets remain 1:1 with SVG coordinate container */}
          <G pointerEvents="none">
          {/* 1. Draw projected skeletal Edges */}
          {EDGES.map((edge, idx) => {
            const u = projectedVertices[edge.u];
            const v = projectedVertices[edge.v];
            if (!u || !v) return null;
            const avgZ = (u.z + v.z) / 2;
            const isFacing = avgZ > 0;
            
            // Premium glow and styling
            const opacity = isFacing ? 0.9 : 0.35;
            const strokeColor = isFacing ? COLORS.cyan : COLORS.borderAccent;
            const strokeW = isFacing ? 2.2 : 1.0;

            return (
              <G key={`edge-${idx}`}>
                {/* Neon Glow back-layer line */}
                {isFacing && (
                  <Line
                    x1={u.x}
                    y1={u.y}
                    x2={v.x}
                    y2={v.y}
                    stroke={COLORS.cyan}
                    strokeWidth={5.5}
                    opacity={0.16}
                  />
                )}
                <Line
                  x1={u.x}
                  y1={u.y}
                  x2={v.x}
                  y2={v.y}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  opacity={opacity}
                />
              </G>
            );
          })}

          {/* 2. Glowing Vertices/Joints */}
          {projectedVertices.map((v, idx) => {
            if (!v) return null;
            const isFacing = v.z > 0;
            return (
              <Circle
                key={`v-${idx}`}
                cx={v.x}
                cy={v.y}
                r={isFacing ? 2.8 : 1.8}
                fill={isFacing ? COLORS.cyan : COLORS.borderAccent}
                opacity={isFacing ? 0.95 : 0.4}
              />
            );
          })}

          {/* 3. Head circle */}
          {projectedVertices[0] && (
            <G>
              {projectedVertices[0].z > 0 && (
                <Circle
                  cx={projectedVertices[0].x}
                  cy={projectedVertices[0].y}
                  r={18}
                  fill="transparent"
                  stroke={COLORS.cyan}
                  strokeWidth={5}
                  opacity={0.12}
                />
              )}
              <Circle
                cx={projectedVertices[0].x}
                cy={projectedVertices[0].y}
                r={18}
                fill="transparent"
                stroke={projectedVertices[0].z > 0 ? COLORS.cyan : COLORS.borderAccent}
                strokeWidth={2.2}
                opacity={projectedVertices[0].z > 0 ? 0.9 : 0.35}
              />
            </G>
          )}

          {/* 4. Region Zones sorted depth-wise */}
          {sortedRegions.map((region) => {
            const isFacing = region.cz > 0;
            if (!isFacing) return null; // HIDE BACK-FACING INTERACTIVE REGION DOTS COMPLETELY!
            
            const hasInjury = activeRegionIds.has(region.id);
            const isSelected = selectedRegion?.id === region.id;
            const activeMark = activeInjuries.find((i) => i.bodyPart === region.key);
            
            // Map colors based on status and view depth
            let dotColor = '#E4E4E7'; // Facing & normal
            if (activeMark) {
              dotColor = PAIN_TYPE_COLORS[activeMark.painType];
            } else if (isSelected) {
              dotColor = COLORS.cyan;
            }

            const r = isSelected ? 10 : 8.0;
            const opacity = 0.95;

            return (
              <G key={region.id}>
                {/* Glow backdrop ring */}
                <Circle
                  cx={region.cx}
                  cy={region.cy}
                  r={isSelected || hasInjury ? 14 : 11}
                  fill="transparent"
                  stroke={dotColor}
                  strokeWidth={isSelected || hasInjury ? 6 : 3.5}
                  opacity={isSelected || hasInjury ? 0.22 : 0.08}
                />
                {/* Outer visual ring */}
                <Circle
                  cx={region.cx}
                  cy={region.cy}
                  r={r}
                  fill={hasInjury ? dotColor + '30' : isSelected ? COLORS.cyan + '20' : 'transparent'}
                  stroke={dotColor}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  opacity={opacity}
                />
                {/* Inner solid center dot */}
                <Circle
                  cx={region.cx}
                  cy={region.cy}
                  r={3.5}
                  fill={dotColor}
                  opacity={isSelected || hasInjury ? 1.0 : 0.8}
                />
              </G>
            );
          })}
        </G>
      </Svg>
    </View>

      {/* Model controllers */}
      <View style={styles.controlsRow}>
        <Pressable
          style={[styles.controlBtn, autoRotate && styles.controlBtnActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAutoRotate(!autoRotate);
          }}
        >
          <Text style={[styles.controlBtnText, autoRotate && { color: COLORS.textInverse }]}>{t.autoRotate}</Text>
        </Pressable>
        <Pressable
          style={styles.controlBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAngleY(0);
            setAutoRotate(false);
          }}
        >
          <Text style={styles.controlBtnText}>{t.reset}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvasCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    alignItems: 'center',
  },
  canvasLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: 4,
    width: 170,
    textAlign: 'center',
  },
  hudBadge: {
    backgroundColor: 'rgba(24, 24, 27, 0.65)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(39, 39, 42, 0.8)',
    marginBottom: 8,
  },
  hudText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.cyan,
    letterSpacing: 0.5,
  },
  svgContainer: {
    backgroundColor: 'transparent',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  controlBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  controlBtnActive: {
    backgroundColor: COLORS.cyan,
    borderColor: COLORS.cyan,
  },
  controlBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
});
