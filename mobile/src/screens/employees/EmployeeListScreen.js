import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { employeeApi } from '../../services/employeeApi';
import { toList } from '../../utils/data';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

const ROLE_COLORS = {
  MANAGER: '#f59e0b',
  WAITER: '#3b82f6',
  KITCHEN: '#ef4444',
  DELIVERY: '#22c55e',
  CASHIER: '#8b5cf6',
};

function EmployeeCard({ employee, onPress, onToggle }) {
  const roleColor = ROLE_COLORS[employee.role] || COLORS.textMuted;

  return (
    <TouchableOpacity style={styles.employeeCard} onPress={() => onPress(employee)} activeOpacity={0.7}>
      <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
        <Text style={[styles.avatarText, { color: roleColor }]}>
          {(employee.first_name || employee.username || '?')[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.employeeInfo}>
        <Text style={styles.employeeName}>
          {employee.first_name} {employee.last_name}
        </Text>
        <Text style={styles.employeeUsername}>@{employee.username}</Text>
        <View style={styles.employeeMeta}>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{employee.role_display || employee.role}</Text>
          </View>
          <Text style={[styles.activeStatus, { color: employee.is_active ? COLORS.success : COLORS.danger }]}>
            {employee.is_active ? 'Active' : 'Disabled'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

export default function EmployeeListScreen({ navigation }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await employeeApi.list();
      setEmployees(toList(response));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const onRefresh = () => { setRefreshing(true); fetchEmployees(); };

  const handleToggle = async (emp) => {
    try {
      await employeeApi.toggle(emp.id);
      fetchEmployees();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchEmployees} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={employees}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <EmployeeCard
            employee={item}
            onPress={(emp) => navigation.navigate('EmployeeDetail', { employeeId: emp.id })}
            onToggle={handleToggle}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No employees</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md, gap: SPACING.sm },
  employeeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700' },
  employeeInfo: { flex: 1 },
  employeeName: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  employeeUsername: { fontSize: 13, color: COLORS.textMuted },
  employeeMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: '600' },
  activeStatus: { fontSize: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 16, marginTop: 12 },
});
