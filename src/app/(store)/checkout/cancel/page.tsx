import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { PixelSprite } from "@/components/ui/pixel-sprite";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

export default async function CancelPage() {
  const dict = getDictionary((await getSettings()).locale);
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center px-5 pt-32 text-center">
      <PixelSprite seed="cancelled" size={10} className="size-24" />
      <h1 className="font-pixel mt-8 text-5xl leading-none font-bold">{dict.cancel.title}</h1>
      <p className="mt-4 text-muted">{dict.cancel.text}</p>
      <Link href="/" className="btn btn-primary mt-10">
        {dict.success.back}
      </Link>
    </div>
  );
}
