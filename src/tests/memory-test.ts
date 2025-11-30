import { DatabaseService } from '../services/DatabaseService.js';
import { MemoryService } from '../services/MemoryService.js';
import { TradeLogService } from '../services/TradeLogService.js';
import { Logger } from '../utils/logger.js';

async function testMemorySystem() {
  console.log('\n=== Memory System Test ===\n');

  const db = DatabaseService.getInstance();
  const memoryService = MemoryService.getInstance();
  const tradeLogService = new TradeLogService(db);

  // Test 1: Create a successful trade and verify memory generation
  console.log('Test 1: Automatic memory generation from successful trade');
  const successTradeId = tradeLogService.logTrade({
    traderName: 'Leonardo',
    prompt: 'Test prompt for successful trade',
    action: 'BUY',
    symbol: 'AAPL',
    quantity: 10,
    price: 150.0,
    success: true,
    executionTimeMs: 1500,
    rationale: 'Strong fundamentals and positive earnings outlook',
  });
  console.log(`✓ Logged successful trade #${successTradeId}`);

  // Retrieve memories for Leonardo
  const leonardoMemories = memoryService.getAgentMemories('Leonardo', {
    limit: 5,
  });
  console.log(`✓ Leonardo has ${leonardoMemories.length} memories`);
  if (leonardoMemories.length > 0) {
    const latestMemory = leonardoMemories[0];
    console.log(`  Latest memory: ${latestMemory.content.substring(0, 80)}...`);
    console.log(`  Confidence: ${latestMemory.confidence}`);
    console.log(`  Type: ${latestMemory.memory_type}`);
  }

  // Test 2: Create a failed trade
  console.log('\nTest 2: Automatic memory generation from failed trade');
  const failureTradeId = tradeLogService.logTrade({
    traderName: 'Michelangelo',
    prompt: 'Test prompt for failed trade',
    action: 'SELL',
    symbol: 'TSLA',
    quantity: 5,
    price: 0,
    success: false,
    errorMessage: 'Insufficient shares to sell',
    executionTimeMs: 800,
    rationale: 'Wanted to take profits',
  });
  console.log(`✓ Logged failed trade #${failureTradeId}`);

  const michelangeloMemories = memoryService.getAgentMemories('Michelangelo', {
    limit: 5,
  });
  console.log(`✓ Michelangelo has ${michelangeloMemories.length} memories`);
  if (michelangeloMemories.length > 0) {
    const latestMemory = michelangeloMemories[0];
    console.log(`  Latest memory: ${latestMemory.content.substring(0, 80)}...`);
    console.log(`  Confidence: ${latestMemory.confidence}`);
    console.log(`  Type: ${latestMemory.memory_type}`);
  }

  // Test 3: Manually record a lesson
  console.log('\nTest 3: Manually storing a lesson');
  const manualMemoryId = memoryService.storeMemory(
    'Raphael',
    'manual_insight',
    'I noticed that tech stocks tend to dip on Mondays. Consider buying on Monday mornings.',
    {
      pattern: 'weekly_trend',
      sector: 'technology',
    },
    0.8,
    ['tech', 'timing', 'pattern']
  );
  console.log(`✓ Stored manual memory #${manualMemoryId} for Raphael`);

  // Test 4: Memory filtering
  console.log('\nTest 4: Filtering memories by type');
  const successMemories = memoryService.getAgentMemories('Leonardo', {
    memoryType: 'successful_trade',
    minConfidence: 0.5,
  });
  console.log(
    `✓ Leonardo has ${successMemories.length} successful trade memories with confidence >= 0.5`
  );

  // Test 5: Create multiple trades for collective insight generation
  console.log('\nTest 5: Setting up data for collective insights');
  const agents = ['Leonardo', 'Michelangelo', 'Raphael', 'Donatello'];

  // Multiple agents buy the same stock
  for (const agent of agents.slice(0, 3)) {
    tradeLogService.logTrade({
      traderName: agent,
      action: 'BUY',
      symbol: 'NVDA',
      quantity: 5,
      price: 450.0 + Math.random() * 10,
      success: true,
      executionTimeMs: 1200,
      rationale: `${agent}'s analysis shows NVDA is a good buy`,
    });
  }
  console.log('✓ Created trades for multiple agents on NVDA');

  // Generate collective insights
  console.log('\nTest 6: Generating collective insights');
  const insightsCreated = await memoryService.generateCollectiveInsights({
    minAgents: 2,
    minConfidence: 0.5,
    lookbackDays: 1,
  });
  console.log(`✓ Generated ${insightsCreated} collective insights`);

  // Retrieve collective insights
  const collectiveInsights = memoryService.getCollectiveInsights({
    minConfidence: 0.5,
    limit: 10,
  });
  console.log(`✓ Retrieved ${collectiveInsights.length} collective insights`);
  if (collectiveInsights.length > 0) {
    console.log('\n  Sample insights:');
    collectiveInsights.slice(0, 3).forEach((insight, idx) => {
      console.log(`  ${idx + 1}. [${insight.insight_type}] ${insight.content}`);
      console.log(
        `     Confidence: ${insight.confidence.toFixed(2)}, Evidence: ${insight.evidence_count}, Agents: ${insight.contributing_agents.length}`
      );
    });
  }

  // Test 7: Memory statistics
  console.log('\nTest 7: Memory statistics');
  for (const agent of ['Leonardo', 'Michelangelo', 'Raphael']) {
    const stats = memoryService.getMemoryStats(agent);
    console.log(`\n${agent}:`);
    console.log(`  Total memories: ${stats.totalMemories}`);
    console.log(`  Avg confidence: ${stats.avgConfidence.toFixed(2)}`);
    console.log(`  Memory types: ${JSON.stringify(stats.memoryTypeBreakdown)}`);
  }

  // Test 8: Update memory confidence based on usage
  console.log('\nTest 8: Memory confidence updates');
  if (leonardoMemories.length > 0) {
    const memoryId = leonardoMemories[0].id;
    const oldConfidence = leonardoMemories[0].confidence;
    memoryService.updateMemoryConfidence(memoryId, true, 0.1); // Successful usage
    const updatedMemory = db.getAgentMemory(memoryId);
    console.log(
      `✓ Updated memory #${memoryId} confidence: ${oldConfidence.toFixed(2)} → ${updatedMemory?.confidence.toFixed(2)}`
    );
  }

  console.log('\n=== All Memory Tests Complete ===\n');
}

// Run the test
testMemorySystem()
  .then(() => {
    console.log('Memory system test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Memory system test failed:', error);
    process.exit(1);
  });
