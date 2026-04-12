# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Work Time Tracker (`artifacts/timesheet-tracker`)
- React + Vite frontend at preview path `/`
- Location-based timesheet tracking app called "ClockIn"
- **Auto-detection**: Uses watchPosition to continuously monitor GPS, auto-records arrivals/departures as geofence events
- **Daily total**: First arrival to last departure each day (supports multiple trips)
- Pages: Dashboard (live status), History (day-by-day events), Summary (weekly chart + CSV export), Location settings

### API Server (`artifacts/api-server`)
- Express 5 backend at `/api`
- Handles location events, work location, and summary endpoints

## Database Schema

- `location_events` — individual arrival/departure events with timestamps and GPS coords
- `work_locations` — saved workplace GPS location with geofence radius
- `time_entries` — legacy manual clock in/out (no longer primary mechanism)

## Tracking Logic

- `location_events.type` is either 'arrival' or 'departure'
- Daily total = last departure - first arrival for the day
- Multiple visits per day are all captured; only endpoints matter for the daily total
- Debounced: requires 2 consecutive outside readings before recording a departure
