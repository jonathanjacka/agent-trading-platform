import 'dotenv/config';
import { MarketDataService } from './services/MarketDataService';
import { Logger } from './utils/logger.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTests() {
  const apiKey = process.env.POLY_API_KEY;
  if (!apiKey) {
    throw new Error('POLY_API_KEY not found in environment');
  }

  const service = new MarketDataService(apiKey);

  // Test 1: Get company details
  Logger.section('TEST 1: Get Company Details (AAPL)');
  try {
    const details = await service.getCompanyDetails('AAPL');
    Logger.success(JSON.stringify(details, null, 2));
  } catch (error) {
    Logger.error('Test 1 failed:', error);
  }
  Logger.info('Waiting 20 seconds before next test...');
  await sleep(20000);

  // Test 2: Get estimated price
  Logger.section('TEST 2: Get Estimated Price (AAPL)');
  try {
    const price = await service.getEstimatedPrice('AAPL');
    Logger.success(JSON.stringify(price, null, 2));
  } catch (error) {
    Logger.error('Test 2 failed:', error);
  }

  Logger.info('Waiting 20 seconds before next test...');
  await sleep(20000);

  // Test 3: Get stock news
  Logger.section('TEST 3: Get Stock News (AAPL, limit 3)');
  try {
    const news = await service.getStockNews('AAPL', 3);
    Logger.success(JSON.stringify(news, null, 2));
  } catch (error) {
    Logger.error('Test 3 failed:', error);
  }

  Logger.info('Waiting 20 seconds before next test...');
  await sleep(20000);

  // Test 4: Search tickers
  Logger.section('TEST 4: Search Tickers (query: "apple")');
  try {
    const tickers = await service.searchTickers('apple', 3);
    Logger.success(JSON.stringify(tickers, null, 2));
  } catch (error) {
    Logger.error('Test 4 failed:', error);
  }

  Logger.section('All tests completed!');
}

runTests().catch((error) => {
  Logger.error('Unexpected error during tests:', error);
});
