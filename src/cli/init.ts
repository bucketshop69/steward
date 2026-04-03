import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

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
  return key.startsWith('sk-ant-');
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

  // Anthropic API Key
  let apiKey = '';
  while (!apiKey) {
    apiKey = await ask(rl, 'Anthropic API Key');
    if (!validateApiKey(apiKey)) {
      console.log('  Invalid format. Expected: sk-ant-...');
      apiKey = '';
    }
  }

  // OWS Wallet Name
  const walletName = await ask(rl, 'OWS Wallet Name', 'steward-main');

  // Solana RPC URL
  const rpcUrl = await ask(rl, 'Solana RPC URL (optional, press enter to skip)');

  // Cluster
  const cluster = await ask(rl, 'Cluster', 'devnet');

  // Daily Budget
  let dailyBudget = '';
  while (!dailyBudget) {
    dailyBudget = await ask(rl, 'Default Daily Budget (USDC)', '200');
    if (!validatePositiveNumber(dailyBudget)) {
      console.log('  Must be a positive number.');
      dailyBudget = '';
    }
  }

  // Per-Transaction Limit
  let perTxLimit = '';
  while (!perTxLimit) {
    perTxLimit = await ask(rl, 'Default Per-Transaction Limit (USDC)', '100');
    if (!validatePositiveNumber(perTxLimit)) {
      console.log('  Must be a positive number.');
      perTxLimit = '';
    }
  }

  rl.close();

  // Write .env
  const envContent = [
    '# Telegram',
    `TELEGRAM_BOT_TOKEN=${botToken}`,
    '',
    '# AI',
    `ANTHROPIC_API_KEY=${apiKey}`,
    '',
    '# OWS',
    `OWS_WALLET_NAME=${walletName}`,
    '',
    '# Solana',
    `SOLANA_RPC_URL=${rpcUrl}`,
    `CLUSTER=${cluster}`,
    '',
    '# Defaults',
    `DAILY_BUDGET=${dailyBudget}`,
    `PER_TX_LIMIT=${perTxLimit}`,
    '',
  ].join('\n');

  fs.writeFileSync(ENV_PATH, envContent);

  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('\n✅ Steward configured!\n');
  console.log('Next steps:');
  console.log('  steward property add    — add your first property');
  console.log('  steward start --mock    — start in demo mode\n');
}
