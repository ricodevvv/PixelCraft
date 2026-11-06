# PixelCraft

Self-hosted store for your Minecraft server that plugs into the [PixelBuy](https://github.com/ricodevvv/pixelbuy) plugin. Like Tebex, but on your domain and your own Stripe or Mercado Pago account.

Ranks, kits, subscriptions, gift cards, gifts, sales, coupons, and an admin panel for all of it.

Demo: https://pixelcraft-liard-two.vercel.app

## Running it

You need Node 20.9+ and Postgres (`docker compose up db` gives you one).

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

The store is on http://localhost:3000 and the panel on `/admin`. Every variable is in `.env.example`; only `DATABASE_URL`, `AUTH_SECRET` and `ADMIN_PASSWORD` are required.

## Deploying

On **Vercel**, import the repo, add the env vars and deploy. With **Docker**, `docker compose up -d --build`. Migrations run on their own.

For Stripe, add a webhook to `/api/stripe/webhook` with the `checkout.session.*`, `charge.refunded`, `invoice.paid` and `customer.subscription.*` events. Mercado Pago needs nothing else.

## Connecting your server

In **Admin → Servers** add a server with the same group as PixelBuy's `store.yml`, paste the config it gives you and run `/pixelbuy reload`.

## License

MIT, see [LICENSE](LICENSE).
