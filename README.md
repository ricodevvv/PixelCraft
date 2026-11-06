# PixelCraft

A self-hosted store for your Minecraft server that plugs straight into the [PixelBuy](https://github.com/ricodevvv/pixelbuy) plugin. Players type their username, pay with Stripe, and the plugin hands out the stuff in-game. Same idea as Tebex, except it's yours: your domain, your Stripe account, no cut taken.

It's a regular Next.js app with Postgres. The storefront is pixel-art themed and animated with GSAP, and there's an admin panel to manage everything without touching code.

## What's in the box

- Storefront with categories, product pages, cart, coupons and a Stripe checkout.
- Username check against Mojang (Bedrock names that start with a dot are allowed too).
- Live player count, recent supporters, top supporter of the month and a monthly goal bar.
- Admin panel: sales dashboard, orders (resend, refund, mark as paid), products, categories, coupons, servers and settings.
- English and Spanish storefront, and an accent color you pick from the admin.
- The PixelBuy web API (`/api/server/{group}` and `/api/order/{id}`), so the plugin polls the store and delivers orders per server group.

Products without an image get a pixel sprite generated from their slug, so the store looks decent before you upload any art.

## Running it locally

You need Node 20.9+ and a Postgres database.

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed   # optional: demo categories, products, a coupon and a server
npm run dev
```

Open http://localhost:3000 for the store and http://localhost:3000/admin for the panel (password is whatever you put in `ADMIN_PASSWORD`).

No Postgres around? `docker compose up db` starts one with the same credentials as `.env.example`.

## Environment variables

| Variable | Required | What it's for |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string. Works with Neon, Supabase, Railway, your own box... |
| `AUTH_SECRET` | yes | Signs the admin session cookie. At least 32 chars, `openssl rand -base64 32` does the trick. |
| `ADMIN_PASSWORD` | yes | Password for `/admin`. |
| `STRIPE_SECRET_KEY` | for payments | `sk_live_...` or `sk_test_...`. Without it only free orders (100% coupons) go through. |
| `STRIPE_WEBHOOK_SECRET` | for payments | `whsec_...` from the webhook endpoint below. Orders won't be marked as paid without it. |
| `APP_URL` | recommended | Public URL like `https://shop.myserver.net`. Used for Stripe return links and the plugin config. If it's missing the request host is used. |
| `DATABASE_POOL_SIZE` | no | Max Postgres connections per instance, defaults to 5. |

## Deploying

### Vercel

1. Import the repo.
2. Add the env vars above. For Postgres, the Neon integration is the quickest.
3. Deploy. The `vercel-build` script runs the migrations before building, so the database is always up to date.

### Docker

```bash
cp .env.example .env   # fill it in, DATABASE_URL is set by compose
docker compose up -d --build
```

That starts Postgres and the store on port 3000. The container runs migrations on boot and has a health check at `/api/health`. Put it behind whatever reverse proxy you already use (Caddy, nginx, Traefik) for HTTPS.

The image alone works too: `docker build -t pixelcraft .` and run it with your own `DATABASE_URL`.

### Any Node host

```bash
npm ci
npm run db:migrate
npm run build
node .next/standalone/server.js
```

Copy `.next/static` to `.next/standalone/.next/static` and `public` to `.next/standalone/public` before starting, that's how Next's standalone output works.

## Setting up Stripe

1. In the Stripe dashboard go to **Developers → Webhooks** and add an endpoint pointing to `https://your-store/api/stripe/webhook`.
2. Subscribe it to these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

Payment methods are whatever you enable in Stripe (cards, PayPal, OXXO, Apple Pay...). No code changes needed.

For local testing, `stripe listen --forward-to localhost:3000/api/stripe/webhook` prints a `whsec_` you can use.

Refunds work both ways: refund from the admin and the store calls Stripe for you, or refund in Stripe and the webhook catches it. Either way the plugin gets a `REFUND` so your `onRefund` actions run.

## Connecting your Minecraft server

1. In the admin open **Servers** and add one. The group has to match `Options.Group` in the plugin's `store.yml`.
2. Copy the config block it shows you into `plugins/PixelBuy/store.yml`, under `Supervisor`.
3. Set `Options.Supervisor` to the id from that block and run `/pixelbuy reload`.

The server card turns green once the plugin starts polling. Each product has a **server group** and a **PixelBuy item id**; the item id is the key in your `storeitems/*.yml` (like `rank-vip`), and the group decides which server delivers it.

Heads up: the plugin talks to the store over HTTPS only, so a plain `http://` URL won't work outside of local tests. You also need a PixelBuy build that includes the `PixelBuyWeb` URL fix (older builds never replaced `{key}` in the server URL).

## How delivery works

When an order gets paid, the store queues one delivery per server group in it. The plugin polls `GET /api/server/{group}` and gets something like this:

```json
{
  "pending_orders": [
    {
      "id": 1042,
      "date": "2026-11-06",
      "player": "069a79f4-44e9-4726-a5be-fca90e38aaf5:Notch",
      "execution": "BUY",
      "items": [{ "product": 3, "id": "rank-vip", "amount": 1, "price": 4.99 }]
    }
  ],
  "next_check": 30
}
```

After running the actions it posts `{ "processed_orders": [1042] }` back to the same URL and the delivery is marked as done. Resending an order from the admin queues a `RECOVER`, refunds queue a `REFUND`. If a refund happens before the plugin ever delivered the order, the pending delivery is just dropped.

The secret can go in the `secret` query param, a `secret` header, or Basic auth, matching the three auth modes of the plugin. The full schema is in the [PixelBuy docs](https://github.com/ricodevvv/pixelbuy/blob/main/docs/default/developers/schema.md).

## Customizing

Most things live in **Admin → Settings**: name, tagline, server address, Discord link, currency, language, monthly goal and the accent color. The whole palette is derived from that one hue.

If you want to go further:

- Colors and the pixel look are in `src/app/globals.css` (`--hue`, `pixel-clip`, `pixel-frame`, `.btn`).
- Store text is in `src/lib/i18n.ts`. Adding a language is copying the `en` object and adding the key to `locales`.
- Animations are in `src/components/store`. Everything checks `prefers-reduced-motion`.
- The database schema is `src/lib/db/schema.ts`. Change it, run `npm run db:generate`, then `npm run db:migrate`.

## Things to know

- Player avatars come from mc-heads.net. If it's down you get a generated sprite instead.
- Prices are stored in minor units (cents). If you change the currency after adding products, double check the prices.
- One-time purchases only. No subscriptions or gift cards yet.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server with hot reload. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run db:migrate` | Applies pending migrations. |
| `npm run db:generate` | Creates a migration from schema changes. |
| `npm run db:seed` | Demo data. |
| `npm run db:studio` | Drizzle Studio to poke at the database. |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript. |

## License

MIT, see [LICENSE](LICENSE).
