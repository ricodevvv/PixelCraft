import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const settings = await getSettings();
  return (
    <div className="grid-bg relative grid min-h-screen place-items-center overflow-hidden px-5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--accent-2)_18%,transparent),transparent_65%)]" />
      <div className="pixel-clip pixel-frame relative w-full max-w-sm p-8 [--step:6px]">
        <div className="flex items-center gap-3">
          <PixelSprite seed={settings.storeName} hue={settings.accentHue} size={10} className="size-10" />
          <div>
            <p className="font-pixel text-2xl leading-none">{settings.storeName}</p>
            <p className="font-label mt-1 text-[11px] text-muted uppercase">Admin panel</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
