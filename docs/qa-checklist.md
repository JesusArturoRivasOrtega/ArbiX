# ArbiX QA Checklist

Use this list to verify all critical functionality before a demo or presentation.

---

## 1. Startup & Infrastructure

- [ ] `npm install` completes without errors
- [ ] `npm run prisma:generate` completes (or memory fallback is active)
- [ ] `npx tsc --noEmit -p apps/api/tsconfig.json` passes
- [ ] `npx tsc --noEmit -p apps/web/tsconfig.json` passes
- [ ] `npm test -w @arbix/api` passes
- [ ] `npm run build -w @arbix/web` completes successfully
- [ ] API starts on port 4000: `GET http://localhost:4000/health` returns `{status: "ok"}`
- [ ] Swagger UI loads at `http://localhost:4000/api/docs`
- [ ] Frontend starts on port 3001

---

## 2. Navigation & Layout

- [ ] App loads at `http://localhost:3001` and redirects to `/dashboard`
- [ ] Sidebar visible on desktop (≥ 1024px)
- [ ] Sidebar opens/closes on mobile
- [ ] All 8 sidebar links navigate correctly: Dashboard, Opportunities, Simulator, Wallets, Analytics, Risk Center, Strategy Lab, Settings
- [ ] Topbar does not overflow or hide content
- [ ] No console errors on initial load
- [ ] ErrorBoundary does not trigger on normal navigation

---

## 3. WebSocket & Real-time

- [ ] Socket.IO connects (Topbar shows "Realtime connected")
- [ ] Market quotes arrive and update the Market Matrix
- [ ] Bot status badge reflects backend state
- [ ] Circuit breaker badge reflects backend state

---

## 4. Bot Lifecycle

- [ ] **Start** (Play button): bot status changes to RUNNING
- [ ] **Pause** (Pause button): bot status changes to PAUSED, market feed stops
- [ ] **Reset** (Refresh button): bot restarts, order books clear, status returns to RUNNING

---

## 5. Market Data

- [ ] Market Matrix shows quotes from Binance, Kraken, OKX (in DEMO mode)
- [ ] BTC/USDT filter shows only BTC rows
- [ ] ETH/USDT filter shows only ETH rows
- [ ] "All pairs" filter shows all rows
- [ ] STALE badge appears when quotes are >3 seconds old

---

## 6. Demo Scenarios

### 6a. profitable-arbitrage
- [ ] Clicking "Profitable" scenario triggers a replay
- [ ] At least one `EXECUTED` opportunity appears in the Opportunity Feed
- [ ] Net P&L becomes positive
- [ ] Execution Timeline in Simulator shows the trade
- [ ] Wallets update after trade
- [ ] Toast: "Trade executed: +$X.XX"

### 6b. rejected-by-fees
- [ ] Clicking "Fees reject" triggers a replay
- [ ] At least one `REJECTED` opportunity appears
- [ ] Rejection reason is FEES_EXCEED_SPREAD or NET_PROFIT_NEGATIVE
- [ ] Rejection Checklist shows the failing check

### 6c. insufficient-liquidity
- [ ] Clicking "Low liquidity" triggers a replay
- [ ] Opportunity is REJECTED (INSUFFICIENT_LIQUIDITY) or shows partial fill warning

### 6d. high-latency-circuit-breaker
- [ ] Clicking "High latency" triggers a replay
- [ ] Circuit breaker activates (orange/red banner appears in Dashboard)
- [ ] Risk Center shows "Active" circuit breaker
- [ ] Execution is paused while breaker is active
- [ ] "Clear" button deactivates the breaker

### 6e. Presentation Mode
- [ ] "Presentation Mode" button resets bot, clears risk, seeds wallets, fires profitable scenario
- [ ] Status chip shows "Presentation Mode ready" after completion
- [ ] An EXECUTED trade is visible

---

## 7. Opportunities

- [ ] Opportunity Feed lists events in real time
- [ ] Status filter (ALL/EXECUTED/REJECTED/WATCHING/EXPIRED) works
- [ ] Clicking an opportunity row opens the detail panel
- [ ] Detail shows: symbol, exchanges, prices, VWAP, volume, fees, slippage, net profit, latency, confidence
- [ ] Rejection Checklist shows all 8 checks (✓ for EXECUTED, ✗ for failing check on REJECTED)
- [ ] "View in Simulator" button navigates to `/simulator`
- [ ] Export CSV downloads a valid file
- [ ] Export JSON downloads a valid file

