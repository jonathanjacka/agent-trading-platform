#!/bin/bash

echo "========================================="
echo "Testing Trading Platform API"
echo "========================================="
echo ""

# Test 1: Health check
echo "📌 Test 1: Health Check"
curl -s http://localhost:3000/health | jq '.'
echo ""
echo ""

# Test 2: Get traders info
echo "📌 Test 2: Get Traders Info"
curl -s http://localhost:3000/api/traders | jq '.'
echo ""
echo ""

# Test 3: Research query
echo "📌 Test 3: Researcher Agent - Research Apple stock"
curl -s -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the latest news about Apple stock?"}' | jq '.'
echo ""
echo ""

# Test 4: Leonardo (Value investor) - Check portfolio and consider a trade
echo "📌 Test 4: Leonardo Agent - Evaluate portfolio"
curl -s -X POST http://localhost:3000/api/trade/leonardo \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Check my current portfolio and tell me if you think I should make any trades based on your value investing strategy."}' | jq '.'
echo ""
echo ""

echo "========================================="
echo "All tests complete!"
echo "========================================="
