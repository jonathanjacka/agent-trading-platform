# Agent Trading Platform

An autonomous AI-powered stock trading platform featuring multiple AI agents with distinct trading strategies. Built with TypeScript, Express, React, and the Vercel AI SDK.

## Overview

This platform simulates a trading environment where AI agents autonomously research markets, make trading decisions, and learn from their experiences. Each agent has its own personality, trading strategy, and portfolio.

### Key Features

- **Multi-Agent Architecture**: Four autonomous trading agents with unique strategies
- **Research Capabilities**: Real-time market data, financial news with sentiment analysis, and web search
- **Memory System**: Agents learn from past trades and share collective insights
- **Scheduled Trading**: Automated daily trading sessions via cron scheduler
- **Observability**: Langfuse integration for AI agent tracing and debugging
- **Push Notifications**: Trade alerts via Pushover

## Agents

The platform features four trader agents, each with a distinct investment philosophy:

| Agent            | Strategy           | Style                                                 |
| ---------------- | ------------------ | ----------------------------------------------------- |
| **Leonardo**     | Value Investing    | Seeks quality companies trading below intrinsic value |
| **Michelangelo** | Growth Investing   | Focuses on high-growth companies and emerging trends  |
| **Raphael**      | Dividend Investing | Prioritizes stable dividend-paying stocks             |
| **Donatello**    | Technical Analysis | Uses price patterns and technical indicators          |

### Agent Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     TraderAgent                              │
├─────────────────────────────────────────────────────────────┤
│  1. Review portfolio (getPortfolio)                         │
│  2. Check past memories (reviewMemories)                    │
│  3. Learn from other agents (reviewCollectiveLessons)       │
│  4. Research markets (researcher tool → ResearcherAgent)    │
│  5. Make trading decision (buyStock / sellStock)            │
│  6. Record lessons learned (recordLesson)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ResearcherAgent                            │
├─────────────────────────────────────────────────────────────┤
│  Tools:                                                      │
│  • searchFinancialNews - Stock news with sentiment analysis │
│  • analyzeCompany - Company fundamentals and financials     │
│  • searchWeb - Broader market context and trends            │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

**Backend**

- Node.js 22 / TypeScript
- Express 5.1
- Vercel AI SDK (`ai@5.x`) with OpenAI
- better-sqlite3 for persistence
- node-cron for scheduling

**Frontend**

- React 19 / TypeScript
- Vite
- TailwindCSS

**External Services**

- OpenAI (gpt-4o-mini)
- Polygon.io (market data)
- Brave Search (web research)
- Pushover (notifications)
- Langfuse (observability)

## Local Development Setup

### Prerequisites

