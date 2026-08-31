import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../constants/colors';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  text: {
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
