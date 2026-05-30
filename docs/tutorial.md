# ArbiX Guided Tutorial

## Overview

ArbiX includes a built-in interactive onboarding tutorial that guides users and judges through every major feature of the platform, step by step. The tutorial works like a videogame guide — it highlights each element on screen, explains what it does, and advances as you explore.

## How the Tutorial Works

- A dark overlay dims everything except the currently highlighted element.
- A glowing teal border marks the target element.
- A tooltip shows the step title, description, and progress bar.
- Navigation buttons (Back / Next / Skip) are always visible.

## Starting the Tutorial

**Automatic**: The tutorial starts automatically on first visit (when it has never been completed or skipped).

**Manual**: Click the **Tutorial** button at the bottom of the sidebar at any time.

**From Settings**: Go to **Settings → Guided Tutorial** and click **Start tutorial now**.

## Navigating the Tutorial

| Action | How |
|--------|-----|
| Next step | Click **Next** or press `→` |
| Previous step | Click **Back** or press `←` |
| Skip / exit | Click **Skip tutorial**, the `×` button, or press `Escape` |
| Finish | Click **Finish** on the last step |

## Skipping the Tutorial

Press **Skip tutorial** or the `×` on the tooltip at any time. The skip state is saved to `localStorage` so the tutorial won't auto-start again in the same browser.

## Resetting the Tutorial

1. Go to **Settings** in the sidebar.
2. Scroll to **Guided Tutorial**.
3. Click **Reset tutorial** to clear the saved state.
4. The tutorial will auto-start on the next page load, or you can click **Start tutorial now**.

## Presentation Mode

**Presentation Mode** (big button in the Demo Control Panel) is a one-click action that:

1. Resets the bot and all market state.
2. Clears the circuit breaker.
3. Seeds wallets back to their baseline.
4. Fires the **profitable-arbitrage** replay scenario.
5. Confirms the result via the Validation Guide.

Use Presentation Mode before a demo to guarantee a clean, impressive starting state.

## Tutorial Steps (19 total)

| # | Title | Page | Key Action |
|---|-------|------|-----------|
| 1 | Welcome to ArbiX | Dashboard | — |
| 2 | Bot Status | Dashboard | Observe status card |
| 3 | Market Mode | Dashboard | Note DEMO/LIVE/REPLAY badge |
| 4 | Health Preflight | Dashboard | Click Recheck |
| 5 | Start the Bot | Dashboard | Press Play button |
| 6 | Market Matrix | Dashboard | Observe live quotes grid |
| 7 | Symbol Filter | Dashboard | Try BTC/USDT or ETH/USDT |
| 8 | Run Profitable Scenario | Dashboard | Click Profitable button |
| 9 | Opportunity Feed | Dashboard | Observe EXECUTED event |
| 10 | Opportunity Detail | Opportunities | Click any opportunity |
| 11 | Rejection Checklist | Opportunities | Note 8-check risk audit |
| 12 | Execution Timeline | Simulator | See step-by-step execution |
| 13 | Virtual Wallets | Wallets | Note balance changes |
| 14 | P&L Analytics | Analytics | See cumulative profit chart |
| 15 | Risk Center | Risk | Note circuit breaker |
| 16 | Replay Mode | Dashboard | Note Replay menu |
| 17 | Strategy Lab | Strategy Lab | See triangular flow |
| 18 | Settings | Settings | See configuration form |
| 19 | Done | Dashboard | Complete tour |

## Technical Notes

- Tutorial state is persisted in `localStorage` under key `arbix:tutorial:v1`.
- The tutorial automatically navigates to the correct page for each step.
- If a target element is not found after ~40 frames, the tooltip falls back to center-screen.
- The tutorial never blocks API calls or socket events — it only overlays the visual layer.
- Keyboard support: `→` next, `←` back, `Escape` skip.
