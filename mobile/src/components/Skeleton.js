import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

/**
 * Animated skeleton placeholder that pulses while data loads.
 *
 * Usage:
 *   <Skeleton width={200} height={16} />
 *   <SkeletonCard count={5} />
 */

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: COLORS.surface || '#1E1E2E',
          opacity,
        },
        style,
      ]}
    />
  );
}

/** A skeleton card that mimics a list item (image + 2 lines). */
export function SkeletonCard({ style }) {
  return (
    <View style={[styles.card, style]}>
      <Skeleton width={60} height={60} borderRadius={8} />
      <View style={styles.cardBody}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/** Renders N skeleton cards while loading. */
export function SkeletonList({ count = 5, style }) {
  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    backgroundColor: COLORS.surface || '#1E1E2E',
    borderRadius: 10,
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
});
