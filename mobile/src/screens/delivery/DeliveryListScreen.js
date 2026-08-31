import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { deliveryApi } from '../../services/deliveryApi';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toList } from '../../utils/data';

const DELIVERY_STATUS_COLORS = {
  PENDING: COLORS.kitchenPending,
  ASSIGNED: COLORS.warning,
  OUT_FOR_DELIVERY: COLORS.info,
  DELIVERED: COLORS.success,
  CANCELLED: COLORS.danger,
};

function DeliveryCard({ delivery, onStatusChange }) {
  const statusColor = DELIVERY_STATUS_COLORS[delivery.status] || COLORS.textMuted;
  return (
    <View style={styles.deliveryCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderNumber}>#{delivery.order_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{delivery.status}</Text>
        </View>
      </View>
      <Text style={styles.customerName}>📍 {delivery.customer_name}</Text>
      <Text style={styles.customerPhone}>📞 {delivery.customer_phone}</Text>
      <Text style={styles.address} numberOfLines={2}>{delivery.address}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.fee}>Fee: Rs. {delivery.delivery_fee}</Text>
        {delivery.status === 'OUT_FOR_DELIVERY' && (
          <TouchableOpacity style={styles.deliveredButton} onPress={() => onStatusChange(delivery.id, 'DELIVERED')}>
            <Text style={styles.deliveredText}>✓ Delivered</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function DeliveryListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const { isManager } = useAuth();

  const fetchDeliveries = useCallback(async () => {
    try {
      const response = await deliveryApi.list();
      setDeliveries(toList(response));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  const onRefresh = () => { setRefreshing(true); fetchDeliveries(); };

  const handleStatusChange = async (id, status) => {
    try {
      await deliveryApi.updateStatus(id, status);
      fetchDeliveries();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchDeliveries} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={deliveries}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <DeliveryCard delivery={item} onStatusChange={handleStatusChange} />}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No deliveries</Text>
          </View>
        }
      />
      {isManager && (
        <TouchableOpacity
          style={[styles.fab, { bottom: 20 + insets.bottom }]}
          onPress={() => navigation.navigate('CreateDeliveryOrder')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  deliveryCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderNumber: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600' },
  customerName: { fontSize: 14, color: COLORS.textPrimary, marginBottom: 2 },
  customerPhone: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  address: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  fee: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  deliveredButton: { backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.sm },
  deliveredText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 16, marginTop: 12 },
  fab: {
    position: 'absolute', right: 20, width: 60, height: 60,
    borderRadius: RADIUS.pill, backgroundColor: COLORS.primary, justifyContent: 'center',
    alignItems: 'center', ...SHADOW.float,
  },
});
