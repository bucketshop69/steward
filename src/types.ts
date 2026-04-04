// Core data types

export interface StewardConfig {
  hostTelegramId: number;
  groups: Group[];
}

export interface Group {
  telegramGroupId: number;
  property: Property;
  bookings: Booking[];
}

export interface Property {
  name: string;
  address: string;
  checkInInstructions: string;
  houseRules: string;
  wifiName: string;
  wifiPassword: string;
  amenities: string[];
  nearbyPlaces: string;
}

export interface Booking {
  id: string;
  guestName: string;
  guestTelegramId?: number;
  guestTelegramUsername?: string;
  checkIn: string;
  checkOut: string;
  preferences?: string;
  status: 'pending' | 'active' | 'checked_out';
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
}

export interface PluginResult {
  message: string;
}

// Tool result types

export interface UserIdentity {
  role: 'guest' | 'host' | 'unknown';
  name?: string;
  booking?: Booking;
}

// Wallet types

export interface WalletService {
  getBalance(): Promise<number>;
}
