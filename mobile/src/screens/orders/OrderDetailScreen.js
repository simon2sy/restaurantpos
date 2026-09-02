import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { orderApi } from '../../services/orderApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

const STATUS_COLORS = {
  OPEN: COLORS.orderOpen,
  PREPARING: COLORS.orderPreparing,
  READY: COLORS.orderReady,
  SERVED: COLORS.orderServed,
  COMPLETED: COLORS.orderCompleted,
  CANCELLED: COLORS.orderCancelled,
};

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

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const { isCashier } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchOrder = useCallback(async () => {
    try {
      const response = await orderApi.getDetail(orderId);
      setOrder(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setOrder(null);
    fetchOrder();
  }, [fetchOrder]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrder();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchOrder} />;
  if (!order) return <ErrorView message="Order not found." />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>Order #{order.order_number}</Text>
          {order.created_at && (
            <Text style={styles.orderDate}>
              📅 {formatDateTime(order.created_at)}
            </Text>
          )}
          {order.paid_at && (
            <Text style={styles.orderDate}>
              💳 Paid {formatDateTime(order.paid_at)}
            </Text>
          )}
          <Text style={styles.orderType}>{order.order_type === 'DELIVERY' ? '🛵 Delivery' : '🍽️ Dine-in'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[order.status] }]}>{order.status}</Text>
        </View>
      </View>

      {/* Location */}
      {(order.table_number || order.cabin_number) && (
        <View style={styles.infoCard}>
          <Ionicons name="location" size={18} color={COLORS.primary} />
          <Text style={styles.infoText}>
            {order.table_number ? `Table ${order.table_number}` : `Cabin ${order.cabin_number}`}
          </Text>
        </View>
      )}

      {/* Delivery Info */}
      {order.delivery && (
        <View style={styles.infoCard}>
          <Ionicons name="bicycle" size={18} color={COLORS.info} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoText}>{order.delivery.customer_name}</Text>
            <Text style={styles.infoSubtext}>{order.delivery.customer_phone}</Text>
            <Text style={styles.infoSubtext}>{order.delivery.address}</Text>
          </View>
        </View>
      )}

      {/* Batches */}
      {order.batches?.map((batch) => (
        <View key={batch.id} style={styles.batchCard}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchTitle}>Batch #{batch.batch_number}</Text>
            <View style={[styles.batchStatus, { backgroundColor: STATUS_COLORS[batch.status] + '20' }]}>
              <Text style={[styles.batchStatusText, { color: STATUS_COLORS[batch.status] }]}>{batch.status}</Text>
            </View>
          </View>
          {batch.items?.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{item.menu_item_name}</Text>
              <Text style={styles.itemQty}>× {item.quantity}</Text>
              {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
            </View>
          ))}
        </View>
      ))}

      {/* Totals */}
      <View style={styles.totalsCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>Rs. {order.subtotal}</Text>
        </View>
        {order.discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Discount</Text>
            <Text style={[styles.totalValue, { color: COLORS.success }]}>- Rs. {order.discount}</Text>
          </View>
        )}
        {order.delivery_fee > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery Fee</Text>
            <Text style={styles.totalValue}>Rs. {order.delivery_fee}</Text>
          </View>
        )}
        <View style={[styles.totalRow, styles.totalFinal]}>
          <Text style={styles.totalFinalLabel}>Total</Text>
          <Text style={styles.totalFinalValue}>Rs. {order.total}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Payment</Text>
          <View style={[styles.paymentBadge, { backgroundColor: order.payment_status === 'PAID' ? COLORS.paid + '20' : COLORS.unpaid + '20' }]}>
            <Text style={{ color: order.payment_status === 'PAID' ? COLORS.paid : COLORS.unpaid, fontWeight: '600' }}>
              {order.payment_status} {order.payment_method ? `(${order.payment_method})` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      {isCashier && order.payment_status !== 'PAID' && order.status !== 'CANCELLED' && (
        <View style={styles.actions}>
          {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
            <TouchableOpacity
              style={styles.addItemsButton}
              onPress={() => navigation.navigate('AddItems', { orderId: order.id })}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addItemsText}>Add Items</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => navigation.navigate('Payment', { orderId: order.id, total: order.total })}
          >
            <Ionicons name="card" size={20} color="#fff" />
            <Text style={styles.payText}>Pay Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  orderNumber: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  orderType: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  orderDate: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 13, fontWeight: '600' },
  infoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, gap: 12,
  },
  infoText: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  infoSubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  batchCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  batchHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  batchTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  batchStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  batchStatusText: { fontSize: 12, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  itemName: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  itemQty: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginLeft: 8 },
  itemNotes: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginLeft: 8 },
  totalsCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary },
  totalValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  totalFinal: {
    borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 10,
  },
  totalFinalLabel: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  totalFinalValue: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  paymentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  actions: { gap: SPACING.sm, marginTop: SPACING.sm },
  addItemsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.md,
    padding: 14, gap: 8,
  },
  addItemsText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 16 },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.success, borderRadius: RADIUS.md,
    padding: 14, gap: 8,
  },
  payText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
