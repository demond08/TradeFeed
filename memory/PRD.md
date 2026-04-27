# TradeFeedX PRD

## Problem Statement
TikTok-style social feed app for day traders. Features include:
- Login + signup (email/password + Google)
- Scrolling news ticker at top (like TikTok), powered by Finnhub
- Top tabs: For You / Trending / News / Following
- Vertical feed of trade posts (chart image/video, ticker, entry/SL/TP, outcome)
- Bottom nav: Feed, Search, Camera (center FAB), Alerts, Profile — visible on mobile
- Camera screen that auto-opens device camera; AI analyzes chart (verdict, entry, SL, TP)
- Search by ticker or trader name
- Trader profile: avatar, bio, follower count, win rate, trade grid, follow button
- Settings (Instagram-style): private account toggle, light/dark theme, logout
- Trade outcome tracking (mark WIN/LOSS → auto-updates win rate)
- Data-cleanup insights endpoint (original problem statement)

## Architecture
- FastAPI backend with MongoDB (motor)
- Emergent object storage for chart images + recorded videos
- Gemini 3.1 Pro vision via Emergent LLM key for AI trade analysis and data insights
- Finnhub /news for live market headlines
- JWT email/password auth + Emergent Google OAuth (cookie session)
- React frontend, Tailwind, Shadcn-compatible, dark theme default
- Dark/light theme via body class `theme-light`

## Implemented (Apr 2026)
- Auth (signup/login/google/logout/me)
- Posts (create, feed, like, mark-outcome, delete)
- Follow system + profile page with win rate
- Search (ticker + users)
- Upload (object storage) + media proxy
- Finnhub news + ticker endpoint
- AI trade analyze (Gemini 3 Pro vision)
- Cleanup/insights endpoint (data cleanup + next steps)
- Mobile-first UI with persistent bottom nav

## Backlog (P1 / P2)
- Comments (UI in place, backend stub)
- Push notifications / real alerts
- Admin moderation
- Private-account enforcement in feed queries
- AI camera for video (currently still images only)
- Trending ranking with time-decay
