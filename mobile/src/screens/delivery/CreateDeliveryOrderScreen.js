import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { deliveryApi } from '../../services/deliveryApi';
import { menuApi } from '../../services/menuApi';
import { toList } from '../../utils/data';

export default function CreateDeliveryOrderScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: details, 2: food selection
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedItems, setSelectedItems] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    try {
      const response = await menuApi.listCategories();
      const cats = toList(response);
      const itemsPromises = cats.map((cat) => menuApi.listItems({ category: cat.id, available: 'true' }));
      const itemsResults = await Promise.all(itemsPromises);
      setCategories(cats.map((cat, i) => ({ ...cat, items: toList(itemsResults[i]) })));
    } catch {
      Alert.alert('Error', 'Failed to load menu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 2) fetchMenu();
  }, [step, fetchMenu]);

  const updateQuantity = (itemId, delta) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || 0;
      const newQty = Math.max(0, current + delta);
      const updated = { ...prev };
      if (newQty === 0) delete updated[itemId];
      else updated[itemId] = newQty;
      return updated;
    });
  };

  const hasItems = Object.keys(selectedItems).length > 0;

  const handleSubmit = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !address.trim()) {
      Alert.alert('Error', 'Fill in all required fields.');
      return;
    }
    if (!hasItems) {
      Alert.alert('Error', 'Select at least one food item.');
      return;
    }

    setSubmitting(true);
    try {
      const items = Object.entries(selectedItems).map(([id, qty]) => ({
        menu_item_id: parseInt(id),
        quantity: qty,
      }));

      await deliveryApi.create({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        address: address.trim(),
        landmark: landmark.trim(),
        delivery_fee: 0,
        items,
      });

      Alert.alert('Success', 'Delivery order placed!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create delivery order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Customer Details</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name *</Text>
          <TextInput style={styles.input} placeholder="Customer name" placeholderTextColor={COLORS.textMuted}
            value={customerName} onChangeText={setCustomerName} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone *</Text>
          <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={COLORS.textMuted}
            value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address *</Text>
          <TextInput style={styles.input} placeholder="Delivery address" placeholderTextColor={COLORS.textMuted}
            value={address} onChangeText={setAddress} multiline numberOfLines={2} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Landmark</Text>
          <TextInput style={styles.input} placeholder="Nearby landmark (optional)" placeholderTextColor={COLORS.textMuted}
            value={landmark} onChangeText={setLandmark} />
        </View>
        <TouchableOpacity style={styles.nextButton} onPress={() => setStep(2)}>
          <Text style={styles.nextText}>Select Food →</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          categories.map((category) => (
            <View key={category.id} style={styles.categorySection}>
              <Text style={styles.categoryName}>{category.name}</Text>
              {category.items?.map((item) => (
                <View key={item.id} style={styles.menuItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>Rs. {item.price}</Text>
                  </View>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity style={styles.qtyButton} onPress={() => updateQuantity(item.id, -1)}>
                      <Ionicons name="remove" size={18} color={COLORS.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{selectedItems[item.id] || 0}</Text>
                    <TouchableOpacity style={[styles.qtyButton, styles.qtyButtonActive]} onPress={() => updateQuantity(item.id, 1)}>
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      {hasItems && (
        <View style={styles.submitBar}>
          <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.placeButton, submitting && { opacity: 0.5 }]} onPress={handleSubmit} disabled={submitting}>
            <Text style={styles.placeText}>{submitting ? 'Placing...' : 'Place Order'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 100 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  inputGroup: { marginBottom: SPACING.md },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: 14, fontSize: 16, color: COLORS.textPrimary,
  },
  nextButton: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: 16, alignItems: 'center', marginTop: SPACING.md,
  },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  categorySection: { marginBottom: SPACING.lg },
  categoryName: { fontSize: 18, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.xs,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '500', color: COLORS.textPrimary },
  itemPrice: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  qtyButtonActive: { backgroundColor: COLORS.primary },
  qtyText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, minWidth: 24, textAlign: 'center' },
  submitBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, backgroundColor: COLORS.surface,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    padding: SPACING.md, paddingBottom: SPACING.lg,
  },
  backButton: { padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  backText: { color: COLORS.textPrimary, fontWeight: '600' },
  placeButton: { flex: 1, backgroundColor: COLORS.success, borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  placeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
