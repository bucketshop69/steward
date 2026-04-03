# Issue #011: Property Tools — get_property_info

## Summary

Implement the `get_property_info` tool that answers guest questions about the property — WiFi, house rules, amenities, nearby places, check-in instructions. The agent calls this when a guest asks about the property.

## What needs to happen

### `src/tools/property.ts`

#### `get_property_info(property_id: string, question: string)`

- Loads property from store
- Returns relevant property fields based on the question context
- The agent (Claude) handles the natural language matching — this tool just provides the raw data
- Returns a structured object:
  ```typescript
  {
    name: string;
    checkInInstructions: string;
    houseRules: string;
    wifiName: string;
    wifiPassword: string;
    amenities: string[];
    nearbyPlaces: string;
    address: string;
  }
  ```

### Tool schema

```typescript
{
  name: "get_property_info",
  description: "Get property details to answer guest questions about WiFi, rules, amenities, check-in, nearby places, etc.",
  input_schema: {
    type: "object",
    properties: {
      property_id: { type: "string", description: "Property ID" },
      question: { type: "string", description: "What the guest is asking about" }
    },
    required: ["property_id"]
  }
}
```

### Note

This tool returns ALL property info and lets Claude pick the relevant parts for the response. Simpler than trying to do keyword matching ourselves.

## Acceptance criteria

- [ ] Tool returns full property info from store
- [ ] Tool schema is defined for Claude tool use
- [ ] Returns meaningful error if property not found

---

## Discovered during build

> This section is maintained by the assignee during implementation. Document decisions, surprises, blockers, and anything the next person needs to know.

_No entries yet — assignee updates this as work progresses._

| Date | Finding | Decision / Action |
|------|---------|-------------------|
| | | |

---

## Branch & prerequisites

**Branch:** `feat/011-property-tools`

**Branch convention:** `feat/<issue-number>-<short-description>`

### Prerequisites for working on this issue

1. **Issue #004 merged** — JSON store
2. **Issue #003 merged** — types

### Assignee checklist (fill before starting)

- [ ] I have read the Action Tools table in `docs/steward.md`
- [ ] Issues #003 and #004 are merged
