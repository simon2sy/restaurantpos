import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { reportApi } from '../../services/reportApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { toObject } from '../../utils/data';
import { WS_BASE_URL } from '../../constants/config';
import useRealtime from '../../hooks/useRealtime';
import { notificationApi } from '../../services/notificationApi';
import * as Notifications from 'expo-notifications';

function StatCard({ icon, value, label, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '1a' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, title, subtitle, color, onPress }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '1a' }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <View style={styles.quickActionText}>
        <Text style={styles.quickActionTitle}>{title}</Text>
        <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

// Ask whether the new order is in-restaurant (pick a table/cabin)
// or a delivery order before navigating.
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};
const showOrderTypeChooser = (navigation) => {
  Alert.alert('New Order', 'What type of order is it?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: '🛵 Delivery',
      onPress: () => navigation.navigate('More', { screen: 'CreateDeliveryOrder' }),
    },
    {
      text: '🍽️ In Restaurant',
      onPress: () => navigation.navigate('Orders', { screen: 'Seating' }),
    },
  ]);
};

export default function DashboardScreen({ navigation }) {
  const { user, isManager, isCashier } = useAuth();
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [expenseTotal, setExpenseTotal] = useState(0);
  const [expenseCount, setExpenseCount] = useState(0);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [readyOrders, setReadyOrders] = useState([]);

  const fetchData = useCallback(async (selectedPeriod = 'today') => {
    try {
      if (isManager) {
        const [dashResponse, salesResponse, expenseResponse] = await Promise.all([
          reportApi.getDashboardStats(),
          reportApi.getSales({ period: selectedPeriod }).catch(() => null),
          reportApi.getExpenseSummary({ period: selectedPeriod }).catch(() => null),
        ]);
        setStats(toObject(dashResponse));
        const salesData = toObject(salesResponse);
        setSummary(toObject(salesData.summary) || null);
        const expenseData = toObject(expenseResponse);
        setExpenseTotal(Number(expenseData.total ?? 0));
        setExpenseCount(Number(expenseData.count ?? 0));
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isManager]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for real-time dashboard pings (order/payment/expense changes)
  // and refetch stats automatically — no manual pull-to-refresh needed.
  useRealtime(`${WS_BASE_URL}/dashboard/`, (msg) => {
    if (msg && msg.type === 'stats_updated') {
      fetchData(period);
    }
  });

  const changePeriod = (p) => {
    setPeriod(p);
    fetchData(p);
  };

  const periodLabel = { today: 'Today', '7': 'Week', month: 'Month' }[period];
  const greeting = getGreeting();
  const revenue = summary?.total_revenue ?? stats?.revenue_today ?? 0;
  const ordersCount = summary?.total_orders ?? stats?.orders_today ?? 0;
  const occupied =
    (stats?.tables_occupied ?? 0) + (stats?.cabins_occupied ?? 0);

  // Hero carousel slides — the active slide is shown big; the remaining
  // three are shown in the "Others" tiles below.
  const openNow = stats?.open_orders ?? 0;
  const totalSeats = (stats?.tables_total ?? 0) + (stats?.cabins_total ?? 0);
  const slides = [
    {
      key: 'revenue',
      label: `${periodLabel} Revenue`,
      value: `Rs. ${Number(revenue).toLocaleString()}`,
      sub: 'from paid orders',
      icon: 'wallet-outline',
      grad: ['#c084fc', '#7c3aed'],
    },
    {
      key: 'expenses',
      label: 'Expenses',
      value: `Rs. ${Number(expenseTotal).toLocaleString()}`,
      sub: `${expenseCount} record(s)`,
      icon: 'card-outline',
      grad: ['#f472b6', '#be185d'],
    },
    {
      key: 'orders',
      label: 'Orders',
      value: String(ordersCount),
      sub: `${openNow} open right now`,
      icon: 'receipt-outline',
      grad: ['#818cf8', '#4338ca'],
    },
    {
      key: 'kitchen',
      label: 'In Kitchen',
      value: String(stats?.kitchen_pending ?? 0),
      sub: 'batches being prepared',
      icon: 'flame-outline',
      grad: ['#fb923c', '#ea580c'],
    },
    {
      key: 'occupied',
      label: 'Occupied',
      value: String(occupied),
      sub: `of ${totalSeats} tables & cabins`,
      icon: 'people-outline',
      grad: ['#34d399', '#059669'],
    },
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);
  const cardWidth = Dimensions.get('window').width - SPACING.md * 2;

  const onSlideScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
    if (idx !== activeSlide && idx >= 0 && idx < slides.length) setActiveSlide(idx);
  };

  const others = slides.filter((s) => s.key !== slides[activeSlide].key);

  // Load pending "food ready" notifications from the server so the banner
  // reflects reality on app start / refresh (not just live events).
  const fetchReadyOrders = useCallback(async () => {
    if (!isCashier && !isManager) return;
    try {
      const response = await notificationApi.list();
      const data = response?.data;
      if (Array.isArray(data)) {
        setReadyOrders(
          data.slice(0, 5).map((n) => ({
            order_number: n.order_number,
            table: n.table_number,
            cabin: n.cabin_number,
            ready_at: n.ready_at ? String(n.ready_at).slice(11, 16) : '',
            ts: n.id,
          }))
        );
      }
    } catch (err) {
      // Non-critical — the banner is live-updated via WebSocket anyway.
    }
  }, [isCashier, isManager]);

  useEffect(() => {
    fetchReadyOrders();
  }, [fetchReadyOrders]);

  // Live "food ready" notifications pushed to waiters by the kitchen.
  // An `order_served` event removes the order from the banner.
  useRealtime(`${WS_BASE_URL}/waiters/`, (msg) => {
    if (msg && msg.type === 'order_ready') {
      setReadyOrders((prev) =>
        prev.some((o) => o.order_number === msg.order_number)
          ? prev
          : [{ ...msg, ts: Date.now() }, ...prev].slice(0, 5)
      );
      // Play a notification sound — the WebSocket event itself is silent,
      // so we present a local notification on the 'order-ready' channel,
      // which plays the custom order_ready.mp3 sound on Android.
      Notifications.scheduleNotificationAsync({
        content: {
          title: '🔔 Food is ready!',
          body: `Order #${msg.order_number} is ready to serve`,
          sound: 'order_ready.mp3',
          channelId: 'order-ready',
        },
        trigger: null,
      }).catch(() => {});
    }
    if (msg && msg.type === 'order_served') {
      setReadyOrders((prev) =>
        prev.filter((o) => o.order_number !== msg.order_number)
      );
    }
  });

  const onRefresh = () => { setRefreshing(true); fetchData(period); };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchData} />;

  const canTakeOrders = isCashier || isManager;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
      {/* Header — avatar, name, role, notifications */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.first_name || user?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.userName}>{user?.first_name || user?.username}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton} onPress={() => navigation.navigate('Orders')}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
          {readyOrders.length > 0 && <View style={styles.bellDot} />}
        </TouchableOpacity>
      </View>

      {/* Period pills */}
      <View style={styles.periodRow}>
        {[
          { key: 'today', label: 'Today' },
          { key: '7', label: 'Week' },
          { key: 'month', label: 'Month' },
        ].map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodPill, period === p.key && styles.periodPillActive]}
            onPress={() => changePeriod(p.key)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.periodSettings}>
          <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Live ready banner for waiters */}
      {canTakeOrders && readyOrders.length > 0 && (
        <View style={styles.readyBanner}>
          <Ionicons name="notifications" size={20} color={COLORS.success} />
          <View style={styles.readyBannerText}>
            <Text style={styles.readyBannerTitle}>Orders ready to serve</Text>
            {readyOrders.map((o) => (
              <Text key={o.order_number + o.ts} style={styles.readyBannerSubtitle}>
                Order #{o.order_number}{o.table ? ` · Table ${o.table}` : ''}
              </Text>
            ))}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Orders')}>
            <Text style={styles.readyBannerAction}>View</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hero carousel (manager) — swipe between metrics */}
      {isManager && stats && (
        <>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onSlideScroll}
            style={{ height: 160 }}
          >
            {slides.map((s) => (
              <View key={s.key} style={{ width: cardWidth }}>
                <LinearGradient colors={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.revenueCard}>
                  {/* decorative circles */}
                  <View style={[styles.decoCircle, { top: -30, right: -20 }]} />
                  <View style={[styles.decoCircle, { bottom: -40, left: -25, opacity: 0.5 }]} />

                  <View style={styles.revenueInfo}>
                    <View style={styles.revenueLabelRow}>
                      <View style={styles.heroIconChip}>
                        <Ionicons name={s.icon} size={14} color="#fff" />
                      </View>
                      <Text style={styles.revenueLabel}>{s.label}</Text>
                    </View>
                    <Text style={styles.revenueValue}>{s.value}</Text>
                    <Text style={styles.revenueSub}>{s.sub}</Text>
                  </View>
                  <View style={styles.trendWrap}>
                    <Ionicons name="trending-up" size={100} color="#a7f3d0" style={styles.trendIcon} />
                  </View>
                </LinearGradient>
              </View>
            ))}
          </ScrollView>

          {/* Dots */}
          <View style={styles.dotsRow}>
            {slides.map((s, i) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.dot, i === activeSlide && styles.dotActive]}
                onPress={() => carouselRef.current?.scrollTo({ x: i * cardWidth, animated: true })}
              />
            ))}
          </View>

          {/* Others — the three metrics not on the hero card right now */}
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Others</Text>
            <Text style={styles.sectionHint}>tap to focus</Text>
          </View>
          <View style={styles.tileRow}>
            {others.map((s) => (
              <TouchableOpacity
                key={s.key}
                activeOpacity={0.85}
                onPress={() => carouselRef.current?.scrollTo({ x: slides.indexOf(s) * cardWidth, animated: true })}
              >
                <LinearGradient colors={s.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                  <Ionicons name={s.icon} size={22} color="#fff" />
                  <Text style={styles.tileValue}>{s.value}</Text>
                  <Text style={styles.tileLabel}>{s.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {/* Detailed stats */}
          <View style={styles.statsGrid}>
            <StatCard icon="time" value={stats.open_orders ?? 0} label="Open Orders" color={COLORS.warning} />
            <StatCard icon="flame" value={stats.kitchen_pending ?? 0} label="Kitchen Queue" color={COLORS.danger} />
          </View>
        </>
      )}


      {/* Quick actions for order-taking staff */}
      {canTakeOrders && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <QuickAction
            icon="restaurant"
            title="New Order"
            subtitle="In-restaurant or delivery"
            color={COLORS.primary}
            onPress={() => showOrderTypeChooser(navigation)}
          />
          <QuickAction
            icon="receipt"
            title="View Orders"
            subtitle="See all current orders"
            color={COLORS.success}
            onPress={() => navigation.navigate('Orders')}
          />
        </View>
      )}

      {/* Welcome card for non-order staff */}
      {!canTakeOrders && (
        <View style={styles.welcomeCard}>
          <Ionicons name="hand-left" size={30} color={COLORS.primary} />
          <Text style={styles.welcomeTitle}>Welcome, {user?.first_name}!</Text>
          <Text style={styles.welcomeText}>
            Use the tabs below or open More to access your tools.
          </Text>
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: { padding: 2, borderRadius: 28, borderWidth: 2, borderColor: COLORS.primary + '55' },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.success, borderWidth: 2, borderColor: '#fff',
  },
  greeting: { fontSize: 12, color: COLORS.textMuted },
  userName: { fontSize: 21, fontWeight: '800', color: COLORS.textPrimary, marginTop: 1 },
  bellButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
  },
  bellDot: {
    position: 'absolute', top: 10, right: 11,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.danger, borderWidth: 1.5, borderColor: COLORS.card,
  },

  // Period pills
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.lg },
  periodPill: {
    flex: 1, alignItems: 'center',
    paddingVertical: 9, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  periodPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  periodTextActive: { color: '#fff', fontWeight: '700' },
  periodSettings: {
    width: 44, height: 38, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary + '1a',
    justifyContent: 'center', alignItems: 'center',
  },

  // Revenue hero card
  revenueCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderRadius: 22, padding: SPACING.lg,
    overflow: 'hidden',
  },
  decoCircle: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  revenueInfo: { flex: 1 },
  revenueLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroIconChip: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  revenueLabel: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  revenueValue: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 6 },
  revenueSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 4, fontWeight: '500' },
  trendWrap: { width: 120, height: 105, justifyContent: 'center', alignItems: 'flex-end' },
  trendIcon: { opacity: 0.9 },

  // Carousel dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: SPACING.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { width: 20, backgroundColor: COLORS.primary },

  // Live "food ready" banner (waiters)
  readyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.success + '12',
    borderColor: COLORS.success + '40', borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  readyBannerText: { flex: 1 },
  readyBannerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  readyBannerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  readyBannerAction: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  // Stats grid (manager)
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    width: '48.5%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.card,
  },
  statIcon: {
    width: 38, height: 38, borderRadius: RADIUS.sm + 2,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Quick actions (waiter / cashier)
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },

  // Others — tiles (original layout you approved, with gradient colors)
  tileRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  tile: {
    flex: 1, alignItems: 'center', gap: 4,
    borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 8,
  },
  tileValue: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 4 },
  tileLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  sectionTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionHint: { fontSize: 11, color: COLORS.textMuted },
  quickAction: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  quickActionIcon: {
    width: 50, height: 50, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center',
  },
  quickActionText: { flex: 1 },
  quickActionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  quickActionSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  // Welcome card (non order-taking staff)
  welcomeCard: {
    alignItems: 'center',
    backgroundColor: COLORS.tintSoft,
    borderRadius: RADIUS.lg, padding: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border,
  },
  welcomeTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.sm },
  welcomeText: {
    fontSize: 13, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: SPACING.xs, lineHeight: 19,
  },
});

