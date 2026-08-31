import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { orderApi } from '../../services/orderApi';

const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', icon: 'cash', color: COLORS.success },
  { id: 'COD', label: 'Cash on Delivery', icon: 'bicycle', color: COLORS.info },
];

export default function PaymentScreen({ route, navigation }) {
  const { orderId, total } = route.params;
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handlePayment = async () => {
    if (!selectedMethod) {
      Alert.alert('Error', 'Select a payment method.');
      return;
    }

    setProcessing(true);
    try {
      await orderApi.payment(orderId, selectedMethod);
      Alert.alert('Success', `Payment of Rs. ${total} completed!`, [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Payment failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Total Display */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Amount</Text>
        <Text style={styles.totalValue}>Rs. {total}</Text>
      </View>

      {/* Payment Methods */}
      <Text style={styles.sectionTitle}>Select Payment Method</Text>
      {PAYMENT_METHODS.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.methodCard,
            selectedMethod === method.id && { borderColor: method.color, backgroundColor: method.color + '10' },
          ]}
          onPress={() => setSelectedMethod(method.id)}
        >
          <Ionicons
            name={method.icon}
            size={28}
            color={selectedMethod === method.id ? method.color : COLORS.textMuted}
          />
          <Text style={[
            styles.methodLabel,
            selectedMethod === method.id && { color: method.color },
          ]}>
            {method.label}
          </Text>
          {selectedMethod === method.id && (
            <Ionicons name="checkmark-circle" size={24} color={method.color} />
          )}
        </TouchableOpacity>
      ))}

      {/* Pay Button */}
      <TouchableOpacity
        style={[styles.payButton, (!selectedMethod || processing) && styles.payButtonDisabled]}
        onPress={handlePayment}
        disabled={!selectedMethod || processing}
      >
        {processing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.payButtonText}>
            Confirm Payment — Rs. {total}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  totalCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: COLORS.border,
  },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  totalValue: { fontSize: 36, fontWeight: '700', color: COLORS.primary },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.md },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    borderWidth: 2, borderColor: COLORS.border,
  },
  methodLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
  payButton: {
    backgroundColor: COLORS.success, borderRadius: RADIUS.md,
    padding: 18, alignItems: 'center', marginTop: 'auto', marginBottom: SPACING.xl,
  },
  payButtonDisabled: { opacity: 0.5 },
  payButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
