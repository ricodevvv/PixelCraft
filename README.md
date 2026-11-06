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
| `RESEND_API_KEY`, `EMAIL_FROM` | Email receipts through [Resend](https://resend.com). `EMAIL_FROM` needs a domain you verified there, like `Store <store@yourdomain.com>`. Without the key no emails go out. |
| `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Image uploads from the admin to any S3 compatible bucket. Without them you paste image URLs instead. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_URL` | Endpoint for non-AWS providers, region (`us-east-1` by default) and the public base URL images are served from. |
| `APP_URL` | Public URL of the store, used for Stripe return links and the plugin config. |

## Deploying

On **Vercel**, import the repo, add the env vars (the Neon integration covers Postgres) and deploy. Migrations run during the build.

With **Docker**, `docker compose up -d --build` starts Postgres and the store on port 3000. Put it behind your reverse proxy for HTTPS.

## Stripe

Add a webhook to `https://your-store/api/stripe/webhook` with `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`, then put its signing secret in `STRIPE_WEBHOOK_SECRET`. Refunds work from either side, and the plugin gets a `REFUND` either way.

## Notifications

Paste a Discord webhook in **Admin → Settings** and every paid order gets posted to that channel with the player's head, the items and the total. Buyers who leave an email get a receipt in the store's language. Both have a test button at the bottom of the settings page.

## Sales

**Admin → Sales** schedules discounts for one category or the whole store, with a start and end date. While one is running the store shows a banner with a countdown, the old price struck through and a `-20%` badge on every product it covers. If two sales overlap, the bigger discount wins, and coupons apply on top of the sale price.

## Image uploads

Uploads work with anything that speaks S3: AWS, Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces... The bucket only needs public reads, either through a bucket policy or a public domain you put in `S3_PUBLIC_URL`. For Cloudflare R2 that's:

```bash
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=pixelcraft
S3_PUBLIC_URL=https://pub-xxxx.r2.dev
```

Images go to `products/` and `categories/` with random names, up to 4 MB each (PNG, JPG, WebP or GIF).

## Rate limits

Login, checkout, the username lookup and cart pricing are rate limited per IP, with the counters stored in Postgres so it works the same on Vercel or Docker. Five wrong admin passwords lock that IP out for 15 minutes.

## Connecting your server

In **Admin → Servers** add a server whose group matches `Options.Group` in PixelBuy's `store.yml`, paste the config block it gives you under `Supervisor`, and run `/pixelbuy reload`. Each product has a server group and a PixelBuy item id (the key in `storeitems/*.yml`, like `rank-vip`).

The plugin only talks HTTPS, and you need a PixelBuy build with the `PixelBuyWeb` URL fix.

## License

MIT, see [LICENSE](LICENSE).
