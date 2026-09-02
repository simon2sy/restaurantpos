import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { reportApi } from '../../services/reportApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toObject, toList } from '../../utils/data';

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '0');
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const money = (v) => `Rs. ${fmt(v)}`;

const METHOD_ICONS = {
  CASH: { icon: 'cash-outline', color: '#16a34a' },
  CARD: { icon: 'card-outline', color: '#3b82f6' },
  ONLINE: { icon: 'globe-outline', color: '#8b5cf6' },
  DEFAULT: { icon: 'wallet-outline', color: '#ea9425' },
};

function getMethodInfo(method) {
  const key = (method || '').toUpperCase();
  return METHOD_ICONS[key] || METHOD_ICONS.DEFAULT;
}

export default function DailySummaryScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await reportApi.getSales({ period: 'today' });
      setData(toObject(response));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const onRefresh = () => { setRefreshing(true); fetchSummary(); };

  const handleSendSummary = async () => {
    Alert.alert(
      'Send Daily Summary',
      'Push notification will be sent to all managers and owners.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const result = await reportApi.triggerDailySummary();
              const msg = result?.message || 'Summary sent successfully!';
              Alert.alert('✅ Sent', msg);
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to send summary.');
            } finally {
              setSending(false);
            }
          },
        },
      ],
    );
  };

  if (loading && !data) return <LoadingSpinner />;
  if (error && !data) return <ErrorView message={error} onRetry={fetchSummary} />;

  const summary = data?.summary || {};
  const byMethod = toList(data?.by_method);
  const topItems = toList(data?.top_items).slice(0, 6);
  const detailedOrders = toList(data?.detailed_orders).slice(0, 10);
  const days = toList(data?.days);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* ── Receipt Header ── */}
      <View style={styles.receiptHeader}>
        <Ionicons name="document-text" size={28} color={COLORS.primary} />
        <Text style={styles.receiptTitle}>Daily Summary</Text>
        <Text style={styles.receiptDate}>{dateStr}</Text>
      </View>

      {/* ── Revenue Hero ── */}
      <View style={[styles.heroCard, { backgroundColor: COLORS.success }]}>
        <Text style={styles.heroLabel}>TOTAL REVENUE</Text>
        <Text style={styles.heroValue}>{money(summary.total_revenue)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroChip}>
            <Ionicons name="receipt-outline" size={14} color="#fff" />
            <Text style={styles.heroChipText}>{fmt(summary.total_orders)} orders</Text>
          </View>
          <View style={styles.heroChip}>
            <Ionicons name="trending-up-outline" size={14} color="#fff" />
            <Text style={styles.heroChipText}>Avg {money(summary.avg_order)}</Text>
          </View>
        </View>
      </View>

      {/* ── Quick Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
          </View>
          <Text style={styles.statVal}>{fmt(summary.total_orders)}</Text>
          <Text style={styles.statLbl}>Paid</Text>
        </View>
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: COLORS.danger + '18' }]}>
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          </View>
          <Text style={styles.statVal}>{fmt(summary.unpaid_count ?? 0)}</Text>
          <Text style={styles.statLbl}>Unpaid</Text>
        </View>
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: '#d97706' + '18' }]}>
            <Ionicons name="wallet-outline" size={18} color="#d97706" />
          </View>
          <Text style={styles.statVal}>{money(summary.unpaid_amount)}</Text>
          <Text style={styles.statLbl}>Pending</Text>
        </View>
      </View>

      {/* ── Payment Methods ── */}
      {byMethod.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet" size={18} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Payment Methods</Text>
          </View>
          {byMethod.map((m, idx) => {
            const info = getMethodInfo(m.payment_method);
            const totalPaid = Number(summary.total_revenue) || 1;
            const pct = Math.round(((Number(m.revenue) || 0) / totalPaid) * 100);
            return (
              <View key={idx} style={styles.methodRow}>
                <View style={[styles.methodIcon, { backgroundColor: info.color + '18' }]}>
                  <Ionicons name={info.icon} size={18} color={info.color} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodName}>{(m.payment_method || 'Other').toUpperCase()}</Text>
                  <Text style={styles.methodMeta}>{m.orders} orders · {pct}%</Text>
                </View>
                <Text style={styles.methodAmount}>{money(m.revenue)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Top Selling Items ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="flame" size={18} color="#ea580c" />
          <Text style={styles.cardTitle}>Top Selling Items</Text>
        </View>
        {topItems.length === 0 ? (
          <Text style={styles.empty}>No sales data for today.</Text>
        ) : (
          topItems.map((item, idx) => (
            <View key={idx} style={styles.itemRow}>
              <View style={[styles.rankBadge, { backgroundColor: idx < 3 ? COLORS.primary : COLORS.surfaceLight }]}>
                <Text style={[styles.rankText, idx < 3 && { color: '#fff' }]}>{idx + 1}</Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.menu_item__name || item.name}</Text>
                <Text style={styles.itemMeta}>{item.items_sold} sold · {money(item.revenue)}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Daily Chart (if multi-day) ── */}
      {days.length > 1 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bar-chart" size={18} color="#3b82f6" />
            <Text style={styles.cardTitle}>Daily Breakdown</Text>
          </View>
          {days.map((d, idx) => {
            const maxRev = Math.max(1, ...days.map((x) => Number(x.revenue) || 0));
            const pct = Math.max(4, ((Number(d.revenue) || 0) / maxRev) * 100);
            const dayName = new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
            return (
              <View key={idx} style={styles.dayRow}>
                <Text style={styles.dayLabel}>{dayName}</Text>
                <View style={styles.dayBarTrack}>
                  <View style={[styles.dayBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.dayValue}>{money(d.revenue)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Recent Orders ── */}
      {detailedOrders.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={18} color="#8b5cf6" />
            <Text style={styles.cardTitle}>Recent Paid Orders</Text>
          </View>
          {detailedOrders.map((order) => (
            <View key={order.id} style={styles.orderRow}>
              <View style={styles.orderLeft}>
                <Text style={styles.orderNumber}>#{order.order_number || order.id}</Text>
                <Text style={styles.orderLocation}>
                  {order.table ? `Table ${order.table}` :
                   order.cabin ? `Cabin ${order.cabin}` :
                   order.customer_name ? `Delivery → ${order.customer_name}` :
                   order.order_type}
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderTotal}>{money(order.total)}</Text>
                <Text style={styles.orderMethod}>
                  {(order.payment_method || '—').toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── Send Summary Button ── */}
      <TouchableOpacity
        style={[styles.sendButton, sending && styles.sendButtonDisabled]}
        onPress={handleSendSummary}
        disabled={sending}
        activeOpacity={0.8}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="notifications" size={20} color="#fff" />
        )}
        <Text style={styles.sendButtonText}>
          {sending ? 'Sending...' : 'Send Summary to Managers'}
        </Text>
      </TouchableOpacity>

      {/* ── Receipt Footer ── */}
      <View style={styles.receiptFooter}>
        <View style={styles.dashedLine} />
        <Text style={styles.footerText}>Generated by Restaurant POS</Text>
        <Text style={styles.footerTime}>
          {today.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },

  /* Receipt header */
  receiptHeader: {
    alignItems: 'center', paddingVertical: SPACING.lg,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    marginBottom: SPACING.md, ...SHADOW.card,
  },
  receiptTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8 },
  receiptDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },

  /* Hero */
  heroCard: {
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOW.card,
  },
  heroLabel: { color: 'rgba(255,255,255,.85)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 6, letterSpacing: 0.3 },
  heroRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md, flexWrap: 'wrap' },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,.18)', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: RADIUS.pill,
  },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  /* Stats row */
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statBox: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', ...SHADOW.card,
  },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statVal: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  statLbl: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  /* Card */
  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md, ...SHADOW.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  empty: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },

  /* Payment methods */
  methodRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  methodIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  methodInfo: { flex: 1, marginLeft: SPACING.sm },
  methodName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  methodMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  methodAmount: { fontSize: 15, fontWeight: '800', color: COLORS.success },

  /* Top items */
  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: RADIUS.sm,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm,
  },
  rankText: { fontSize: 13, fontWeight: '800', color: COLORS.textMuted },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  itemMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  /* Daily chart */
  dayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dayLabel: { width: 50, fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  dayBarTrack: {
    flex: 1, height: 12, backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.pill, overflow: 'hidden', marginHorizontal: 8,
  },
  dayBarFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: RADIUS.pill },
  dayValue: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, minWidth: 65, textAlign: 'right' },

  /* Recent orders */
  orderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  orderLeft: {},
  orderNumber: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  orderLocation: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  orderRight: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 15, fontWeight: '800', color: COLORS.success },
  orderMethod: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  /* Send button */
  sendButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: SPACING.md, ...SHADOW.card,
  },
  sendButtonDisabled: { opacity: 0.6 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  /* Receipt footer */
  receiptFooter: { alignItems: 'center', paddingVertical: SPACING.md },
  dashedLine: {
    width: '100%', height: 1, borderWidth: 1, borderColor: COLORS.border,
    borderStyle: 'dashed', marginBottom: SPACING.md,
  },
  footerText: { fontSize: 12, color: COLORS.textMuted },
  footerTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
});
