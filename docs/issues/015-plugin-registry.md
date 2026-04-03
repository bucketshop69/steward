# Issue #015: Plugin Registry & Interface

## Summary

Implement the plugin system — a registry that loads all service plugins (food, cleaning, taxi, tickets, maintenance) and exposes them as tools to the Claude agent. Every plugin implements the same `Plugin` interface.

## What needs to happen

### `src/plugins/registry.ts`

1. **Plugin registration** — load all plugins on startup:
   ```typescript
   const plugins: Plugin[] = [
     foodPlugin,
     cleaningPlugin,
     taxiPlugin,
     ticketsPlugin,
     maintenancePlugin,
   ];
   ```

2. **Plugin lookup** — find the right plugin for a request:
   - Each plugin has `triggers: string[]` — keywords that match it
   - The agent (Claude) decides which plugin to call via tool use, so triggers are for documentation/validation, not routing

3. **Plugin execution** — run a plugin with standard params:
   ```typescript
   async function executePlugin(
     pluginName: string,
     params: PluginParams
   ): Promise<PluginResult>
   ```

4. **Tool schema generation** — generate Claude tool schemas from plugin definitions:
   ```typescript
   function getPluginToolSchemas(): Tool[]
   ```
   Each plugin becomes a tool the agent can call.

5. **Transaction logging** — after a plugin returns a result with a transaction, log it to the store

### Plugin interface (from types.ts, issue #003)

```typescript
interface Plugin {
  name: string;
  description: string;
  triggers: string[];
  handle(params: PluginParams): Promise<PluginResult>;
}
```

## Acceptance criteria

- [ ] All plugins are registered and discoverable
- [ ] `executePlugin` runs the correct plugin and returns results
- [ ] Tool schemas are generated from plugin definitions
- [ ] Transactions are automatically logged after plugin execution
- [ ] Mock mode flag is passed through to plugins correctly

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/015-plugin-registry`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #003 merged** — Plugin, PluginParams, PluginResult types
2. **Issue #004 merged** — transaction logging
3. **Read "Plugin System"** section of `docs/steward.md`

### Assignee checklist (fill before starting)

- [ ] I have read the "Plugin System" section of `docs/steward.md`
- [ ] Issues #003 and #004 are merged
- [ ] I understand the Plugin interface and how plugins become agent tools
