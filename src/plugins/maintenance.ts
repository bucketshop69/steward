import type { Plugin } from '../types.js';

const TROUBLESHOOTING: Record<string, string> = {
  ac: 'Try the reset button on the AC unit, or check if the remote needs batteries.',
  heating: 'Check if the thermostat is set correctly and the circuit breaker hasn\'t tripped.',
  plumbing: 'Check if the water shut-off valve under the sink is open.',
  electrical: 'Try resetting the circuit breaker in the electrical panel.',
  wifi: 'Try unplugging the router, wait 30 seconds, and plug it back in.',
  lock: 'Make sure you\'re using the correct code. Try entering it slowly.',
  appliance: 'Check if it\'s plugged in and the outlet is working (try another device in the same outlet).',
};

function getTroubleshooting(issue: string): string | null {
  const lower = issue.toLowerCase();
  for (const [keyword, tip] of Object.entries(TROUBLESHOOTING)) {
    if (lower.includes(keyword)) return tip;
  }
  return null;
}

function categorizeIssue(issue: string): string {
  const lower = issue.toLowerCase();
  if (lower.includes('ac') || lower.includes('air condition') || lower.includes('cooling')) return 'AC/Cooling';
  if (lower.includes('heat') || lower.includes('warm')) return 'Heating';
  if (lower.includes('water') || lower.includes('leak') || lower.includes('plumb') || lower.includes('toilet') || lower.includes('shower')) return 'Plumbing';
  if (lower.includes('electric') || lower.includes('power') || lower.includes('light') || lower.includes('outlet')) return 'Electrical';
  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('network')) return 'WiFi/Internet';
  if (lower.includes('lock') || lower.includes('door') || lower.includes('key')) return 'Lock/Access';
  return 'General';
}

export const maintenancePlugin: Plugin = {
  name: 'maintenance',
  description: 'Report and handle maintenance issues',
  triggers: ['broken', 'not working', 'maintenance', 'repair', 'fix', 'leak', 'ac', 'heating', 'plumbing'],

  async handle(params) {
    const input = params.request ? JSON.parse(params.request) : {};
    const issue = input.issue ?? 'maintenance issue';
    const location = input.location ?? '';
    const severity = input.severity ?? 'minor';

    const category = categorizeIssue(issue);
    const troubleshooting = getTroubleshooting(issue);

    if (troubleshooting) {
      return {
        message: `I see you have a ${category} issue${location ? ` in ${location}` : ''}.\n\n` +
          `Quick fix to try: ${troubleshooting}\n\n` +
          `If that doesn't work, let me know and I'll escalate to the host.`,
      };
    }

    // No troubleshooting available — escalate immediately
    const urgencyEmoji = severity === 'urgent' ? '🚨' : severity === 'major' ? '⚠️' : 'ℹ️';

    return {
      message: `${urgencyEmoji} I've noted the ${category} issue${location ? ` in ${location}` : ''}: "${issue}"\n\n` +
        `Severity: ${severity}\n` +
        `I'll escalate this to the host right away.`,
    };
  },
};
