# Issue #016: Food Delivery Plugin (Mocked)

## Summary

Implement the food delivery plugin. In mock mode, it simulates ordering food — estimates cost based on the request, generates a fake transaction, and returns a confirmation message. Post-hackathon, the internals swap to a real food delivery API.

## What needs to happen

### `src/plugins/food.ts`

```typescript
const foodPlugin: Plugin = {
  name: "food-delivery",
  description: "Order food delivery from local restaurants",
  triggers: ["food", "hungry", "dinner", "lunch", "breakfast", "order food", "eat", "pizza", "restaurant"],
  
  async handle(params: PluginParams): Promise<PluginResult> {
    // 1. Parse request for: cuisine, people count, dietary restrictions
    // 2. Estimate cost ($15-80 based on people count and cuisine type)
    // 3. Check guest preferences for dietary restrictions
    // 4. Generate mock transaction
    // 5. Return confirmation
  }
}
```

### Cost estimation (mock)

- Base: $15 per person
- Adjustments: premium cuisines (+$5), delivery fee ($5 flat)
- Example: "Thai food for 2, no peanuts" → $35 + $5 delivery = $40

### Mock transaction

```typescript
tx = `mock_food_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
```

### Tool schema for agent

```typescript
{
  name: "order_food",
  description: "Order food delivery. Respects guest dietary preferences automatically.",
  input_schema: {
    type: "object",
    properties: {
      cuisine: { type: "string", description: "Type of food (e.g., Thai, Pizza, Sushi)" },
      people: { type: "number", description: "Number of people to feed" },
      dietary: { type: "string", description: "Dietary restrictions (e.g., vegetarian, no nuts)" },
      budget: { type: "number", description: "Max budget in USDC" },
      special_requests: { type: "string", description: "Any special requests" }
    },
    required: ["cuisine", "people"]
  }
}
```

## Acceptance criteria

- [ ] Plugin implements the Plugin interface
- [ ] Cost estimation is reasonable for the request
- [ ] Guest dietary preferences from booking are considered
- [ ] Mock transactions have unique IDs
- [ ] Response message is friendly and informative (what was ordered, cost, ETA)

---

## Discovered during build

_No entries yet._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/016-plugin-food`

### Prerequisites for working on this issue

1. **Issue #015 merged** — plugin registry
2. **Issue #003 merged** — types

### Assignee checklist (fill before starting)

- [ ] I have read the "Plugin System" and "Mock vs Real" sections of `docs/steward.md`
- [ ] Issue #015 (plugin registry) is merged
