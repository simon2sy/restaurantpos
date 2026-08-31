import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { employeeApi } from '../../services/employeeApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';

const ROLE_COLORS = {
  MANAGER: '#f59e0b', WAITER: '#3b82f6', KITCHEN: '#ef4444',
  DELIVERY: '#22c55e', CASHIER: '#8b5cf6',
};

export default function EmployeeDetailScreen({ route }) {
  const { employeeId } = route.params;
  const [employee, setEmployee] = useState(null);
  const [qrInfo, setQrInfo] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [emp, qr] = await Promise.all([
        employeeApi.get(employeeId),
        employeeApi.getQR(employeeId),
      ]);
      setEmployee(emp);
      const info = qr?.data || qr || null;
      setQrInfo(info);
      // Show the QR image whenever a valid token exists
      if (info?.qr_token_valid) {
        employeeApi.qrImageSource(employeeId)
          .then(setQrImage)
          .catch((e) => Alert.alert('QR Error', e.message || 'Could not load QR image.'));
      } else {
        setQrImage(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQR = async (action) => {
    try {
      const res = await employeeApi.generateQR(employeeId, action);
      const info = res?.data || null;
      if (action === 'revoke') {
        setQrInfo(null);
        setQrImage(null);
      } else if (info?.qr_token) {
        // Show the fresh QR immediately
        setQrInfo({
          qr_token: info.qr_token,
          qr_token_valid: true,
          qr_token_expires_at: info.qr_token_expires_at,
        });
        try {
          setQrImage(await employeeApi.qrImageSource(employeeId));
        } catch (imgErr) {
          Alert.alert('QR Error', imgErr.message || 'Could not load QR image.');
        }
      } else {
        await fetchData();
      }
      Alert.alert('Success', `QR ${action}d successfully.`);
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleToggle = async () => {
    try {
      await employeeApi.toggle(employeeId);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchData} />;
  if (!employee) return <ErrorView message="Employee not found." />;

  const roleColor = ROLE_COLORS[employee.role] || COLORS.textMuted;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
          <Text style={[styles.avatarText, { color: roleColor }]}>
            {(employee.first_name || employee.username || '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{employee.first_name} {employee.last_name}</Text>
        <Text style={styles.username}>@{employee.username}</Text>
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
          <Text style={[styles.roleText, { color: roleColor }]}>{employee.role_display || employee.role}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{employee.phone || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Status</Text>
          <Text style={[styles.infoValue, { color: employee.is_active ? COLORS.success : COLORS.danger }]}>
            {employee.is_active ? 'Active' : 'Disabled'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>QR Active</Text>
          <Text style={[styles.infoValue, { color: qrInfo?.qr_token_valid ? COLORS.success : COLORS.danger }]}>
            {qrInfo?.qr_token_valid ? 'Yes' : 'No'}
          </Text>
        </View>
      </View>

      {/* QR Image — shown when a valid token exists */}
      {qrImage && (
        <View style={styles.qrImageCard}>
          <Image source={qrImage} style={styles.qrImage} resizeMode="contain" />
          {qrInfo?.qr_token_expires_at && (
            <Text style={styles.qrExpiry}>
              Valid until: {new Date(qrInfo.qr_token_expires_at).toLocaleString()}
            </Text>
          )}
          <Text style={styles.qrHint}>
            Have the employee scan this code with the login screen to sign in.
          </Text>
        </View>
      )}

      {/* QR Actions */}
      <Text style={styles.sectionTitle}>QR Code</Text>
      <View style={styles.qrActions}>
        <TouchableOpacity style={styles.qrButton} onPress={() => handleQR('generate')}>
          <Ionicons name="qr-code" size={20} color={COLORS.primary} />
          <Text style={styles.qrButtonText}>Generate QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qrButton} onPress={() => handleQR('regenerate')}>
          <Ionicons name="refresh" size={20} color={COLORS.warning} />
          <Text style={styles.qrButtonText}>Regenerate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.qrButton} onPress={() => handleQR('revoke')}>
          <Ionicons name="close-circle" size={20} color={COLORS.danger} />
          <Text style={styles.qrButtonText}>Revoke</Text>
        </TouchableOpacity>
      </View>

      {/* Toggle Status */}
      <TouchableOpacity
        style={[styles.toggleButton, { backgroundColor: employee.is_active ? COLORS.danger : COLORS.success }]}
        onPress={handleToggle}
      >
        <Text style={styles.toggleText}>
          {employee.is_active ? 'Disable Employee' : 'Enable Employee'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: SPACING.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  username: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 8 },
  roleText: { fontSize: 13, fontWeight: '600' },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  infoLabel: { fontSize: 14, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  qrActions: { flexDirection: 'row', gap: 8, marginBottom: SPACING.lg },
  qrButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 14, gap: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  qrButtonText: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  qrImageCard: {
    alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border,
  },
  qrImage: { width: 220, height: 220, backgroundColor: '#fff', borderRadius: 8 },
  qrExpiry: { marginTop: SPACING.sm, fontSize: 12, color: COLORS.textSecondary },
  qrHint: { marginTop: 4, fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
  toggleButton: { borderRadius: RADIUS.md, padding: 16, alignItems: 'center' },
  toggleText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
