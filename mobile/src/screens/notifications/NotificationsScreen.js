import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { notificationApi } from '../../services/notificationApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

function NotificationCard({ item, onDismiss }) {
  const timeStr = item.ready_at || '';
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Ionicons name="checkmark-circle" size={36} color={COLORS.success || '#34c759'} />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>🍽️ Order Ready</Text>
        <Text style={styles.cardMessage}>{item.message}</Text>
        <View style={styles.cardMeta}>
          {item.table_number && (
            <Text style={styles.metaText}>Table {item.table_number}</Text>
          )}
          {item.cabin_number && (
            <Text style={styles.metaText}>Cabin {item.cabin_number}</Text>
          )}
          {timeStr ? <Text style={styles.metaText}>⏰ {timeStr}</Text> : null}
        </View>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => onDismiss(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons name="close-circle" size={28} color={COLORS.textMuted || '#aaa'} />
      </TouchableOpacity>
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await notificationApi.list();
      const data = response?.data;
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleDismiss = async (id) => {
    try {
      await notificationApi.dismiss(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleDismissAll = () => {
    if (notifications.length === 0) return;
    Alert.alert(
      'Dismiss All',
      `Dismiss ${notifications.length} notification(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dismiss All',
          style: 'destructive',
          onPress: async () => {
            try {
              await notificationApi.dismissAll();
              setNotifications([]);
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchNotifications} />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleDismissAll} style={styles.dismissAllBtn}>
            <Ionicons name="checkmark-done" size={18} color={COLORS.primary || '#ff5722'} />
            <Text style={styles.dismissAllText}>Dismiss All</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NotificationCard item={item} onDismiss={handleDismiss} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 40 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color={COLORS.textMuted || '#ccc'} />
            <Text style={styles.emptyTitle}>All caught up!</Text>
            <Text style={styles.emptyText}>No pending notifications</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || '#f4f6fb' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface || '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#e5e5e5',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary || '#1a1a1a' },
  dismissAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dismissAllText: { fontSize: 14, fontWeight: '600', color: COLORS.primary || '#ff5722' },
  list: { padding: SPACING.md, gap: SPACING.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card || '#fff',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border || '#e5e5e5',
    ...SHADOW.card,
  },
  cardIcon: { marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary || '#1a1a1a' },
  cardMessage: { fontSize: 13, color: COLORS.textSecondary || '#666', marginTop: 4 },
  cardMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  metaText: { fontSize: 12, color: COLORS.textMuted || '#999' },
  dismissBtn: { marginLeft: 8, padding: 4 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary || '#1a1a1a', marginTop: 16 },
  emptyText: { fontSize: 14, color: COLORS.textMuted || '#999', marginTop: 8 },
});
