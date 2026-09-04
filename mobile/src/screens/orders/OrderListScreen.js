import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { orderApi } from '../../services/orderApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toList } from '../../utils/data';

const STATUS_COLORS = {
  OPEN: COLORS.orderOpen,
  PREPARING: COLORS.orderPreparing,
  READY: COLORS.orderReady,
  SERVED: COLORS.orderServed,
  COMPLETED: COLORS.orderCompleted,
  CANCELLED: COLORS.orderCancelled,
};

const STATUS_OPTIONS = ['All', 'OPEN', 'PREPARING', 'READY', 'SERVED'];

// "Feb 9, 2026 · 8:45 PM" style formatting for the order timestamps.
function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });
  return `${date} · ${time}`;
}

function OrderCard({ order, onPress }) {
  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>#{order.order_number}</Text>
          {order.created_at && (
            <Text style={styles.orderDate}>
              {formatDateTime(order.created_at)}
            </Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>
            {order.status}
          </Text>
        </View>
      </View>

      <View style={styles.orderInfo}>
        <Text style={styles.orderType}>
          {order.order_type === 'DELIVERY' ? '🛵 Delivery' : '🍽️ Dine-in'}
        </Text>
        {order.table_number && <Text style={styles.orderTable}>Table {order.table_number}</Text>}
        {order.cabin_number && <Text style={styles.orderTable}>Cabin {order.cabin_number}</Text>}
        {order.delivery_customer_name && (
          <Text style={styles.orderCustomer}>📍 {order.delivery_customer_name}</Text>
        )}
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderTotal}>Rs. {order.total}</Text>
        <View style={[styles.paymentBadge, { backgroundColor: order.payment_status === 'PAID' ? COLORS.paid + '20' : COLORS.unpaid + '20' }]}>
          <Text style={[styles.paymentText, { color: order.payment_status === 'PAID' ? COLORS.paid : COLORS.unpaid }]}>
            {order.payment_status}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrderListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'yesterday'
  const [servedFilter, setServedFilter] = useState('all'); // 'all' | 'served' | 'not_served'
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'PAID' | 'UNPAID'

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const params = {};
      if (filter !== 'All') params.status = filter;
      if (dateFilter !== 'all') {
        const d = new Date();
        if (dateFilter === 'yesterday') d.setDate(d.getDate() - 1);
        params.date = d.toISOString().slice(0, 10);
      }
      if (servedFilter !== 'all') {
        params.served = servedFilter === 'served' ? 'true' : 'false';
      }
      if (paymentFilter !== 'all') params.payment_status = paymentFilter;
      const response = await orderApi.list(params);
      setOrders(toList(response));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, dateFilter, servedFilter, paymentFilter]);

  // Fetch orders on initial load
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Refresh orders when screen gains focus (e.g., after returning from payment)
  useFocusEffect(
    useCallback(() => {
      // Refresh the order list without showing loading spinner
      // This ensures the latest payment status is displayed
      fetchOrders(false);
    }, [fetchOrders])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchOrders} />;

  return (
    <View style={styles.container}>
      {/* Filter Pills */}
      <View style={styles.filterRow}>
        {STATUS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.filterPill, filter === opt && styles.filterPillActive]}
            onPress={() => setFilter(opt)}
          >
            <Text style={[styles.filterText, filter === opt && styles.filterTextActive]}>
              {opt === 'All' ? 'All' : opt.charAt(0) + opt.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day / Served / Payment filters */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {[
            { id: 'all', label: 'Any day' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.filterPill, dateFilter === opt.id && styles.filterPillActive]}
              onPress={() => setDateFilter(opt.id)}
            >
              <Text style={[styles.filterText, dateFilter === opt.id && styles.filterTextActive]}>
                📅 {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          {[
            { id: 'all', label: 'Any status' },
            { id: 'served', label: 'Served' },
            { id: 'not_served', label: 'Not served' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.filterPill, servedFilter === opt.id && styles.filterPillActive]}
              onPress={() => setServedFilter(opt.id)}
            >
              <Text style={[styles.filterText, servedFilter === opt.id && styles.filterTextActive]}>
                🍽️ {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          {[
            { id: 'all', label: 'Any payment' },
            { id: 'PAID', label: 'Paid' },
            { id: 'UNPAID', label: 'Unpaid' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[styles.filterPill, paymentFilter === opt.id && styles.filterPillActive]}
              onPress={() => setPaymentFilter(opt.id)}
            >
              <Text style={[styles.filterText, paymentFilter === opt.id && styles.filterTextActive]}>
                💰 {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.push('OrderDetail', { orderId: item.id })}
          />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No orders found</Text>
          </View>
        }
      />

      {/* FAB — kept fully visible above the tab bar */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 20 + insets.bottom }]}
        onPress={() =>
          Alert.alert('New Order', 'What type of order is it?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: '🛵 Delivery',
              onPress: () => navigation.navigate('More', { screen: 'CreateDeliveryOrder' }),
            },
            {
              text: '🍽️ In Restaurant',
              onPress: () => navigation.navigate('Seating'),
            },
          ])
        }
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  filterRow: {
    flexDirection: 'row', padding: SPACING.sm, gap: SPACING.xs,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surfaceLight,
  },
  filterPillActive: { backgroundColor: COLORS.primary },
  filterText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  list: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: 80 },
  orderCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOW.card,
  },
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderNumber: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  orderDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderInfo: { gap: 4, marginBottom: SPACING.sm },
  orderType: { fontSize: 14, color: COLORS.textSecondary },
  orderTable: { fontSize: 14, color: COLORS.textSecondary },
  orderCustomer: { fontSize: 14, color: COLORS.textSecondary },
  orderFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm,
  },
  orderTotal: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  paymentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  paymentText: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 16, marginTop: 12 },
  fab: {
    position: 'absolute', right: 20,
    width: 60, height: 60, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary, justifyContent: 'center',
    alignItems: 'center', ...SHADOW.float,
  },
});
