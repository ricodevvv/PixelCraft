import { getCategories } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n";
import { isMercadoPagoConfigured } from "@/lib/mercadopago";
import { getSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe";
import { CartDrawer } from "@/components/store/cart-drawer";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { Reveal } from "@/components/store/reveal";
import { SmoothScroll } from "@/components/store/smooth-scroll";
import { StoreProvider } from "@/components/store/store-provider";
import { UserModal } from "@/components/store/user-modal";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const dict = getDictionary(settings.locale);
  const nav = categories.map(({ slug, name }) => ({ slug, name }));

  return (
    <StoreProvider
      dict={dict}
      locale={settings.locale}
      currency={settings.currency}
      storeName={settings.storeName}
      requirePremium={settings.requirePremium}
      providers={{ stripe: isStripeConfigured(), mercadopago: isMercadoPagoConfigured() }}
    >
      <SmoothScroll />
      <div className="noise pointer-events-none fixed inset-0 z-[80]" />
      <Header categories={nav} hue={settings.accentHue} />
      <main className="min-h-[70vh]">{children}</main>
      <Footer
        dict={dict}
        storeName={settings.storeName}
        about={settings.about}
        hue={settings.accentHue}
        discordUrl={settings.discordUrl}
        categories={nav}
      />
      <CartDrawer />
      <UserModal />
      <Reveal />
    </StoreProvider>
  );
}
