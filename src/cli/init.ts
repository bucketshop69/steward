import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createOWSWallet } from '../wallet.js';
import { writeConfig, readConfig } from '../store/steward.js';

const ENV_PATH = path.resolve('.env');
const DATA_DIR = path.resolve('data');

function createPrompt(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  return new Promise((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

function validateBotToken(token: string): boolean {
  return /^\d+:[A-Za-z0-9_-]+$/.test(token);
}

function validateApiKey(key: string): boolean {
  return key.startsWith('sk-');
}

function validatePositiveNumber(value: string): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0;
}

export async function runInit(): Promise<void> {
  console.log('\n🏗️  Steward Setup\n');

  if (fs.existsSync(ENV_PATH)) {
    const rl = createPrompt();
    const overwrite = await ask(rl, 'Config (.env) already exists. Overwrite? (y/N)', 'N');
    rl.close();
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      return;
    }
  }

  const rl = createPrompt();

  // Telegram Bot Token
  let botToken = '';
  while (!botToken) {
    botToken = await ask(rl, 'Telegram Bot Token (from @BotFather)');
    if (!validateBotToken(botToken)) {
      console.log('  Invalid format. Expected: <number>:<alphanumeric>');
      botToken = '';
    }
  }

  // Agent API Key
  let apiKey = '';
  while (!apiKey) {
    apiKey = await ask(rl, 'Agent API Key (LLM provider)');
    if (!apiKey) {
      console.log('  API key is required.');
      console.log('  Examples:');
      console.log('    MiniMax:   sk-api-... (model: MiniMax-M2.7, endpoint: api.minimax.io)');
      console.log('    Anthropic: sk-ant-... (model: claude-sonnet-4-20250514)');
      console.log('    OpenAI:    sk-...     (any Anthropic-compatible endpoint)');
      apiKey = '';
    }
  }

  // Host Telegram ID
  let hostTelegramId = 0;
  while (hostTelegramId <= 0) {
    const val = await ask(rl, 'Your Telegram user ID (send /start to @userinfobot to get it)');
    hostTelegramId = Number(val);
    if (isNaN(hostTelegramId) || hostTelegramId <= 0) {
      console.log('  Must be a valid number.');
      hostTelegramId = 0;
    }
  }

  // OWS Wallet Name
  const walletName = await ask(rl, 'OWS Wallet Name', 'steward-main');

  // Helius RPC URL
  const rpcUrl = await ask(rl, 'Helius RPC URL (optional, press enter to skip)');

  rl.close();

  // Write .env
  const envContent = [
    '# Telegram',
    `TELEGRAM_BOT_TOKEN=${botToken}`,
    '',
    '# AI (Anthropic-compatible endpoint — MiniMax, Anthropic, OpenAI, etc.)',
    `AGENT_API_KEY=${apiKey}`,
    '',
    '# Solana',
    `HELIUS_RPC_URL=${rpcUrl}`,
    '',
    '# OWS',
    `OWS_WALLET_NAME=${walletName}`,
    '',
  ].join('\n');

  fs.writeFileSync(ENV_PATH, envContent);

  // Create data directory and steward.json
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Initialize steward.json with host ID (groups added later via `steward property add`)
  const existing = readConfig();
  if (existing.hostTelegramId === 0) {
    writeConfig({ hostTelegramId, groups: [] });
  } else {
    writeConfig({ ...existing, hostTelegramId });
  }

  // Create OWS wallet silently
  console.log('\n🔑 Setting up OWS wallet...');
  try {
    const solanaAddress = await createOWSWallet(walletName);
    console.log(`  Wallet "${walletName}" ready`);
    console.log(`  Solana address: ${solanaAddress}`);
    console.log('  Fund this address with USDC to enable service payments.');
  } catch (err) {
    console.log(`  ⚠️  Could not create wallet: ${(err as Error).message}`);
    console.log('  Make sure OWS CLI is installed: https://docs.openwallet.sh');
    console.log('  You can create the wallet later: ows wallet create --name ' + walletName);
  }

  console.log('\n✅ Steward configured!\n');
  console.log('Next steps:');
  console.log('  steward property add    — add your first property');
  console.log('  steward start           — start the agent\n');
}
