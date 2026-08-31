import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';

const ROLE_COLORS = {
  MANAGER: '#f59e0b', WAITER: '#3b82f6', KITCHEN: '#ef4444',
  DELIVERY: '#22c55e', CASHIER: '#8b5cf6',
};

export default function ProfileScreen() {
  const { user, logout, isManager, isKitchen, isCashier, isDelivery, isCustomer } = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const roleColor = ROLE_COLORS[user?.role] || (user?.is_superuser ? '#f59e0b' : COLORS.textMuted);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar & Name */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {(user?.first_name || user?.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
        {user?.role && (
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{user.role}</Text>
          </View>
        )}
        {user?.is_superuser && (
          <View style={[styles.roleBadge, { backgroundColor: '#f59e0b20' }]}>
            <Text style={[styles.roleText, { color: '#f59e0b' }]}>Superuser</Text>
          </View>
        )}
      </View>

      {/* Info Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="id-card-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={styles.infoValue}>{user?.id}</Text>
          </View>
          {user?.employee_id && (
            <View style={styles.infoRow}>
              <Ionicons name="briefcase-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.infoLabel}>Employee ID</Text>
              <Text style={styles.infoValue}>{user.employee_id}</Text>
            </View>
          )}
          {user?.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={18} color={COLORS.textMuted} />
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Permissions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="grid-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Dashboard</Text>
            <Ionicons name={isManager || user?.is_superuser ? 'checkmark-circle' : 'close-circle'}
              size={18} color={isManager || user?.is_superuser ? COLORS.success : COLORS.danger} />
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="receipt-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Orders</Text>
            <Ionicons name={isCashier || isManager ? 'checkmark-circle' : 'close-circle'}
              size={18} color={isCashier || isManager ? COLORS.success : COLORS.danger} />
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="flame-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Kitchen</Text>
            <Ionicons name={isKitchen ? 'checkmark-circle' : 'close-circle'}
              size={18} color={isKitchen ? COLORS.success : COLORS.danger} />
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="bicycle-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Delivery</Text>
            <Ionicons name={isDelivery ? 'checkmark-circle' : 'close-circle'}
              size={18} color={isDelivery ? COLORS.success : COLORS.danger} />
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="analytics-outline" size={18} color={COLORS.textMuted} />
            <Text style={styles.infoLabel}>Reports</Text>
            <Ionicons name={isManager ? 'checkmark-circle' : 'close-circle'}
              size={18} color={isManager ? COLORS.success : COLORS.danger} />
          </View>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: SPACING.xl, paddingTop: SPACING.md },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  username: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 8 },
  roleText: { fontSize: 13, fontWeight: '600' },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { flex: 1, fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.danger + '15', borderRadius: RADIUS.md,
    padding: 16, marginTop: SPACING.md,
  },
  logoutText: { color: COLORS.danger, fontWeight: '700', fontSize: 16 },
});
