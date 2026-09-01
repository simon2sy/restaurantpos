import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { orderApi } from '../../services/orderApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

const STATUS_COLORS = {
  AVAILABLE: COLORS.tableAvailable,
  OCCUPIED: COLORS.tableOccupied,
  RESERVED: COLORS.tableReserved,
};

function SeatCard({ seat, type, onPress, onPay }) {
  const isAvailable = seat.status === 'AVAILABLE';
  const statusColor = STATUS_COLORS[seat.status] || COLORS.textMuted;

  return (
    <View style={[styles.seatCard, { borderTopColor: statusColor }]}>
      <View style={styles.seatHeader}>
        <Text style={styles.seatNumber}>{type} {seat.number}</Text>
        <View style={[styles.seatStatus, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.seatStatusText, { color: statusColor }]}>{seat.status}</Text>
        </View>
      </View>

      {isAvailable ? (
        <TouchableOpacity style={styles.createButton} onPress={() => onPress(seat)}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create Order</Text>
        </TouchableOpacity>
      ) : seat.open_order_id ? (
        <View>
          <Text style={styles.orderInfo}>Order #{seat.open_order_number}</Text>
          <View style={styles.seatActions}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => onPay('view', seat.open_order_id)}
            >
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => onPay('payment', seat.open_order_id)}
            >
              <Text style={styles.payButtonText}>💵 Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default function SeatingScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchSeating = useCallback(async () => {
    try {
      const response = await orderApi.getSeating();
      setData(response?.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSeating();
  }, [fetchSeating]);

  // Refresh seat statuses every time this screen gains focus
  // (e.g. after creating an order or coming back from payment).
  useFocusEffect(
    useCallback(() => {
      fetchSeating();
    }, [fetchSeating])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchSeating();
  };

  const handleCreateOrder = (seat) => {
    navigation.navigate('CreateOrder', { type: seat.number > 100 ? 'cabin' : 'table', seatId: seat.id });
  };

  const handleAction = (action, orderId) => {
    if (action === 'view') {
      navigation.push('OrderDetail', { orderId });
    } else if (action === 'payment') {
      navigation.push('OrderDetail', { orderId });
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchSeating} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data?.tables_available || 0}</Text>
          <Text style={styles.statLabel}>Tables Free</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data?.tables?.length || 0}</Text>
          <Text style={styles.statLabel}>Tables</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{data?.cabins?.length || 0}</Text>
          <Text style={styles.statLabel}>Cabins</Text>
        </View>
      </View>

      {/* Tables */}
      <Text style={styles.sectionTitle}>Tables</Text>
      <View style={styles.seatsGrid}>
        {data?.tables?.map((table) => (
          <SeatCard
            key={table.id}
            seat={table}
            type="Table"
            onPress={handleCreateOrder}
            onPay={handleAction}
          />
        ))}
      </View>

      {/* Cabins */}
      <Text style={styles.sectionTitle}>Cabins</Text>
      <View style={styles.seatsGrid}>
        {data?.cabins?.map((cabin) => (
          <SeatCard
            key={cabin.id}
            seat={cabin}
            type="Cabin"
            onPress={handleCreateOrder}
            onPay={handleAction}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statItem: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '700', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.sm, marginTop: SPACING.md,
  },
  seatsGrid: { gap: SPACING.sm },
  seatCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderTopWidth: 3,
  },
  seatHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  seatNumber: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  seatStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  seatStatusText: { fontSize: 12, fontWeight: '600' },
  createButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    padding: 12, gap: 8,
  },
  createButtonText: { color: '#fff', fontWeight: '600' },
  orderInfo: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  seatActions: { flexDirection: 'row', gap: 8 },
  viewButton: {
    flex: 1, padding: 10, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  viewButtonText: { color: COLORS.textPrimary, fontWeight: '500', fontSize: 13 },
  payButton: {
    flex: 1, padding: 10, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.success, alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
