import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { orderApi } from '../../services/orderApi';
import { notificationApi } from '../../services/notificationApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

export default function WaiterDashboardScreen({ navigation }) {
  const { user, restaurant } = useAuth();
  const [activeOrders, setActiveOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [ordersResponse, notifResponse] = await Promise.all([
        orderApi.getActiveOrders().catch(() => null),
        notificationApi.getUnread().catch(() => null),
      ]);
      if (ordersResponse?.data) setActiveOrders(ordersResponse.data.results || ordersResponse.data || []);
      if (notifResponse?.data) setNotifications(notifResponse.data.results || notifResponse.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchData} />;

  const pendingOrders = activeOrders.filter(o => o.status === 'OPEN').length;
  const preparingOrders = activeOrders.filter(o => o.status === 'PREPARING').length;
  const readyOrders = activeOrders.filter(o => o.status === 'READY').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Hello, {user?.first_name || user?.username}</Text>
            {restaurant && (
              <View style={styles.restaurantBadge}>
                <Ionicons name="business" size={14} color={COLORS.primary} />
                <Text style={styles.restaurantName}>{restaurant.name}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
            {notifications.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{notifications.length}</Text></View>}
          </TouchableOpacity>
        </View>

        {readyOrders > 0 && (
          <TouchableOpacity style={styles.readyBanner} onPress={() => navigation.navigate('Orders', { screen: 'OrderList' })}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
            <View style={styles.readyBannerText}>
              <Text style={styles.readyBannerTitle}>{readyOrders} Order{readyOrders > 1 ? 's' : ''} Ready!</Text>
              <Text style={styles.readyBannerSubtitle}>Tap to view and serve</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.success} />
          </TouchableOpacity>
        )}

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { borderTopColor: COLORS.warning }]}>
            <Text style={styles.statValue}>{pendingOrders}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: COLORS.kitchenPreparing }]}>
            <Text style={styles.statValue}>{preparingOrders}</Text>
            <Text style={styles.statLabel}>Preparing</Text>
          </View>
          <View style={[styles.statBox, { borderTopColor: COLORS.success }]}>
            <Text style={styles.statValue}>{readyOrders}</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
        </View>

        <View style={styles.section}><Text style={styles.sectionTitle}>Quick Actions</Text></View>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Orders', { screen: 'Seating' })}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.primary + '1a' }]}>
            <Ionicons name="add-circle" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>New Dine-In Order</Text>
            <Text style={styles.actionSubtitle}>Select table and take order</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('More', { screen: 'CreateDeliveryOrder' })}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.info + '1a' }]}>
            <Ionicons name="bicycle" size={28} color={COLORS.info} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>New Delivery Order</Text>
            <Text style={styles.actionSubtitle}>Create delivery order</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Orders', { screen: 'OrderList' })}>
          <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '1a' }]}>
            <Ionicons name="receipt" size={28} color={COLORS.success} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>View All Orders</Text>
            <Text style={styles.actionSubtitle}>{activeOrders.length} active orders</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}><Text style={styles.sectionTitle}>Recent Orders</Text></View>
        {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No active orders</Text>
          </View>
        ) : (
          activeOrders.slice(0, 5).map((order) => (
            <TouchableOpacity key={order.id} style={styles.orderRow} onPress={() => navigation.navigate('Orders', { screen: 'OrderDetail', params: { id: order.id } })}>
              <View style={styles.orderInfo}>
                <Text style={styles.orderNumber}>#{order.order_number}</Text>
                <Text style={styles.orderDetails}>
                  {order.table_number ? `Table ${order.table_number}` : order.order_type === 'DELIVERY' ? 'Delivery' : 'No table'}
                  {order.item_count ? ` - ${order.item_count} items` : ''}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: order.status === 'READY' ? COLORS.success + '20' : order.status === 'PREPARING' ? COLORS.kitchenPreparing + '20' : COLORS.warning + '20' }]}>
                <Text style={[styles.statusText, { color: order.status === 'READY' ? COLORS.success : order.status === 'PREPARING' ? COLORS.kitchenPreparing : COLORS.warning }]}>{order.status}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  welcomeText: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  restaurantBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: COLORS.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, alignSelf: 'flex-start' },
  restaurantName: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  notificationBtn: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: COLORS.error, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  readyBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.success + '12', borderColor: COLORS.success + '40', borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  readyBannerText: { flex: 1 },
  readyBannerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  readyBannerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderTopWidth: 3, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  section: { marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm },
  actionIcon: { width: 50, height: 50, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  actionSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: COLORS.textMuted, marginTop: 8 },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.xs },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  orderDetails: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  statusText: { fontSize: 11, fontWeight: '700' },
});
