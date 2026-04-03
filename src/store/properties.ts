import fs from 'node:fs';
import path from 'node:path';
import type { Property } from '../types.js';

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'properties.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAll(): Property[] {
  if (!fs.existsSync(FILE)) return [];
  const raw = fs.readFileSync(FILE, 'utf-8');
  return JSON.parse(raw) as Property[];
}

function writeAll(properties: Property[]): void {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(properties, null, 2));
}

export function listProperties(): Property[] {
  return readAll();
}

export function getProperty(id: string): Property | undefined {
  return readAll().find((p) => p.id === id);
}

export function getPropertyByGroupId(groupId: number): Property | undefined {
  return readAll().find((p) => p.telegramGroupId === groupId);
}

export function addProperty(property: Property): void {
  const all = readAll();
  if (all.some((p) => p.id === property.id)) {
    throw new Error(`Property with id "${property.id}" already exists`);
  }
  all.push(property);
  writeAll(all);
}

export function updateProperty(id: string, updates: Partial<Property>): void {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Property "${id}" not found`);
  all[idx] = { ...all[idx], ...updates };
  writeAll(all);
}
