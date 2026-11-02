# TableTap — Real-time QR Table Ordering

Customers scan a QR code on their table, order from their phone, and the kitchen screen updates instantly. When the cook moves a ticket to "ready", the customer's phone updates too. Built for small Thai restaurants.

**Live demo:** https://tabletap-nutt7.onrender.com

- **Order as a customer:** [open table A1](TABLE_A1_LINK) on your phone, add a few dishes and place the order. The status on your phone changes live as the kitchen works on it.
- Staff screens (kitchen board, back office) are behind a login; see [Run locally](#run-locally) to try them with demo accounts.
- Hosted on a free plan: the first visit after a quiet period can take about a minute while the server wakes up.

**Stack:** Next.js 16 (App Router) · TypeScript · PostgreSQL · Drizzle ORM · Redis pub/sub · Server-Sent Events · Tailwind CSS · Vitest · Docker

| Customer (phone) | Kitchen board | Back office: tables & QR |
| --- | --- | --- |
| <img src="docs/screenshots/customer.png" alt="Customer menu with cart on a phone" width="240"> | <img src="docs/screenshots/kitchen.png" alt="Kitchen board with new, cooking and ready columns" width="420"> | <img src="docs/screenshots/admin-qr.png" alt="Back office listing tables with their QR codes" width="420"> |

## Features

- **Customer (no login):** open the table's QR link, browse the menu, build a cart, add a note for the kitchen, and watch each order's status change live.
- **Kitchen screen:** three columns (new → cooking → ready), tickets appear the moment they're ordered, minutes-waiting timer turns red after 15 minutes.
- **Back office (admin):** live list of unpaid tables, close a bill, add menu items, mark items sold out, add tables and print or rotate their QR codes.

## How real-time works

```
Customer phone ──POST /api/tables/:token/orders──▶ Next.js ──INSERT──▶ PostgreSQL
                                                     │
                                         (after commit) PUBLISH
                                                     ▼
                                               Redis pub/sub
                                       ┌─────────────┴─────────────┐
                               channel "kitchen"          channel "table:<id>"
                                       ▼                           ▼
                         GET /api/kitchen/stream      GET /api/tables/:token/stream
                              (SSE) kitchen screen         (SSE) customer phone
```

- **Server-Sent Events, not WebSockets.** Screens only need server → browser updates, and SSE is plain HTTP: it passes through proxies, reconnects automatically through `EventSource`, and needs no extra server. Actions (place order, change status) are normal POST/PATCH requests.
- **Redis pub/sub** lets several app instances share events: an order placed through instance A reaches a kitchen screen connected to instance B. Without `REDIS_URL` the app falls back to an in-process event emitter (fine for one server).
- **Events are published only after the transaction commits**, so a screen never receives an event for an order it can't load yet.
- **Missed events are recovered.** When a stream reconnects, the client refetches the full list, so a dropped Wi-Fi connection doesn't leave the board stale.
- One Redis subscription per channel is shared by all open streams on an instance (reference counted), instead of one Redis connection per browser tab.

## Correctness and security decisions

| Problem | Solution |
| --- | --- |
| Customer edits the request to change prices | Server ignores client prices and reprices every line from the database; prices are snapshotted on the order item |
| Double-tapped "Order" button or retried request | Client sends an idempotency key; a unique index on `(table_id, idempotency_key)` makes the second insert a no-op that returns the first order |
| Two cooks press "Ready" at the same time | Optimistic concurrency: `UPDATE … WHERE id = ? AND status = <status the cook saw>`; the loser gets `409` |
| Invalid status jumps (cancelled → served) | Explicit state machine (`src/lib/order-status.ts`) checked before every update |
| Two cashiers close the same table at once | Table row locked with `SELECT … FOR UPDATE` inside the bill transaction |
| Guessing other tables' URLs | Each table has a random 128-bit token; admins can rotate it, which kills old printed QR codes |
| Order spam | Per-table rate limit (10 orders/min) |
| Password guessing | bcrypt hashes, per-username login rate limit, constant-time path for unknown users |
| Staff auth | HS256 JWT in an `httpOnly`, `SameSite=Lax` cookie; roles `admin` and `kitchen` checked on every API route and server action |
| CSRF on the JSON API | `Origin` header must match the host on state-changing requests |
| Money rounding | All amounts stored as integer satang |

## Run locally

Requirements: Node 22+, Docker.

```bash
cp .env.example .env
docker compose up -d db redis     # PostgreSQL + Redis
npm install
npm run db:migrate
npm run db:seed                   # demo menu, 6 tables, staff accounts
npm run dev
```

- Back office: http://localhost:3000/admin → log in as `admin` / `admin1234`
- Kitchen screen: http://localhost:3000/kitchen → `kitchen` / `kitchen1234`
- Customer view: open **Admin → โต๊ะ & QR** and click a table's link (or scan its QR with your phone on the same network after setting `APP_URL` to your computer's LAN address)

**Demo tip:** open the customer link on your phone and the kitchen screen on your laptop side by side, then place an order.

Run everything in Docker instead: `docker compose --profile app up --build`, then seed with `DATABASE_URL=postgres://app:app@localhost:5432/tabletap npm run db:seed`.

## Tests

```bash
createdb tabletap_test   # or use the compose database
DATABASE_URL=postgres://app:app@localhost:5432/tabletap_test npm run db:migrate
npm test
```

The integration tests run against a real PostgreSQL database and cover the concurrency cases directly: five simultaneous identical order requests create one order, two simultaneous status updates produce exactly one success, and two simultaneous bill closes create exactly one bill. GitHub Actions runs typecheck, tests and a production build on every push.

## Deploying

SSE needs long-lived connections, so deploy to a platform that runs a normal Node server (Railway, Fly.io, Render, a VPS with Docker) rather than short-lived serverless functions. The Docker image runs migrations on start and listens on `$PORT`.

### Railway

1. New project → **Deploy from GitHub repo** → pick this repo (Railway builds the `Dockerfile`).
2. In the project, **+ New → Database → PostgreSQL**, then **+ New → Database → Redis**.
3. In the app service → **Variables**, add:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - `SESSION_SECRET` = 32+ random characters
   - `APP_URL` = the service's public URL (Settings → Networking → Generate Domain)
4. Seed once from your computer with the Postgres service's **public** connection URL and your own passwords:
   ```bash
   DATABASE_URL="<public postgres url>" ADMIN_PASSWORD="..." KITCHEN_PASSWORD="..." npm run db:seed
   ```

## Project structure

```
src/
  app/
    t/[token]/          customer menu, cart and live order status
    kitchen/            kitchen board
    admin/              bills, menu, tables & QR (server actions)
    api/                route handlers (orders, status, SSE streams, auth)
  db/schema.ts          Drizzle schema
  lib/
    orders.ts           order, status and billing logic
    events.ts           Redis / in-memory pub/sub bus
    sse.ts              SSE response helper with heartbeat and cleanup
    order-status.ts     order state machine
    auth.ts             JWT sessions and roles
tests/                  unit + PostgreSQL integration tests
```

## Possible next steps

- Payment at the table (PromptPay QR) instead of paying the cashier
- Kitchen printer integration and sound alert for new tickets
- Per-station routing (drinks bar vs. kitchen)
- Redis-backed rate limiter for multi-instance deployments
