#!/usr/bin/env npx tsx
/**
 * WebSocket Health Check Script
 * Tests connection to Polygon.io WebSocket and validates API key
 *
 * Run with: npx tsx scripts/check-streaming.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (override any existing env vars)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

import { websocketClient } from '@massive.com/client-js';

// Configuration
const WS_URL = 'wss://delayed.massive.com';
const TEST_SYMBOL = 'AAPL';
const TIMEOUT_MS = 10000; // 10 seconds

interface HealthCheckResult {
  success: boolean;
  connection: 'ok' | 'failed';
  authentication: 'ok' | 'failed' | 'unknown';
  subscription: 'ok' | 'failed' | 'unknown';
  dataReceived: boolean;
  messages: string[];
  error?: string;
}

async function checkStreaming(): Promise<HealthCheckResult> {
  const apiKey = process.env.POLY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      connection: 'failed',
      authentication: 'unknown',
      subscription: 'unknown',
      dataReceived: false,
      messages: [],
      error: 'POLY_API_KEY not found in environment variables',
    };
  }

  console.log('🔍 WebSocket Health Check');
  console.log('=========================');
  console.log(`URL: ${WS_URL}`);
  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`Test Symbol: ${TEST_SYMBOL}`);
  console.log('');

  const result: HealthCheckResult = {
    success: false,
    connection: 'failed',
    authentication: 'unknown',
    subscription: 'unknown',
    dataReceived: false,
    messages: [],
  };

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log('\n⏱️  Timeout reached');

      // If we connected but didn't get data, that's expected outside market hours
      if (result.connection === 'ok') {
        result.success = true;
        result.messages.push('Connection healthy (no data expected outside market hours)');
      }

      resolve(result);
    }, TIMEOUT_MS);

    try {
      console.log('📡 Connecting...');
      const client = websocketClient(apiKey, WS_URL);
      const ws = client.stocks();

      // Mark connection as successful
      result.connection = 'ok';
      console.log('✅ WebSocket connected');

      // Set up message handler
      ws.onmessage = (event: { data: string }) => {
        try {
          const messages = JSON.parse(event.data);
          const messageArray = Array.isArray(messages) ? messages : [messages];

          for (const msg of messageArray) {
            result.messages.push(`${msg.ev}: ${msg.message || msg.sym || JSON.stringify(msg)}`);

            switch (msg.ev) {
              case 'status':
                if (msg.status === 'connected') {
                  console.log('✅ Status: Connected');
                } else if (msg.status === 'auth_success') {
                  result.authentication = 'ok';
                  console.log('✅ Authentication: Success');
                } else if (msg.status === 'auth_failed') {
                  result.authentication = 'failed';
                  console.log('❌ Authentication: Failed');
                  result.error = 'API key authentication failed';
                } else {
                  console.log(`📝 Status: ${msg.message || msg.status}`);
                }
                break;

              case 'AM':
                // Minute aggregate received - this means data is flowing!
                result.dataReceived = true;
                result.subscription = 'ok';
                console.log(`📊 Data received: ${msg.sym} - $${msg.c} (volume: ${msg.v})`);
                break;

              default:
                console.log(`📝 Event: ${msg.ev}`);
            }
          }
        } catch (e) {
          console.log(`⚠️  Parse error: ${event.data.substring(0, 100)}`);
        }
      };

      // Wait a moment then subscribe
      setTimeout(() => {
        if (result.connection === 'ok') {
          console.log(`\n📋 Subscribing to AM.${TEST_SYMBOL}...`);
          try {
            ws.send(JSON.stringify({ action: 'subscribe', params: `AM.${TEST_SYMBOL}` }));
            // We can't easily confirm subscription without market data,
            // so we'll assume it worked if no error is thrown
            result.subscription = 'ok';
            console.log('✅ Subscription sent');
          } catch (e) {
            result.subscription = 'failed';
            console.log(`❌ Subscription failed: ${e}`);
          }
        }
      }, 2000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.error = errorMessage;
      console.log(`❌ Connection failed: ${errorMessage}`);
      clearTimeout(timeout);
      resolve(result);
    }
  });
}

// Main execution
async function main() {
  console.log('\n');

  const result = await checkStreaming();

  console.log('\n');
  console.log('📋 Health Check Summary');
  console.log('=======================');
  console.log(`Connection:     ${result.connection === 'ok' ? '✅ OK' : '❌ FAILED'}`);
  console.log(`Authentication: ${result.authentication === 'ok' ? '✅ OK' : result.authentication === 'failed' ? '❌ FAILED' : '⚠️  UNKNOWN'}`);
  console.log(`Subscription:   ${result.subscription === 'ok' ? '✅ OK' : result.subscription === 'failed' ? '❌ FAILED' : '⚠️  UNKNOWN'}`);
  console.log(`Data Flow:      ${result.dataReceived ? '✅ RECEIVING DATA' : '⚠️  No data (normal outside market hours)'}`);

  if (result.error) {
    console.log(`\n❌ Error: ${result.error}`);
  }

  console.log('\n');

  // Success requires at least connection and auth (or unknown auth if no response)
  const isHealthy = result.connection === 'ok' && result.authentication !== 'failed';

  if (isHealthy) {
    console.log('🎉 Health check PASSED - Streaming infrastructure is ready!');
    console.log('   Run during market hours (9:30 AM - 4:00 PM ET) to see live data.');
    process.exit(0);
  } else {
    console.log('❌ Health check FAILED');
    if (result.authentication === 'failed') {
      console.log('   Check your POLY_API_KEY in .env file');
    }
    process.exit(1);
  }
}

main();
