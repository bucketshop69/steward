// Core data types — see docs/steward.md for full spec

export interface Property {
  id: string;
  name: string;
  address: string;
  hostTelegramId: number;
  telegramGroupId?: number;
  checkInInstructions: string;
  houseRules: string;
  wifiName: string;
  wifiPassword: string;
  amenities: string[];
  nearbyPlaces: string;
  dailyBudget: number;
  perTransactionLimit: number;
}

export interface Booking {
  id: string;
  propertyId: string;
  guestName: string;
  guestTelegramId?: number;
  guestTelegramUsername?: string;
  telegramGroupId?: number;
  checkIn: string;
  checkOut: string;
  preferences?: string;
  status: 'pending' | 'active' | 'checked_out';
  totalSpent: number;
}

export interface Transaction {
  id: string;
  propertyId: string;
  bookingId: string;
  plugin: string;
  amount: number;
  description: string;
  tx: string;
  timestamp: string;
}

export interface GroupMapping {
  telegramGroupId: number;
  propertyId: string;
  bookingId: string;
}

// Plugin types

export interface Plugin {
  name: string;
  description: string;
  triggers: string[];
  handle(params: PluginParams): Promise<PluginResult>;
}

export interface PluginParams {
  guest: { name: string; telegramId: number; preferences?: string };
  property: Property;
  request: string;
  wallet: WalletService;
  mock: boolean;
}

export interface PluginResult {
  message: string;
  transaction?: {
    amount: number;
    recipient: string;
    description: string;
    tx?: string;
  };
}

// Tool result types

export interface UserIdentity {
  role: 'guest' | 'host' | 'unknown';
  name?: string;
  booking?: Booking;
}

export interface BudgetCheck {
  allowed: boolean;
  remaining: number;
  dailyBudget: number;
  spentToday: number;
  reason?: string;
}

// Wallet types

export interface WalletService {
  getBalance(): Promise<number>;
  payX402(params: {
    amount: number;
    currency: string;
    recipient: string;
    description: string;
  }): Promise<{ tx: string }>;
}
