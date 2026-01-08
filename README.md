# Likeli - Solana Prediction Market Vaults

A Hyperliquid-style vault system on Solana for trading tokenized Kalshi prediction markets via DFlow.

## 🏗️ Architecture

```
likeli-kalshi/
├── programs/vaults/       # Anchor program (Rust)
├── apps/
│   ├── web/               # Next.js frontend
│   └── api/               # Node.js backend
├── packages/sdk/          # Shared types
└── tests/                 # Anchor tests
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Rust & Cargo
- Solana CLI
- Anchor CLI

### Installation

```bash
# Clone and install dependencies
pnpm install

# Build Anchor program
anchor build

# Setup database (requires Postgres)
cd apps/api
cp .env.example .env
# Edit .env with your database URL
pnpm db:generate
pnpm db:push
```

### Development

```bash
# Terminal 1: Start local Solana validator
solana-test-validator

# Terminal 2: Deploy Anchor program
anchor deploy

# Terminal 3: Start backend API
cd apps/api
pnpm dev

# Terminal 4: Start frontend
cd apps/web
pnpm dev
```

Open http://localhost:3000 to see the app.

## 📦 Project Structure

### Anchor Program (`/programs/vaults`)

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Create vault, share mint, USDC ATA |
| `deposit` | Deposit USDC, receive shares |
| `withdraw` | Burn shares, receive USDC |
| `settle_fee` | Pay manager 10% of profits above HWM |
| `update_nav` | Backend updates cached NAV |
| `set_pause` | Manager pauses deposits/trading |
| `set_trading_authority` | Manager sets trading delegate |

### Backend API (`/apps/api`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/vaults` | GET | List all vaults |
| `/api/vaults/:id` | GET | Get vault details |
| `/api/vaults` | POST | Register new vault |
| `/api/vaults/:id/trade` | POST | Execute trade (manager) |
| `/api/markets` | GET | List DFlow/Kalshi markets |
| `/api/markets/:id` | GET | Market details |

### Frontend (`/apps/web`)

| Route | Description |
|-------|-------------|
| `/` | Dashboard |
| `/vaults` | Vault listing |
| `/vaults/:id` | Vault detail + deposit/withdraw |
| `/vaults/create` | Create new vault |
| `/markets` | Browse prediction markets |
| `/leaderboard` | Top traders ranking |

## 🔧 Configuration

### Environment Variables

**Backend** (`apps/api/.env`):
```env
DATABASE_URL=postgresql://...
SOLANA_RPC_URL=https://api.devnet.solana.com
PROGRAM_ID=<your-program-id>
TRADING_AUTHORITY_PRIVATE_KEY=<base58-key>
DFLOW_API_URL=https://api.dflow.net/v1
```

**Frontend** (`apps/web/.env.local`):
```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PROGRAM_ID=<your-program-id>
```

## 🧪 Testing

```bash
# Anchor tests
anchor test

# Backend tests
cd apps/api && pnpm test

# Frontend tests
cd apps/web && pnpm test
```

## 🔒 Security

- **On-chain**: Validated USDC mint, manager-only config changes, checked arithmetic
- **Backend**: Wallet signature auth, size limits, market allowlist
- **Emergency**: Pause flag, withdrawals always work

## 📝 TODO

- [ ] DFlow API integration (waiting for access)
- [ ] Real trade execution
- [ ] NAV indexer cron job
- [ ] Audit before mainnet

## 📄 License

MIT