- [VS Code](https://code.visualstudio.com/) with [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- [Docker](https://www.docker.com/products/docker-desktop)

### Quick Start with Dev Container

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/agent-trading-platform.git
   cd agent-trading-platform
   ```

2. **Create your environment file**

   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables** (see [Environment Variables](#environment-variables) below)

4. **Open in VS Code**

   ```bash
   code .
   ```

5. **Reopen in Container**
   - Press `F1` → "Dev Containers: Reopen in Container"
   - Wait for the container to build and dependencies to install

6. **Start the development server**

   ```bash
   npm run dev
   ```

7. **Start the client** (in a new terminal)
   ```bash
   cd client && npm run dev
   ```

The server runs on `http://localhost:3000` and the client on `http://localhost:5173`.

### Manual Setup (without Dev Container)

```bash
# Install dependencies
npm install
cd client && npm install && cd ..

# Build and run
npm run build
npm start
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

### Required

| Variable         | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `OPENAI_API_KEY` | OpenAI API key for AI agents                                             |
| `POLY_API_KEY`   | Polygon.io API key for market data                                       |
| `BRAVE_API_KEY`  | Brave Search API key for web research                                    |
| `API_SECRET`     | Secret key for API authentication (generate with `openssl rand -hex 32`) |

### Optional but Recommended

| Variable              | Description                           | Default                         |
| --------------------- | ------------------------------------- | ------------------------------- |
| `DEFAULT_MODEL`       | OpenAI model to use                   | `gpt-4o-mini`                   |
| `PUSHOVER_USER`       | Pushover user key for notifications   | -                               |
| `PUSHOVER_TOKEN`      | Pushover app token                    | -                               |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key for observability | -                               |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key                   | -                               |
| `LANGFUSE_BASE_URL`   | Langfuse endpoint                     | `https://us.cloud.langfuse.com` |

### Scheduler Configuration

| Variable             | Description                          | Default                          |
| -------------------- | ------------------------------------ | -------------------------------- |
| `ENABLE_SCHEDULER`   | Enable automated trading             | `false`                          |
| `TRADING_SCHEDULE`   | Cron expression for trading sessions | `0 6 * * 1-5` (6am UTC weekdays) |
| `SCHEDULER_TIMEZONE` | Timezone for scheduler               | `UTC`                            |

### Production

| Variable        | Description                                    |
| --------------- | ---------------------------------------------- |
| `CLIENT_URL`    | Frontend URL for CORS (e.g., your Netlify URL) |
| `DATABASE_PATH` | Path to SQLite database file                   |

## Observability with Langfuse

The platform includes [Langfuse](https://langfuse.com) integration for tracing AI agent workflows. This provides visibility into:

- Every AI model call (prompts, completions, token usage)
- Tool invocations and their results
- Agent decision-making steps
- Latency and cost tracking
- Error debugging

### Setup

1. Create a free account at [cloud.langfuse.com](https://cloud.langfuse.com)
2. Create a project and generate API keys
3. Add the keys to your `.env`:
   ```
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
   ```

Traces are automatically captured when agents run. If keys are not configured, the platform runs normally without tracing.

## Push Notifications with Pushover

The platform uses [Pushover](https://pushover.net/) to send real-time push notifications to your phone when trades are executed. This keeps you informed of agent activity without needing to monitor the dashboard.

### Setup

1. Create an account at [pushover.net](https://pushover.net/)
2. Install the Pushover app on your iOS/Android device
3. Create an application in the Pushover dashboard to get an API token
4. Add your credentials to `.env`:
   ```
   PUSHOVER_USER=your-user-key
   PUSHOVER_TOKEN=your-app-token
   ```

Notifications are optional - if not configured, the platform operates normally without alerts.

## API Endpoints

| Method | Endpoint                   | Description                        |
| ------ | -------------------------- | ---------------------------------- |
| `GET`  | `/api/health`              | Health check                       |
| `GET`  | `/api/traders`             | List all trader agents             |
| `POST` | `/api/traders/:name/trade` | Trigger a trading session          |
| `GET`  | `/api/portfolio/:name`     | Get agent's portfolio              |
| `POST` | `/api/research`            | Run a research query               |
| `GET`  | `/api/transactions/:name`  | Get trade history                  |
| `GET`  | `/api/analytics/:name`     | Get portfolio analytics            |
| `POST` | `/api/scheduler/trigger`   | Manually trigger scheduled trading |
| `GET`  | `/api/scheduler/status`    | Get scheduler status               |

## Scripts

```bash
npm run dev       # Start development server with hot reload
npm run build     # Compile TypeScript
npm start         # Run production server
npm test          # Run tests
npm run lint      # Run ESLint
```

## Deployment

The platform is designed for deployment with:

- **Backend**: Railway (or any Node.js host)
- **Frontend**: Netlify (or any static host)
- **Database**: SQLite with persistent volume

See deployment configuration in `Dockerfile` and `railway.json`.

## Project Structure

```
├── src/
│   ├── agents/           # AI agent implementations
│   │   ├── TraderAgent.ts
│   │   └── ResearcherAgent.ts
│   ├── services/         # Business logic services
│   │   ├── AccountService.ts
│   │   ├── DatabaseService.ts
│   │   ├── MarketDataService.ts
│   │   ├── MemoryService.ts
│   │   └── ...
│   ├── routes/           # API route handlers
│   ├── middleware/       # Express middleware
│   ├── utils/            # Utilities
│   ├── telemetry.ts      # Langfuse setup
│   └── index.ts          # Server entry point
├── client/               # React frontend
├── data/                 # SQLite database (gitignored)
└── .devcontainer/        # Dev container configuration
```

## License

MIT
