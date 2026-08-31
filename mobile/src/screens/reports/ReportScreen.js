import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { reportApi } from '../../services/reportApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toObject, toList } from '../../utils/data';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '0');
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

const money = (v) => `Rs. ${fmt(v)}`;

export default function ReportScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('today');

  const fetchReport = useCallback(async () => {
    try {
      const response = await reportApi.getSales({ period });
      setData(toObject(response));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const onRefresh = () => { setRefreshing(true); fetchReport(); };

  if (loading && !data) return <LoadingSpinner />;
  if (error && !data) return <ErrorView message={error} onRetry={fetchReport} />;

  const summary = data?.summary || {};
  const topItems = toList(data?.top_items).slice(0, 5);
  const byCategory = toList(data?.by_category);

  const maxSold = Math.max(1, ...topItems.map((i) => Number(i.items_sold) || 0));
  const maxCatRevenue = Math.max(1, ...byCategory.map((c) => Number(c.revenue) || 0));

  const stats = [
    { icon: 'receipt-outline', label: 'Paid Orders', value: fmt(summary.total_orders), color: COLORS.info, bg: COLORS.info + '18' },
    { icon: 'trending-up-outline', label: 'Avg Order', value: money(summary.avg_order), color: '#7c3aed', bg: '#7c3aed18' },
    { icon: 'hourglass-outline', label: 'Unpaid', value: String(summary.unpaid_count ?? 0), color: COLORS.danger, bg: COLORS.danger + '18' },
    { icon: 'wallet-outline', label: 'Unpaid Amt.', value: money(summary.unpaid_amount), color: '#d97706', bg: '#d9770618' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Period pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.pill, period === p.key && styles.pillActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillText, period === p.key && styles.pillTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Hero revenue card */}
      <View style={[styles.heroCard, { backgroundColor: COLORS.success }]}>
        <View style={styles.heroTop}>
          <Ionicons name="cash-outline" size={22} color="rgba(255,255,255,.9)" />
          <Text style={styles.heroLabel}>TOTAL REVENUE</Text>
        </View>
        <Text style={styles.heroValue}>{money(summary.total_revenue)}</Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroChip}>
            <Text style={styles.heroChipText}>{fmt(summary.total_orders)} paid orders</Text>
          </View>
          <View style={[styles.heroChip, { backgroundColor: 'rgba(255,255,255,.25)' }]}>
            <Text style={styles.heroChipText}>{PERIODS.find((p) => p.key === period)?.label}</Text>
          </View>
        </View>
      </View>

      {/* Secondary stats grid */}
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={18} color={s.color} />
            </View>
            <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Top selling items with bars */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="flame" size={18} color="#ea580c" />
          <Text style={styles.sectionTitle}>Top Selling Items</Text>
        </View>
        {topItems.length === 0 ? (
          <Text style={styles.empty}>No sales data for this period.</Text>
        ) : (
          topItems.map((item, idx) => (
            <View key={idx} style={styles.barRow}>
              <View style={styles.barInfo}>
                <Text style={styles.barName} numberOfLines={1}>{item.menu_item__name || item.name}</Text>
                <Text style={styles.barMeta}>{item.items_sold} sold · {money(item.revenue)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(8, ((Number(item.items_sold) || 0) / maxSold) * 100)}%`,
                      backgroundColor: ['#ea580c', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][idx % 5],
                    },
                  ]}
                />
              </View>
            </View>
          ))
        )}
      </View>

      {/* Category revenue split */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="pie-chart" size={18} color="#3b82f6" />
          <Text style={styles.sectionTitle}>Category Revenue</Text>
        </View>
        {byCategory.length === 0 ? (
          <Text style={styles.empty}>No category data for this period.</Text>
        ) : (
          byCategory.map((cat, idx) => (
            <View key={idx} style={styles.catRow}>
              <Text style={styles.catName} numberOfLines={1}>{cat.menu_item__category__name || cat.category__name || 'Other'}</Text>
              <View style={styles.catBarWrap}>
                <View style={styles.catTrack}>
                  <View
                    style={[
                      styles.catFill,
                      {
                        width: `${Math.max(6, ((Number(cat.revenue) || 0) / maxCatRevenue) * 100)}%`,
                        backgroundColor: idx % 2 ? '#8b5cf6' : '#3b82f6',
                      },
                    ]}
                  />
                </View>
                <Text style={styles.catValue}>{money(cat.revenue)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  filterRow: { gap: 8, marginBottom: SPACING.md, paddingRight: SPACING.md },
  pill: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },

  heroCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLabel: { color: 'rgba(255,255,255,.85)', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  heroValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 8, letterSpacing: 0.3 },
  heroFooter: { flexDirection: 'row', gap: 8, marginTop: SPACING.md, flexWrap: 'wrap' },
  heroChip: { backgroundColor: 'rgba(255,255,255,.18)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    flexGrow: 1, minWidth: '47%',
    backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md,
    ...SHADOW.card,
  },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  sectionCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  empty: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },

  barRow: { marginBottom: SPACING.sm },
  barInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  barName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, flexShrink: 1 },
  barMeta: { fontSize: 12, color: COLORS.textMuted },
  barTrack: {
    height: 8, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.pill,
    marginTop: 6, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: RADIUS.pill },

  catRow: { marginBottom: SPACING.sm },
  catName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 4 },
  catBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catTrack: { flex: 1, height: 8, backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.pill, overflow: 'hidden' },
  catFill: { height: '100%', borderRadius: RADIUS.pill },
  catValue: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, minWidth: 70, textAlign: 'right' },
});
