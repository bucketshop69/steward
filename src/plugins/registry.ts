// Plugin registry — implement in issue #015

import type { Plugin, PluginParams, PluginResult } from '../types.js';

const plugins: Plugin[] = [];

export function registerPlugin(plugin: Plugin): void {
  plugins.push(plugin);
}

export function getPlugins(): Plugin[] {
  return plugins;
}

export async function executePlugin(_name: string, _params: PluginParams): Promise<PluginResult> {
  // TODO: implement in issue #015
  return { message: 'Plugin registry not yet implemented. See issue #015.' };
}
