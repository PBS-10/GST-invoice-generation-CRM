import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type RootTabParamList = {
  Home: undefined;
  Invoices: undefined;
  Products: undefined;
  Customers: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  ProductForm: { productId?: string };
  CustomerForm: { customerId?: string };
  InvoiceCreate: undefined;
  InvoicePreview: undefined;
  InvoiceDetail: { invoiceId: string };
  OpenCarts: undefined;
  ShopProfile: undefined;
  SignIn: undefined;
  CreateAccount: undefined;
  BackupDevices: undefined;
};

/** Navigation prop for screens inside the tab bar that also push stack screens. */
export type TabScreenNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type StackNavigation = NativeStackNavigationProp<RootStackParamList>;
