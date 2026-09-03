import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/colors';
import useNotifications from '../hooks/useNotifications';
import NotificationBell from '../components/NotificationBell';

// Home
import DashboardScreen from '../screens/dashboard/DashboardScreen';

// Orders
import OrderListScreen from '../screens/orders/OrderListScreen';
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import CreateOrderScreen from '../screens/orders/CreateOrderScreen';
import AddItemsScreen from '../screens/orders/AddItemsScreen';
import PaymentScreen from '../screens/orders/PaymentScreen';
import SeatingScreen from '../screens/orders/SeatingScreen';

// Menu
import MenuScreen from '../screens/menu/MenuScreen';
import AddMenuItemScreen from '../screens/menu/AddMenuItemScreen';

// More
import MoreScreen from '../screens/more/MoreScreen';
import KitchenScreen from '../screens/kitchen/KitchenScreen';
import DeliveryListScreen from '../screens/delivery/DeliveryListScreen';
import CreateDeliveryOrderScreen from '../screens/delivery/CreateDeliveryOrderScreen';
import ReportScreen from '../screens/reports/ReportScreen';
import DailySummaryScreen from '../screens/reports/DailySummaryScreen';
import ExpensesScreen from '../screens/reports/ExpensesScreen';
import EmployeeListScreen from '../screens/employees/EmployeeListScreen';
import EmployeeDetailScreen from '../screens/employees/EmployeeDetailScreen';
import AddEmployeeScreen from '../screens/employees/AddEmployeeScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Notifications
import NotificationsScreen from '../screens/notifications/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const defaultScreenOptions = {
  headerStyle: { backgroundColor: COLORS.surface },
  headerTintColor: COLORS.textPrimary,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: COLORS.background },
};

// ============================================================
// STACK NAVIGATORS for each tab
// ============================================================

function HomeStack() {
  const { user } = useAuth();
  // Kitchen-only staff get the Kitchen Display (KDS) as their home screen;
  // everyone else (incl. managers/admins) gets the analytics dashboard.
  const isKitchenOnly = user?.role === 'KITCHEN';

  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      {isKitchenOnly ? (
        <Stack.Screen
          name="HomeKitchen"
          component={KitchenScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Screen name="HomeHome" component={DashboardScreen} options={{ headerShown: false }} />
      )}
      {/* Reachable from the dashboard bell icon */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  const { count, refresh } = useNotifications();

  // Re-fetch notification count every time this tab gains focus
  // (e.g. after dismissing a notification and pressing Back).
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen
        name="OrderList"
        component={OrderListScreen}
        options={({ navigation }) => ({
          title: 'Orders',
          headerRight: () => (
            <NotificationBell
              count={count}
              onPress={() => {
                refresh();
                navigation.navigate('Notifications');
              }}
            />
          ),
        })}
      />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order Detail' }} />
      <Stack.Screen name="CreateOrder" component={CreateOrderScreen} options={{ title: 'New Order' }} />
      <Stack.Screen name="AddItems" component={AddItemsScreen} options={{ title: 'Add Items' }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ title: 'Payment' }} />
      <Stack.Screen name="Seating" component={SeatingScreen} options={{ title: 'Seating' }} />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}

function MenuStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="MenuHome" component={MenuScreen} options={{ title: 'Menu' }} />
      <Stack.Screen name="AddMenuItem" component={AddMenuItemScreen} options={{ title: 'Add Menu Item' }} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={defaultScreenOptions}>
      <Stack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      <Stack.Screen name="Kitchen" component={KitchenScreen} options={{ title: 'Kitchen Display' }} />
      <Stack.Screen name="Delivery" component={DeliveryListScreen} options={{ title: 'Delivery' }} />
      <Stack.Screen name="CreateDeliveryOrder" component={CreateDeliveryOrderScreen} options={{ title: 'New Delivery Order' }} />
      <Stack.Screen name="DailySummary" component={DailySummaryScreen} options={{ title: 'Daily Summary' }} />
      <Stack.Screen name="Reports" component={ReportScreen} options={{ title: 'Sales Reports' }} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Expenses' }} />
      <Stack.Screen name="Employees" component={EmployeeListScreen} options={{ title: 'Employees' }} />
      <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={{ title: 'Employee' }} />
      <Stack.Screen name="AddEmployee" component={AddEmployeeScreen} options={{ title: 'Add Employee' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

// ============================================================
// MAIN TAB NAVIGATOR (kept to 3-4 tabs; the rest live in "More")
// ============================================================

export default function MainNavigator() {
  const { isManager, isCashier } = useAuth();

  // Order-taking staff (WAITER/CASHIER/MANAGER) get the Orders tab
  const showOrders = isCashier || isManager;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Orders':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'Menu':
              iconName = focused ? 'restaurant' : 'restaurant-outline';
              break;
            case 'More':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            default:
              iconName = 'ellipse';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      {showOrders && <Tab.Screen name="Orders" component={OrdersStack} />}
      <Tab.Screen name="Menu" component={MenuStack} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}
