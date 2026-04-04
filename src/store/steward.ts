import fs from 'node:fs';
import path from 'node:path';
import type { StewardConfig } from '../types.js';

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'steward.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readConfig(): StewardConfig {
  if (!fs.existsSync(FILE)) {
    return { hostTelegramId: 0, groups: [] };
  }
  return JSON.parse(fs.readFileSync(FILE, 'utf-8')) as StewardConfig;
}

export function writeConfig(config: StewardConfig): void {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(config, null, 2));
}
