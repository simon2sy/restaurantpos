import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, RefreshControl, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOW } from '../../constants/colors';
import { menuApi } from '../../services/menuApi';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorView from '../../components/ErrorView';
import { SkeletonList } from '../../components/Skeleton';

function IngredientCard({ ingredient, onAddStock }) {
  const isLow = parseFloat(ingredient.current_stock) <= parseFloat(ingredient.minimum_stock);
  const isOut = parseFloat(ingredient.current_stock) === 0;

  return (
    <TouchableOpacity
      style={[styles.ingredientCard, isLow && styles.ingredientCardLow]}
      onPress={() => onAddStock(ingredient)}
      activeOpacity={0.7}
    >
      <View style={styles.ingredientHeader}>
        <View style={styles.ingredientNameRow}>
          <Text style={styles.ingredientName}>{ingredient.name}</Text>
          {isOut && (
            <View style={[styles.badge, { backgroundColor: COLORS.danger + '20' }]}>
              <Text style={[styles.badgeText, { color: COLORS.danger }]}>OUT</Text>
            </View>
          )}
          {isLow && !isOut && (
            <View style={[styles.badge, { backgroundColor: COLORS.warning + '20' }]}>
              <Text style={[styles.badgeText, { color: COLORS.warning }]}>LOW</Text>
            </View>
          )}
        </View>
        <Text style={styles.ingredientUnit}>{ingredient.unit}</Text>
      </View>

      <View style={styles.stockRow}>
        <View style={styles.stockInfo}>
          <Text style={styles.stockLabel}>Current Stock</Text>
          <Text style={[styles.stockValue, isLow && { color: COLORS.danger }]}>
            {ingredient.current_stock}
          </Text>
        </View>
        <View style={styles.stockInfo}>
          <Text style={styles.stockLabel}>Minimum</Text>
          <Text style={styles.stockValue}>{ingredient.minimum_stock}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => onAddStock(ingredient)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={36} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function StockInScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [stockAmount, setStockAmount] = useState('');
  const [stockNote, setStockNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchIngredients = useCallback(async () => {
    try {
      const response = await menuApi.listIngredients();
      const data = response?.data?.results || response?.results || response?.data || response || [];
      setIngredients(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchIngredients();
  };

  const handleAddStock = (ingredient) => {
    setSelectedIngredient(ingredient);
    setStockAmount('');
    setStockNote('');
    setModalVisible(true);
  };

  const handleSubmitStock = async () => {
    if (!stockAmount || parseFloat(stockAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      await menuApi.adjustStock({
        ingredient_id: selectedIngredient.id,
        quantity: parseFloat(stockAmount),
        movement_type: 'STOCK_IN',
        note: stockNote || `Stock added from mobile`,
      });

      Alert.alert(
        'Stock Added',
        `${stockAmount} ${selectedIngredient.unit} added to ${selectedIngredient.name}`,
      );
      setModalVisible(false);
      fetchIngredients();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to add stock.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = ingredients.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const lowStockCount = ingredients.filter(
    (item) => parseFloat(item.current_stock) <= parseFloat(item.minimum_stock),
  ).length;

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error} onRetry={fetchIngredients} />;

  return (
    <View style={styles.container}>
      {/* Header stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{ingredients.length}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, lowStockCount > 0 && { color: COLORS.danger }]}>
            {lowStockCount}
          </Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ingredients..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Low stock alert */}
      {lowStockCount > 0 && (
        <View style={styles.alertBanner}>
          <Ionicons name="warning" size={18} color={COLORS.warning} />
          <Text style={styles.alertText}>
            {lowStockCount} item{lowStockCount > 1 ? 's' : ''} below minimum stock
          </Text>
        </View>
      )}

      {/* Ingredients list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <IngredientCard ingredient={item} onAddStock={handleAddStock} />
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No ingredients found</Text>
          </View>
        }
      />

      {/* Stock In Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Stock In</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedIngredient && (
              <View style={styles.modalIngredientInfo}>
                <Text style={styles.modalIngredientName}>{selectedIngredient.name}</Text>
                <Text style={styles.modalIngredientStock}>
                  Current: {selectedIngredient.current_stock} {selectedIngredient.unit}
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Quantity to Add</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={stockAmount}
              onChangeText={setStockAmount}
              autoFocus
            />

            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. From supplier X"
              placeholderTextColor={COLORS.textMuted}
              value={stockNote}
              onChangeText={setStockNote}
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmitStock}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.submitText}>
                {submitting ? 'Adding...' : 'Add Stock'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  statsRow: {
    flexDirection: 'row', gap: SPACING.sm, padding: SPACING.md, paddingBottom: 0,
  },
  statCard: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  statNumber: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceLight,
    borderRadius: RADIUS.sm, margin: SPACING.md, marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: SPACING.sm, fontSize: 15, color: COLORS.textPrimary },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.warning + '15', marginHorizontal: SPACING.md,
    padding: SPACING.sm, borderRadius: RADIUS.sm, marginBottom: SPACING.sm,
  },
  alertText: { fontSize: 13, color: COLORS.warning, fontWeight: '600' },
  list: { padding: SPACING.md, gap: SPACING.sm },
  ingredientCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.card,
  },
  ingredientCardLow: { borderColor: COLORS.warning + '50' },
  ingredientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  ingredientNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingredientName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  ingredientUnit: { fontSize: 13, color: COLORS.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  stockRow: { flexDirection: 'row', alignItems: 'center' },
  stockInfo: { flex: 1 },
  stockLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  stockValue: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  addButton: { padding: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { color: COLORS.textMuted, fontSize: 16, marginTop: 12 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: {
    backgroundColor: COLORS.card, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  modalIngredientInfo: {
    backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.sm, padding: SPACING.md, marginBottom: SPACING.md,
  },
  modalIngredientName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  modalIngredientStock: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surfaceLight, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: SPACING.md, paddingVertical: 12, fontSize: 16, color: COLORS.textPrimary, marginBottom: SPACING.md,
  },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, ...SHADOW.float,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
