import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { reportApi } from '../../services/reportApi';
import { employeeApi } from '../../services/employeeApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

const { width } = Dimensions.get('window');

function StatCard({ icon, value, label, color, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '1a' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
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

export default function AdminDashboardScreen({ navigation }) {
  const { user, restaurant } = useAuth();
  const [stats, setStats] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [dashResponse, empResponse] = await Promise.all([
        reportApi.getDashboardStats().catch(() => null),
        employeeApi.getList().catch(() => null),
      ]);
      if (dashResponse?.data) setStats(dashResponse.data);
      if (empResponse?.data) setEmployees(empResponse.data.results || empResponse.data || []);
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

  const activeEmployees = employees.filter(e => e.is_active).length;
  const inactiveEmployees = employees.length - activeEmployees;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.first_name || user?.username}</Text>
            {restaurant && (
              <View style={styles.restaurantBadge}>
                <Ionicons name="business" size={14} color={COLORS.primary} />
                <Text style={styles.restaurantName}>{restaurant.name}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.statsGrid}>
          <StatCard icon="people" value={activeEmployees} label="Active Staff" color={COLORS.primary} onPress={() => navigation.navigate('More', { screen: 'Employees' })} />
          <StatCard icon="receipt" value={stats?.today_orders || 0} label="Today's Orders" color={COLORS.success} onPress={() => navigation.navigate('More', { screen: 'Reports' })} />
          <StatCard icon="cash" value={'$' + (stats?.today_revenue || 0)} label="Today's Revenue" color={COLORS.warning} onPress={() => navigation.navigate('More', { screen: 'DailySummary' })} />
          <StatCard icon="restaurant" value={stats?.pending_kitchen || 0} label="In Kitchen" color={COLORS.kitchenPreparing} onPress={() => navigation.navigate('More', { screen: 'Kitchen' })} />
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Quick Actions</Text></View>
        <QuickAction icon="person-add" title="Add Employee" subtitle="Register new staff" color={COLORS.primary} onPress={() => navigation.navigate('More', { screen: 'AddEmployee' })} />
        <QuickAction icon="restaurant" title="Menu Management" subtitle="Add or edit items" color={COLORS.success} onPress={() => navigation.navigate('Menu', { screen: 'MenuHome' })} />
        <QuickAction icon="receipt" title="View Orders" subtitle="Manage all orders" color={COLORS.warning} onPress={() => navigation.navigate('Orders', { screen: 'OrderList' })} />
        <QuickAction icon="stats-chart" title="Sales Reports" subtitle="View analytics" color={COLORS.info} onPress={() => navigation.navigate('More', { screen: 'Reports' })} />
        <QuickAction icon="settings" title="Restaurant Settings" subtitle="Update details" color={COLORS.textMuted} onPress={() => navigation.navigate('More', { screen: 'Profile' })} />
        <View style={styles.section}><View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>Staff Overview</Text><TouchableOpacity onPress={() => navigation.navigate('More', { screen: 'Employees' })}><Text style={styles.sectionHint}>View All</Text></TouchableOpacity></View></View>
        <View style={styles.employeeSummary}>
          <View style={styles.employeeStatItem}><Text style={styles.employeeStatValue}>{employees.length}</Text><Text style={styles.employeeStatLabel}>Total</Text></View>
          <View style={styles.employeeStatDivider} />
          <View style={styles.employeeStatItem}><Text style={[styles.employeeStatValue, { color: COLORS.success }]}>{activeEmployees}</Text><Text style={styles.employeeStatLabel}>Active</Text></View>
          <View style={styles.employeeStatDivider} />
          <View style={styles.employeeStatItem}><Text style={[styles.employeeStatValue, { color: COLORS.error }]}>{inactiveEmployees}</Text><Text style={styles.employeeStatLabel}>Inactive</Text></View>
        </View>
        {employees.length > 0 && (
          <View style={styles.recentEmployees}>
            {employees.slice(0, 3).map((emp) => (
              <TouchableOpacity key={emp.id} style={styles.employeeRow} onPress={() => navigation.navigate('More', { screen: 'EmployeeDetail', params: { id: emp.id } })}>
                <View style={styles.employeeAvatar}><Text style={styles.employeeAvatarText}>{(emp.first_name?.[0] || '') + (emp.last_name?.[0] || '')}</Text></View>
                <View style={styles.employeeInfo}><Text style={styles.employeeName}>{emp.first_name} {emp.last_name}</Text><Text style={styles.employeeRole}>{emp.role_display || emp.role}</Text></View>
                <View style={[styles.statusDot, { backgroundColor: emp.is_active ? COLORS.success : COLORS.textMuted }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  welcomeText: { fontSize: 14, color: COLORS.textSecondary },
  userName: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginTop: 2 },
  restaurantBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: COLORS.primary + '12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, alignSelf: 'flex-start' },
  restaurantName: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  notificationBtn: { width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.sm, marginBottom: SPACING.lg },
  statCard: { width: (width - SPACING.md * 2 - SPACING.sm) / 2, backgroundColor: COLORS.card, borderRadius: RADIUS.md, borderLeftWidth: 4, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  statIcon: { width: 40, height: 40, borderRadius: RADIUS.sm + 2, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  section: { marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHint: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.sm, ...SHADOW.card },
  quickActionIcon: { width: 50, height: 50, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  quickActionText: { flex: 1 },
  quickActionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  quickActionSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  employeeSummary: { flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card },
  employeeStatItem: { flex: 1, alignItems: 'center' },
  employeeStatValue: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  employeeStatLabel: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  employeeStatDivider: { width: 1, backgroundColor: COLORS.border, marginHorizontal: SPACING.sm },
  recentEmployees: { marginTop: SPACING.sm },
  employeeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.xs },
  employeeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary + '1a', justifyContent: 'center', alignItems: 'center' },
  employeeAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  employeeRole: { fontSize: 12, color: COLORS.textMuted },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