---

## 8. Simulator

- [ ] Page loads with last simulated trade (or empty state if none)
- [ ] Execution Timeline shows all steps with latency badges
- [ ] Order Book Depth shows buy/sell levels
- [ ] Trade Breakdown shows fees, slippage, net P&L breakdown

---

## 9. Wallets

- [ ] All exchange wallets are shown (Binance, Kraken, OKX)
- [ ] Total estimated USD value is correct
- [ ] Delta vs. baseline is shown (±$X / ±Y%)
- [ ] After a simulated trade, balances update correctly
- [ ] No negative balances
- [ ] Ledger shows trade entries
- [ ] Reset wallets with confirmation dialog restores seed balances
- [ ] Export CSV downloads wallet data

---

## 10. Analytics

- [ ] Metrics show non-NaN values (even with zero trades)
- [ ] P&L chart renders with data or shows empty state
- [ ] Rejection reasons chart shows counts
- [ ] Volume by exchange chart renders
- [ ] Sharpe ratio shows "—" with < 2 trades, numeric with ≥ 2 trades

---

## 11. Risk Center

- [ ] Circuit breaker status matches topbar badge
- [ ] Risk level badge updates in real time
- [ ] Peak latency metric shown
- [ ] Risk events log populated
- [ ] "Configure in Settings" link works
- [ ] Clear circuit breaker clears it (with confirmation)

---

## 12. Settings

- [ ] Config loads from backend
- [ ] Save button updates config and shows success toast
- [ ] Changing mode (LIVE/DEMO/REPLAY) and saving takes effect
- [ ] Exchange toggles update enabled exchanges
- [ ] Numeric fields reject negative values (HTML min attribute)
- [ ] Replay scenario buttons work from Settings page

---

## 13. Strategy Lab

- [ ] Page loads and shows triangular arbitrage card
- [ ] Route visualization shows USDT → BTC → ETH → USDT
- [ ] "Watch-only" label is visible
- [ ] "Simulate" button runs animation and shows result
- [ ] "Prices not available" fallback shows when backend is offline

---

## 14. Tutorial

- [ ] Tutorial auto-starts on first visit (cleared localStorage)
- [ ] Tutorial button in sidebar starts tutorial when clicked
- [ ] Step 1 shows Welcome overlay (centered)
- [ ] Step 2 highlights Bot Status Card
- [ ] Progress bar shows correct percentage
- [ ] "Next" advances the step
- [ ] "Back" returns to previous step
- [ ] "Skip tutorial" exits and saves state to localStorage
- [ ] Tutorial does not restart on page reload after being skipped
- [ ] "Reset tutorial" in Settings clears the state
- [ ] Tutorial navigates to correct route for each step
- [ ] Keyboard: `→` advances, `←` goes back, `Escape` skips
- [ ] Tutorial survives page navigation without crashing

---

## 15. Error Handling

- [ ] When API is unavailable: shows demo data (no crash)
- [ ] Empty Opportunity Feed shows helpful message
- [ ] Empty Simulator shows actionable empty state
- [ ] Empty Wallets shows "Click Reset Wallets" message
- [ ] Circuit breaker active: red banner visible, clear button works
- [ ] WebSocket disconnected: topbar shows "Local demo fallback"
- [ ] No NaN or undefined values in any metric card

---

## Demo Day Script

1. Open `http://localhost:3001`
2. Tutorial starts automatically → walk through 2-3 steps, then press Skip
3. Click **Presentation Mode** in Demo Control Panel
4. Wait for "Presentation Mode ready" confirmation
5. Point to Opportunity Feed — show EXECUTED trade
6. Navigate to `/opportunities` — show detail panel and rejection checklist
7. Navigate to `/simulator` — show execution timeline
8. Navigate to `/wallets` — show updated balances
9. Navigate to `/analytics` — show P&L chart
10. Back to `/dashboard` — run "Fees reject" scenario, show REJECTED opportunity
11. Run "High latency" scenario — show circuit breaker activate → clear it
12. Navigate to `/strategy-lab` — show triangular arbitrage
13. Navigate to `/settings` — explain configurability
14. Q&A ready
