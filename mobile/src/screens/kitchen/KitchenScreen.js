import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { kitchenApi } from '../../services/kitchenApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toList } from '../../utils/data';
import { WS_BASE_URL } from '../../constants/config';
import useRealtime from '../../hooks/useRealtime';

const STATUS_META = {
  PENDING: { label: 'Pending', color: COLORS.kitchenPending, icon: 'time' },
  PREPARING: { label: 'Preparing', color: COLORS.kitchenPreparing, icon: 'flame' },
  READY: { label: 'Ready', color: COLORS.kitchenReady, icon: 'checkmark-circle' },
  COMPLETED: { label: 'Completed', color: COLORS.textMuted, icon: 'checkmark-done' },
};

const FILTERS = ['ALL', 'PENDING', 'PREPARING', 'READY'];

function BatchCard({ batch, onStart, onReady }) {
  const status = STATUS_META[batch.status] || { label: batch.status, color: COLORS.textMuted };
  const isDelivery = batch.order_type === 'DELIVERY';

  return (
    <LinearGradient
      colors={[status.color, status.color + 'cc']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.batchCard}
    >
      <View style={styles.batchHeader}>
        <View style={styles.badgeRow}>
          <View style={styles.orderBadge}>
            <Ionicons name="restaurant" size={13} color="#fff" />
            <Text style={styles.orderNumber}>Order #{batch.order_number}</Text>
          </View>
          <Text style={styles.batchNumber}>Batch #{batch.batch_number}</Text>
        </View>
        <View style={styles.statusPill}>
          <Ionicons name={status.icon} size={13} color="#fff" />
          <Text style={styles.statusText}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.locationRow}>
        {isDelivery && (
          <View style={styles.locationPill}>
            <Ionicons name="bicycle" size={13} color="#fff" />
            <Text style={styles.locationPillText}>Delivery</Text>
          </View>
        )}
        {batch.table_number && (
          <View style={styles.locationPill}>
            <Ionicons name="restaurant-outline" size={13} color="#fff" />
            <Text style={styles.locationPillText}>Table {batch.table_number}</Text>
          </View>
        )}
        {batch.cabin_number && (
          <View style={styles.locationPill}>
            <Ionicons name="business" size={13} color="#fff" />
            <Text style={styles.locationPillText}>Cabin {batch.cabin_number}</Text>
          </View>
        )}
        {batch.delivery_customer_name && (
          <View style={styles.locationPill}>
            <Ionicons name="location" size={13} color="#fff" />
            <Text style={styles.locationPillText}>{batch.delivery_customer_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.itemsContainer}>
        {batch.items?.map((item, idx) => (
          <View key={idx} style={styles.itemRow}>
            <Text style={styles.itemQty}>x{item.quantity}</Text>
            <Text style={styles.itemName}>{item.menu_item_name}</Text>
            {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
          </View>
        ))}
      </View>

      {batch.status === 'PENDING' && (
        <TouchableOpacity style={styles.actionBtn} onPress={() => onStart(batch.id)}>
          <Ionicons name="play" size={16} color={COLORS.kitchenPreparing} />
          <Text style={styles.actionBtnText}>Start Cooking</Text>
        </TouchableOpacity>
      )}
      {batch.status === 'PREPARING' && (
        <TouchableOpacity style={styles.actionBtn} onPress={() => onReady(batch.id)}>
          <Ionicons name="checkmark" size={16} color={COLORS.kitchenReady} />
          <Text style={styles.actionBtnText}>Mark Ready</Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
}
export default function KitchenScreen() {
  const [batches, setBatches] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchBatches = useCallback(async () => {
    try {
      const response = await kitchenApi.getDashboard();
      setBatches(toList(response));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
    const interval = setInterval(fetchBatches, 30000);
    return () => clearInterval(interval);
  }, [fetchBatches]);

  // Live updates - when a waiter confirms an order or a batch status changes,
  // refetch immediately so the kitchen stays in real time.
  useRealtime(`${WS_BASE_URL}/kitchen/`, (msg) => {
    if (msg && (msg.type === 'new_order' || msg.type === 'batch_status')) {
      fetchBatches();
    }
  });

  const onRefresh = () => {
    setRefreshing(true);
    fetchBatches();
  };

  const handleStart = async (batchId) => {
    try {
      await kitchenApi.startBatch(batchId);
      fetchBatches();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleReady = async (batchId) => {
    try {
      await kitchenApi.markReady(batchId);
      fetchBatches();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchBatches} />;

  const counts = {
    ALL: batches.length,
    PENDING: batches.filter((b) => b.status === 'PENDING').length,
    PREPARING: batches.filter((b) => b.status === 'PREPARING').length,
    READY: batches.filter((b) => b.status === 'READY').length,
  };
  const active = counts.PENDING + counts.PREPARING;
  const visible =
    filter === 'ALL' ? batches : batches.filter((b) => b.status === filter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Hero header */}
      <LinearGradient
        colors={['#ff7a45', '#ff5722']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <View style={styles.heroTitleRow}>
            <Ionicons name="flame" size={24} color="#fff" />
            <Text style={styles.heroTitle}>Kitchen Display</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>
        <Text style={styles.heroSubtitle}>
          {active} being cooked - {counts.READY} ready to serve
        </Text>
        <View style={styles.heroCount}>
          <Text style={styles.heroCountNumber}>{batches.length}</Text>
          <Text style={styles.heroCountLabel}>orders in queue</Text>
        </View>
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const activeTab = filter === f;
          const color = f === 'ALL' ? COLORS.textSecondary : STATUS_META[f].color;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, activeTab && { backgroundColor: color, borderColor: color }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, activeTab && styles.filterTextActive]}>
                {f === 'ALL' ? 'All' : STATUS_META[f].label} ({counts[f]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <BatchCard batch={item} onStart={handleStart} onReady={handleReady} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle" size={72} color={COLORS.success} />
            <Text style={styles.emptyTitle}>Kitchen all caught up!</Text>
            <Text style={styles.emptyText}>
              No {filter === 'ALL' ? '' : STATUS_META[filter].label.toLowerCase() + ' '}orders right now
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6fb' },
  hero: {
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.lg,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#a7f3d0' },
  liveText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },
  heroCount: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 14 },
  heroCountNumber: { fontSize: 34, fontWeight: '800', color: '#fff' },
  heroCountLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  filterPill: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.pill,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  list: { padding: SPACING.md, paddingTop: 0, gap: SPACING.sm, paddingBottom: 24 },
  batchCard: { borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.float },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  orderNumber: { color: '#fff', fontWeight: '700', fontSize: 15 },
  batchNumber: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.18)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  statusText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  locationPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: RADIUS.pill,
  },
  locationPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  itemsContainer: {
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: RADIUS.md,
    marginTop: 12, padding: SPACING.sm,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  itemName: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '600' },
  itemQty: { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginRight: 8 },
  itemNotes: { fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', marginLeft: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: RADIUS.md, padding: 12, marginTop: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  empty: { alignItems: 'center', paddingTop: 90 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8 },
});
