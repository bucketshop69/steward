import fs from 'node:fs';
import path from 'node:path';
import type { StewardConfig } from '../types.js';

const DATA_DIR = path.resolve('data');

// Allow tests to override the config file via STEWARD_CONFIG env var
let _configFile: string | null = null;

function getConfigFile(): string {
  if (_configFile) return _configFile;
  return path.join(DATA_DIR, process.env['STEWARD_CONFIG'] ?? 'steward.json');
}

/** Override the config file path (for tests). */
export function setConfigFile(filePath: string): void {
  _configFile = filePath;
}

/** Reset to default config file (for tests). */
export function resetConfigFile(): void {
  _configFile = null;
}

function ensureDir(): void {
  const dir = path.dirname(getConfigFile());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readConfig(): StewardConfig {
  const file = getConfigFile();
  if (!fs.existsSync(file)) {
    return { hostTelegramId: 0, groups: [] };
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as StewardConfig;
}

export function writeConfig(config: StewardConfig): void {
  ensureDir();
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2));
}
