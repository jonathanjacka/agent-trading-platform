# Testing Guide - Agent Trading Platform

## Overview

The testing suite ensures that all core functionality remains stable as features are added. Tests are organized into three layers:

1. **Unit Tests** - Individual tool behavior (mocked dependencies)
2. **Integration Tests** - Service layer with real database operations
3. **Workflow Tests** - Agent behavior and tool orchestration

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with interactive UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Test Structure

### 1. Tool Unit Tests (`src/agents/TraderAgent.test.ts`)

**Purpose**: Verify each agent tool works correctly in isolation

**What's Tested**:

- ✅ `getPortfolio` - Returns formatted portfolio data
- ✅ `buyStock` - Executes buy orders and handles failures
- ✅ `sellStock` - Executes sell orders and handles failures
- ✅ Agent info - Returns correct name, strategy, model

**Key Pattern**: Mock all external dependencies

```typescript
mockAccountService.buyStock = vi.fn().mockResolvedValue({
  success: true,
  message: 'Successfully bought 10 shares',
});
```

**Why This Matters**: Catches regressions in tool logic without needing a database or API calls.

---

### 2. Database Integration Tests (`src/services/Database.test.ts`)

**Purpose**: Verify database operations work correctly

**What's Tested**:

- ✅ Account CRUD operations
- ✅ Holdings management (upsert, delete, query)
- ✅ Transaction logging
- ✅ Trade log filtering (by symbol, success, date)
- ✅ Agent memory operations (create, filter, update, cleanup)
- ✅ Collective insights (create, filter, exclude agents)
- ✅ Memory auto-generation from trades
- ✅ Collective insight generation across agents

**Key Pattern**: Use in-memory SQLite database

```typescript
beforeEach(() => {
  // @ts-ignore - Reset singleton for testing
  DatabaseService.instance = undefined;
  db = DatabaseService.getInstance(':memory:');
});
```

**Why This Matters**:

- Tests database abstraction layer without affecting production data
- Ensures schema changes don't break functionality
- Validates memory system integration
- In-memory DB means fast tests (<100ms total)

---

### 3. Agent Workflow Tests (`src/agents/AgentWorkflow.test.ts`)

**Purpose**: Verify agents can complete full trading workflows

**What's Tested**:

- ✅ All 7 tools are available to agents
- ✅ Tool schemas have correct parameters
- ✅ Portfolio check workflow
- ✅ Buy workflow with portfolio snapshot
- ✅ Sell workflow with portfolio snapshot
- ✅ Error handling (insufficient funds, insufficient shares)
- ✅ Multiple agent coordination
- ✅ Agent identity persistence

**Key Pattern**: Mock external services (API calls)

```typescript
vi.mock('../services/MarketDataService.js');
vi.mock('../services/BraveSearchService.js');
```

**Why This Matters**:

- Ensures agents can actually execute trades end-to-end
- Verifies tool orchestration works
- Avoids real API costs during testing
- Fast execution (no network calls)

---

## Test Coverage Summary

```
📊 Current Coverage:
- Unit Tests:       7 tests (TraderAgent tools)
- Integration Tests: 23 tests (Database + Memory services)
- Workflow Tests:   12 tests (Agent behavior)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:              42 tests ✅ All passing
```

---

## Adding New Tests

### When to Add Unit Tests

- ✅ Adding a new agent tool
- ✅ Modifying tool parameters or behavior
- ✅ Adding new service methods

**Example**:

```typescript
it('should execute new tool successfully', async () => {
  // Arrange
  mockService.newMethod = vi.fn().mockResolvedValue({ success: true });

  // Act
  const tools = (traderAgent as any).getTools();
  const result = await tools.newTool.execute({ param: 'value' });

  // Assert
  expect(mockService.newMethod).toHaveBeenCalledWith('value');
  expect(result.success).toBe(true);
});
```

### When to Add Integration Tests

