# PixelCraft

Self-hosted store for your Minecraft server that plugs into the [PixelBuy](https://github.com/ricodevvv/pixelbuy) plugin. Players type their username, pay with Stripe, and the plugin hands out the stuff in-game. Like Tebex, but on your domain and your Stripe account, with no cut taken.

It's a Next.js app with Postgres: a pixel-art storefront animated with GSAP, plus an admin panel for products, orders, coupons, servers and settings.

Demo: https://pixelcraft-liard-two.vercel.app

## Running it

You need Node 20.9+ and Postgres (`docker compose up db` gives you one).

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed   # optional demo data
npm run dev
```

The store is on http://localhost:3000 and the panel on `/admin`.

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `AUTH_SECRET` | Signs the admin cookie, 32+ chars (`openssl rand -base64 32`). |
| `ADMIN_PASSWORD` | Password for `/admin`. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payments. Without them only free orders (100% coupons) go through. |
| `APP_URL` | Public URL of the store, used for Stripe return links and the plugin config. |

## Deploying

On **Vercel**, import the repo, add the env vars (the Neon integration covers Postgres) and deploy. Migrations run during the build.

With **Docker**, `docker compose up -d --build` starts Postgres and the store on port 3000. Put it behind your reverse proxy for HTTPS.

## Stripe

Add a webhook to `https://your-store/api/stripe/webhook` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`, then put its signing secret in `STRIPE_WEBHOOK_SECRET`. Refunds work from either side, and the plugin gets a `REFUND` either way.

## Connecting your server

In **Admin → Servers** add a server whose group matches `Options.Group` in PixelBuy's `store.yml`, paste the config block it gives you under `Supervisor`, and run `/pixelbuy reload`. Each product has a server group and a PixelBuy item id (the key in `storeitems/*.yml`, like `rank-vip`).

The plugin only talks HTTPS, and you need a PixelBuy build with the `PixelBuyWeb` URL fix.

## License

MIT, see [LICENSE](LICENSE).
