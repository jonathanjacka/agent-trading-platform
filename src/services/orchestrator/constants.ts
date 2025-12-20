/**
 * Trading Orchestrator Constants
 * Daily prompts and configuration for each trading agent
 */

/**
 * Default trading prompts for each agent based on their strategy
 */
export const DAILY_PROMPTS: Record<string, string> = {
  leonardo: `It's time for your daily trading session. 

1. First, review your current portfolio to understand your positions
2. Check your past memories and any collective lessons from other agents
3. Research current market conditions for stocks you hold or are interested in
4. Based on your value investing strategy, decide whether to:
   - BUY: If you find quality companies trading below intrinsic value
   - SELL: If any holdings no longer meet your criteria
   - HOLD: If current positions align with your long-term thesis

Make thoughtful decisions aligned with your patient, value-oriented approach.`,

  michelangelo: `It's time for your daily trading session.

1. First, review your current portfolio positions
2. Check your memories and collective insights from other traders
3. Research the latest in disruptive technology and innovation trends
4. Based on your aggressive tech-focused strategy, decide whether to:
   - BUY: If you spot emerging tech opportunities with high growth potential
   - SELL: If any holdings have lost their innovative edge
   - HOLD: If positions still align with disruptive innovation thesis

Be bold but informed. Look for the next big technological breakthrough.`,

  raphael: `It's time for your daily trading session.

1. Review your current portfolio and cash position
2. Check your memories and learn from collective agent insights
3. Research macro conditions: economic data, geopolitical events, market sentiment
4. Based on your contrarian macro strategy, decide whether to:
   - BUY: If you see significant mispricings against market sentiment
   - SELL: If macro thesis has played out or changed
   - HOLD: If waiting for better entry points

Take bold contrarian positions when your analysis reveals market imbalances.`,

  donatello: `It's time for your daily trading session.

1. Review your portfolio allocation and current balance
2. Check your memories and collective insights
3. Analyze macro indicators: interest rates, inflation, sector performance
4. Based on your risk parity approach, decide whether to:
   - BUY: To rebalance or add diversified positions
   - SELL: To reduce concentration or rebalance
   - HOLD: If allocation matches your target balance

Focus on systematic diversification and risk management across market conditions.`,
};

/**
 * Default delay between agent executions (90 seconds)
 */
export const DEFAULT_DELAY_BETWEEN_AGENTS_MS = 90_000;
