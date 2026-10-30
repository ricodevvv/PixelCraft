import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/500.css";
import "@fontsource/pixelify-sans/600.css";
import "@fontsource/pixelify-sans/700.css";
import "@fontsource/silkscreen/400.css";
import "./globals.css";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: { default: settings.storeName, template: `%s · ${settings.storeName}` },
    description: settings.tagline,
    metadataBase: process.env.APP_URL ? new URL(process.env.APP_URL) : undefined,
    openGraph: { title: settings.storeName, description: settings.tagline, type: "website" },
  };
}

export const viewport: Viewport = {
  themeColor: "#07060d",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <html
      lang={settings.locale}
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      style={{ "--hue": settings.accentHue } as React.CSSProperties}
    >
      <body>{children}</body>
    </html>
  );
}
