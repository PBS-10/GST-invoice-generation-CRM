import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../components/common/Icon';
import { BackupDevicesScreen } from '../features/account/BackupDevicesScreen';
import { CreateAccountScreen } from '../features/account/CreateAccountScreen';
import { SignInScreen } from '../features/account/SignInScreen';
import { CustomerFormScreen } from '../features/customers/CustomerFormScreen';
import { CustomerListScreen } from '../features/customers/CustomerListScreen';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { InvoiceCreateScreen } from '../features/invoices/InvoiceCreateScreen';
import { InvoiceDetailScreen } from '../features/invoices/InvoiceDetailScreen';
import { InvoiceListScreen } from '../features/invoices/InvoiceListScreen';
import { InvoicePreviewScreen } from '../features/invoices/InvoicePreviewScreen';
import { OpenCartsScreen } from '../features/invoices/OpenCartsScreen';
import { ProductFormScreen } from '../features/products/ProductFormScreen';
import { ProductListScreen } from '../features/products/ProductListScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { VendorSettingsScreen } from '../features/vendors/VendorSettingsScreen';
import { useTheme } from '../theme/ThemeProvider';
import { haptics } from '../utils/haptics';
import type { RootStackParamList, RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const tabIcons: Record<keyof RootTabParamList, { idle: IconName; active: IconName }> = {
  Home: { idle: 'home-outline', active: 'home' },
  Invoices: { idle: 'receipt-outline', active: 'receipt' },
  Products: { idle: 'cube-outline', active: 'cube' },
  Customers: { idle: 'people-outline', active: 'people' },
  Settings: { idle: 'settings-outline', active: 'settings' },
};

function Tabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenListeners={{ tabPress: () => haptics.selection() }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.1 },
        tabBarAllowFontScaling: false,
        // Each item needs ~52pt (icon 28 + label 14 + item padding); the default
        // bar is shorter and clips labels where there is no bottom inset.
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          elevation: 0,
        },
        sceneStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ focused, color }) => (
          <Icon
            name={focused ? tabIcons[route.name].active : tabIcons[route.name].idle}
            size={22}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Invoices" component={InvoiceListScreen} />
      <Tab.Screen name="Products" component={ProductListScreen} />
      <Tab.Screen name="Customers" component={CustomerListScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { colors } = useTheme();
  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.background },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: { fontSize: 17, fontWeight: '600' as const, color: colors.textPrimary },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: 'minimal' as const,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors],
  );

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProductForm"
        component={ProductFormScreen}
        options={({ route }) => ({ title: route.params.productId ? 'Edit product' : 'New product' })}
      />
      <Stack.Screen
        name="CustomerForm"
        component={CustomerFormScreen}
        options={({ route }) => ({
          title: route.params.customerId ? 'Edit customer' : 'New customer',
        })}
      />
      <Stack.Screen
        name="InvoiceCreate"
        component={InvoiceCreateScreen}
        options={{ title: 'New invoice' }}
      />
      <Stack.Screen
        name="InvoicePreview"
        component={InvoicePreviewScreen}
        options={{ title: 'Review Invoice' }}
      />
      <Stack.Screen
        name="InvoiceDetail"
        component={InvoiceDetailScreen}
        options={{ title: 'Invoice' }}
      />
      <Stack.Screen
        name="OpenCarts"
        component={OpenCartsScreen}
        options={{ title: 'Parked bills' }}
      />
      <Stack.Screen
        name="ShopProfile"
        component={VendorSettingsScreen}
        options={{ title: 'Shop profile' }}
      />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Sign in' }} />
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountScreen}
        options={{ title: 'Create account' }}
      />
      <Stack.Screen
        name="BackupDevices"
        component={BackupDevicesScreen}
        options={{ title: 'Backup & devices' }}
      />
    </Stack.Navigator>
  );
}