- ✅ Adding new database tables
- ✅ Adding new database operations
- ✅ Modifying schema or queries

**Example**:

```typescript
it('should create and retrieve new entity', () => {
  // Act
  const id = db.createNewEntity({ name: 'Test', value: 100 });
  const entity = db.getNewEntity(id);

  // Assert
  expect(entity).toBeDefined();
  expect(entity?.name).toBe('Test');
});
```

### When to Add Workflow Tests

- ✅ Adding new agent workflows
- ✅ Testing multi-tool interactions
- ✅ Verifying error recovery paths

**Example**:

```typescript
it('should handle new workflow', async () => {
  // Arrange
  mockService.setup();

  // Act
  await agent.executeNewWorkflow();

  // Assert
  expect(mockService.step1).toHaveBeenCalled();
  expect(mockService.step2).toHaveBeenCalled();
});
```

---

## Best Practices

### ✅ Do:

- Use descriptive test names: `should do X when Y happens`
- Test both success and failure cases
- Mock external dependencies (APIs, file system)
- Use in-memory database for speed
- Keep tests independent (no shared state)
- Reset singletons between tests

### ❌ Don't:

- Test implementation details (test behavior, not code structure)
- Make real API calls (expensive and slow)
- Share state between tests
- Write tests that depend on test order
- Leave console.log statements in tests

---

## Debugging Test Failures

### Singleton Issues

If tests fail with "UNIQUE constraint failed", the singleton isn't being reset:

```typescript
beforeEach(() => {
  // @ts-ignore
  DatabaseService.instance = undefined;
  db = DatabaseService.getInstance(':memory:');
});

afterEach(() => {
  db.close();
  // @ts-ignore
  DatabaseService.instance = undefined;
});
```

### Timing Issues

If tests fail intermittently, SQLite timestamps might be identical:

```typescript
// Bad: All created at same millisecond
createItem('A');
createItem('B');
createItem('C');

// Good: Test behavior, not timestamp order
const items = getAllItems(2);
expect(items).toHaveLength(2);
expect(items[0]).toHaveProperty('name');
```

### Floating Point Precision

Use `toBeCloseTo()` for decimal comparisons:

```typescript
// Bad: May fail with 0.39999999999
expect(confidence).toBe(0.4);

// Good: Checks within 2 decimal places
expect(confidence).toBeCloseTo(0.4, 2);
```

---

## CI/CD Integration

Tests run automatically before builds:

```json
{
  "scripts": {
    "prebuild": "npm test && npm run clean",
    "build": "tsc"
  }
}
```

To skip tests during development:

```bash
npm run build --ignore-scripts
```

---

## Coverage Goals

- **Unit Tests**: 80%+ coverage of tool logic
- **Integration Tests**: 100% of database operations
- **Workflow Tests**: All critical user paths

Run coverage to see gaps:

```bash
npm run test:coverage
open coverage/index.html  # View detailed report
```

---

## Quick Reference

| Command                          | Purpose                    |
| -------------------------------- | -------------------------- |
| `npm test`                       | Run all tests once         |
| `npm run test:watch`             | Run in watch mode          |
| `npm run test:ui`                | Interactive UI             |
| `npm run test:coverage`          | Generate coverage report   |
| `npm run test -- src/agents`     | Run specific test file     |
| `npm run test -- -t "tool name"` | Run tests matching pattern |

---

## Future Test Additions

**Recommended Next Steps**:

1. Add API endpoint contract tests (validate response shapes)
2. Add performance tests (trade execution speed)
3. Add stress tests (concurrent agent trades)
4. Add E2E tests (full trading cycle with real-ish market data)

---

## Questions?

Test failures? Check:

1. Are singletons being reset? (`DatabaseService.instance = undefined`)
2. Are mocks properly configured? (`.mockResolvedValue()`)
3. Is the database in-memory? (`':memory:'`)
4. Are tests truly independent? (no shared state)

For more help, refer to [Vitest documentation](https://vitest.dev/).
