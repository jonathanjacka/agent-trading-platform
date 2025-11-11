# MarketDataService

## Setup

The MarketDataService requires a valid (but free!) API key from Massive.com (formerly Polygon.io).

### Getting an API Key

1. Sign up at [https://massive.com/dashboard/signup](https://massive.com/dashboard/signup)
2. Get your API key from the dashboard
3. Add it to your `.env` file:
   ```
   POLY_API_KEY=your_actual_api_key_here
   ```

## Be Aware of these Limitations

The free "Stocks Basic" plan has strict limitations:

- **Rate Limits**: ~5 API calls per minute (rolling 60-second window)
- **Data Freshness**: Company data and market cap updated daily (not real-time)
- **News**: Updated hourly with sentiment analysis
- **History**: 2 years of historical data
- **No Real-Time Trades/Quotes**: Requires paid plan (403 errors on free tier)

### Rate Limit Behavior

- Rolling 60-second window tracks ALL API calls
- Client library performs automatic retries on failures (3+ attempts)
- Failed retries will count against your rate limit
- Must wait full minute from last API call to fully reset quota

## API Methods (Free Tier Compatible)

### `getCompanyDetails(symbol: string)`

Returns comprehensive company information including fundamentals, sector, market cap, and address.

**API Calls**: 1 (cached for 1 hour)

```typescript
const details = await marketData.getCompanyDetails('AAPL');
// Returns: symbol, name, description, sector, marketCap, employees, homepage, etc.
```

### `getEstimatedPrice(symbol: string)`

Calculates estimated stock price from market cap / shares outstanding. Not real-time, but useful for portfolio valuation.

**API Calls**: 0 (uses cached ticker data from getCompanyDetails)

```typescript
const price = await marketData.getEstimatedPrice('AAPL');
// Returns: { estimatedPrice, marketCap, sharesOutstanding, note }
```

### `getStockNews(symbol: string, limit?: number)`

Fetches recent financial news with AI-generated sentiment analysis per ticker.

**API Calls**: 1 per request

```typescript
const news = await marketData.getStockNews('AAPL', 5);
// Returns: array of articles with title, description, publishedDate, insights (sentiment)
```

### `searchTickers(query: string, limit?: number)`

Search for stocks by company name or ticker symbol.

**API Calls**: 1 per request

```typescript
const results = await marketData.searchTickers('apple', 10);
// Returns: array of matching tickers
```

## Caching Strategy

To get manage the free-tier rate limiting, I've currently implemented in-memory caching:

- **Cache Duration**: 1 hour TTL (Time To Live)
- **Cached Data**: Ticker information from `getTicker()` API calls
- **Benefits**:
  - `getEstimatedPrice()` reuses data from `getCompanyDetails()`
  - Multiple calls for same symbol within 1 hour = only 1 API call
  - Significantly reduces rate limit issues
- **Limitations**: Be aware that this cache is cleared on service restart (fine for daily-updated data)

### Why 1 Hour?

Ticker data (market cap, shares outstanding, company info) updates **once daily** on the free tier, so caching for 1 hour is more than fine. Change it if you want.

## Testing

Run the test suite to verify all endpoints:

```bash
npm run dev:test-market
```

**Note**: Tests include 20-second delays between calls to respect rate limits as well. With caching enabled, the 4 tests make only **3 actual API calls**:

1. Test 1: `getCompanyDetails` (1 API call)
2. Test 2: `getEstimatedPrice` (0 API calls - uses cache)
3. Test 3: `getStockNews` (1 API call)
4. Test 4: `searchTickers` (1 API call)

If some these tests do fail with `400` errors, you're hitting the rate-limit. You can also confirm this from the logs at your [Massive Dashboard.](https://massive.com/dashboard)
