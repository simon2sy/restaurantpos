import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS } from '../../constants/colors';
import { menuApi } from '../../services/menuApi';
import { toList } from '../../utils/data';

export default function AddMenuItemScreen({ navigation }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [available, setAvailable] = useState(true);
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await menuApi.listCategories();
      const cats = toList(res?.data ? res.data : res);
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not load categories.');
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to pick a menu image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return Alert.alert('Error', 'Enter the item name.');
    if (!price.trim() || isNaN(parseFloat(price))) return Alert.alert('Error', 'Enter a valid price.');
    if (!categoryId) return Alert.alert('Error', 'Select a category.');

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price.trim());
      formData.append('description', description.trim());
      formData.append('category', categoryId);
      formData.append('is_available', available ? 'true' : 'false');
      if (image) {
        const uri = image.uri;
        const ext = uri.split('.').pop().toLowerCase() || 'jpg';
        formData.append('image', {
          uri,
          name: `menu_item.${ext}`,
          type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
      }
      await menuApi.createItem(formData);
      Alert.alert('Success', `"${name.trim()}" added to the menu.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save the menu item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera-outline" size={34} color={COLORS.textMuted} />
            <Text style={styles.imagePlaceholderText}>Add photo</Text>
          </View>
        )}
        {image && (
          <View style={styles.imageEditBadge}>
            <Ionicons name="pencil" size={12} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Item name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Chicken Momo" placeholderTextColor={COLORS.textMuted} />

      <Text style={styles.label}>Price (Rs.) *</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="e.g. 250" keyboardType="decimal-pad" placeholderTextColor={COLORS.textMuted} />

      <Text style={styles.label}>Category *</Text>
      <View style={styles.categoryRow}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, categoryId === cat.id && styles.categoryChipActive]}
            onPress={() => setCategoryId(cat.id)}
          >
            <Text style={[styles.categoryText, categoryId === cat.id && styles.categoryTextActive]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
        {categories.length === 0 && <Text style={styles.noCategories}>No categories yet.</Text>}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Short description (optional)"
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={3}
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Available now</Text>
        <Switch value={available} onValueChange={setAvailable} trackColor={{ true: COLORS.primary }} />
      </View>

      <TouchableOpacity style={[styles.submitButton, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
        {saving ? (
          <Text style={styles.submitText}>Saving...</Text>
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitText}>Add to Menu</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  imagePicker: {
    alignSelf: 'center', width: 220, height: 160, borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg, overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  imagePlaceholderText: { color: COLORS.textMuted, fontSize: 13 },
  imageEditBadge: {
    position: 'absolute', right: 8, bottom: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: 14, fontSize: 15, color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  textArea: { height: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.md },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  categoryTextActive: { color: '#fff', fontWeight: '700' },
  noCategories: { color: COLORS.textMuted, fontSize: 13 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
