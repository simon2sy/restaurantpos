// Colors matching the existing POS web design (modern, light & simple)
export const COLORS = {
  // Primary palette
  primary: '#4f6ef7',
  primaryDark: '#3b56d9',
  primaryLight: '#7b92fa',

  // Backgrounds — white base as requested
  background: '#ffffff',
  surface: '#ffffff',
  surfaceLight: '#f1f3f9',
  card: '#ffffff',
  tintSoft: '#f7f8fd',

  // Status colors
  success: '#16a34a',
  warning: '#ea9425',
  danger: '#e5484d',
  info: '#0ea5e9',

  // Text
  textPrimary: '#1b2238',
  textSecondary: '#5c667f',
  textMuted: '#98a0b3',
  textInverse: '#ffffff',

  // Borders (soft, light)
  border: '#e6eaf2',
  borderLight: '#d3dae6',

  // Kitchen status
  kitchenPending: '#4f6ef7',
  kitchenPreparing: '#ea9425',
  kitchenReady: '#16a34a',

  // Payment
  paid: '#16a34a',
  unpaid: '#e5484d',

  // Order status
  orderOpen: '#4f6ef7',
  orderPreparing: '#ea9425',
  orderReady: '#16a34a',
  orderServed: '#8b5cf6',
  orderCompleted: '#98a0b3',
  orderCancelled: '#e5484d',

  // Table status
  tableAvailable: '#16a34a',
  tableOccupied: '#ea9425',
  tableReserved: '#8b5cf6',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
};

// Soft elevation shadows for cards / floating elements (light theme)
export const SHADOW = {
  // Small elevation for cards
  card: {
    shadowColor: '#1b2238',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  // Softer, used on floating elements
  float: {
    shadowColor: '#1b2238',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};
