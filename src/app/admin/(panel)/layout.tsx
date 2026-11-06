import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { isStripeConfigured } from "@/lib/stripe";
import { AdminNav } from "@/components/admin/nav";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { logout } from "../actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const settings = await getSettings();
  const paymentsReady = (isStripeConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET)) || isMercadoPagoConfigured();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b-2 border-line bg-bg-2 p-4 lg:sticky lg:top-0 lg:h-screen lg:border-r-2 lg:border-b-0">
        <div className="flex items-center justify-between gap-3 lg:mb-8">
          <Link href="/admin" className="flex items-center gap-2.5">
            <PixelSprite seed={settings.storeName} hue={settings.accentHue} size={10} className="size-8" />
            <span className="font-pixel text-lg leading-none">{settings.storeName}</span>
          </Link>
          <div className="flex gap-1 lg:hidden">
            <Link href="/" className="btn btn-ghost btn-sm !p-2" aria-label="Open store">
              <ExternalLink className="size-4" />
            </Link>
            <form action={logout}>
              <button type="submit" className="btn btn-ghost btn-sm !p-2" aria-label="Sign out">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <div className="mt-4 lg:mt-0">
          <AdminNav />
        </div>
        <div className="mt-8 hidden space-y-1 lg:block">
          <Link href="/" target="_blank" className="flex items-center gap-3 px-3 py-2 text-sm text-muted hover:text-text">
            <ExternalLink className="size-4" /> View store
          </Link>
          <form action={logout}>
            <button type="submit" className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted hover:text-text">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
        {!paymentsReady && (
          <div className="pixel-clip mb-6 bg-warning/10 px-4 py-3 text-sm text-warning [--step:3px]">
            No payment provider is fully set up. Add <code className="font-mono">STRIPE_SECRET_KEY</code> and{" "}
            <code className="font-mono">STRIPE_WEBHOOK_SECRET</code>, or <code className="font-mono">MERCADOPAGO_ACCESS_TOKEN</code>, to take
            real payments. Free orders (100% coupons) still work.
          </div>
        )}
        <div className="mx-auto max-w-6xl">{children}</div>
      </div>
    </div>
  );
}
