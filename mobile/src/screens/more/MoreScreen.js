import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';

const ROLE_COLORS = {
  MANAGER: '#4f6ef7', WAITER: '#0ea5e9', KITCHEN: '#ea9425',
  DELIVERY: '#16a34a', CASHIER: '#8b5cf6',
};

export default function MoreScreen({ navigation }) {
  const { user, logout, isManager, isKitchen, isCashier, isDelivery } = useAuth();

  const roleColor = ROLE_COLORS[user?.role] || (user?.is_superuser ? '#4f6ef7' : COLORS.textMuted);

  const sections = [
    {
      title: 'Operations',
      items: [
        isKitchen && { key: 'Kitchen', icon: 'flame', color: COLORS.kitchenPreparing, label: 'Kitchen Display', onPress: () => navigation.navigate('Kitchen') },
        isDelivery && { key: 'Delivery', icon: 'bicycle', color: COLORS.success, label: 'Deliveries', onPress: () => navigation.navigate('Delivery') },
        isCashier && { key: 'CreateDeliveryOrder', icon: 'cube', color: COLORS.info, label: 'New Delivery Order', onPress: () => navigation.navigate('CreateDeliveryOrder') },
      ].filter(Boolean),
    },
    {
      title: 'Management',
      items: [
        isManager && { key: 'AddMenuItem', icon: 'add-circle', color: COLORS.success, label: 'Add Menu Item', onPress: () => navigation.navigate('Menu', { screen: 'AddMenuItem' }) },
        isManager && { key: 'StockIn', icon: 'cube', color: COLORS.info, label: 'Stock In', onPress: () => navigation.navigate('Menu', { screen: 'StockIn' }) },
        isManager && { key: 'Expenses', icon: 'card', color: '#be185d', label: 'Expenses', onPress: () => navigation.navigate('Expenses') },
        isManager && { key: 'DailySummary', icon: 'document-text', color: COLORS.success, label: 'Daily Summary', onPress: () => navigation.navigate('DailySummary') },
        isManager && { key: 'Reports', icon: 'analytics', color: COLORS.primary, label: 'Sales Reports', onPress: () => navigation.navigate('Reports') },
        isManager && { key: 'Employees', icon: 'people', color: COLORS.primaryLight, label: 'Employees', onPress: () => navigation.navigate('Employees') },
      ].filter(Boolean),
    },
  ].filter((section) => section.items.length > 0);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      {user && (
        <TouchableOpacity style={styles.profileCard} onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '1a' }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>
              {(user.first_name || user.username || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user.first_name || user.username}</Text>
            <Text style={styles.profileRole}>{user.role || 'Staff'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      )}

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionCard}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.row, idx < section.items.length - 1 && styles.rowBorder]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, { backgroundColor: item.color + '1a' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOW.card,
  },
  avatar: { width: 52, height: 52, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700' },
  profileInfo: { flex: 1, marginLeft: SPACING.md },
  profileName: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  profileRole: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginBottom: SPACING.lg },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.sm, marginLeft: 4 },
  sectionCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.lg, ...SHADOW.card },
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowIcon: { width: 40, height: 40, borderRadius: RADIUS.sm, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15, color: COLORS.textPrimary, fontWeight: '500', marginLeft: SPACING.md },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.danger + '12', borderRadius: RADIUS.lg,
    padding: 16, ...SHADOW.card,
  },
  logoutText: { color: COLORS.danger, fontWeight: '700', fontSize: 16 },
});
