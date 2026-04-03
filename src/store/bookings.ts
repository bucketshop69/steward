import fs from 'node:fs';
import path from 'node:path';
import type { Booking, GroupMapping } from '../types.js';

const DATA_DIR = path.resolve('data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const MAPPINGS_FILE = path.join(DATA_DIR, 'group-mappings.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readBookings(): Booking[] {
  if (!fs.existsSync(BOOKINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8')) as Booking[];
}

function writeBookings(bookings: Booking[]): void {
  ensureDir();
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

function readMappings(): GroupMapping[] {
  if (!fs.existsSync(MAPPINGS_FILE)) return [];
  return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf-8')) as GroupMapping[];
}

function writeMappings(mappings: GroupMapping[]): void {
  ensureDir();
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
}

export function listBookings(propertyId?: string): Booking[] {
  const all = readBookings();
  if (!propertyId) return all;
  return all.filter((b) => b.propertyId === propertyId);
}

export function getBooking(id: string): Booking | undefined {
  return readBookings().find((b) => b.id === id);
}

export function getActiveBooking(propertyId: string): Booking | undefined {
  return readBookings().find((b) => b.propertyId === propertyId && b.status === 'active');
}

export function getBookingByGroupId(groupId: number): Booking | undefined {
  const mapping = readMappings().find((m) => m.telegramGroupId === groupId);
  if (!mapping) return undefined;
  return getBooking(mapping.bookingId);
}

export function addBooking(booking: Booking): void {
  const all = readBookings();
  if (all.some((b) => b.id === booking.id)) {
    throw new Error(`Booking with id "${booking.id}" already exists`);
  }
  all.push(booking);
  writeBookings(all);
}

export function updateBooking(id: string, updates: Partial<Booking>): void {
  const all = readBookings();
  const idx = all.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error(`Booking "${id}" not found`);
  all[idx] = { ...all[idx], ...updates };
  writeBookings(all);
}

export function linkGuest(bookingId: string, telegramId: number): void {
  updateBooking(bookingId, {
    guestTelegramId: telegramId,
    status: 'active',
  });
}

export function addGroupMapping(mapping: GroupMapping): void {
  const all = readMappings();
  const existing = all.findIndex((m) => m.telegramGroupId === mapping.telegramGroupId);
  if (existing !== -1) {
    all[existing] = mapping;
  } else {
    all.push(mapping);
  }
  writeMappings(all);
}

export function getGroupMapping(groupId: number): GroupMapping | undefined {
  return readMappings().find((m) => m.telegramGroupId === groupId);
}
