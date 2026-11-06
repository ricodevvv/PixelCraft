import { Crown } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import {
  getCategories,
  getFeaturedProducts,
  getMonthRevenue,
  getProductCounts,
  getRecentSupporters,
  getTopSupporter,
} from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { CategoryTile } from "@/components/store/category-tile";
import { GoalBar } from "@/components/store/goal-bar";
import { Hero } from "@/components/store/hero";
import { PlayerAvatar } from "@/components/store/player-avatar";
import { ProductCard } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/section-heading";
import { SupportersMarquee } from "@/components/store/supporters-marquee";
import { formatMoney } from "@/lib/money";
import { toCard } from "@/lib/card";
import { getActiveSales, withSales } from "@/lib/sales";
import { SaleBanner } from "@/components/store/sale-banner";

async function getShowcase() {
  const featured = await getFeaturedProducts(8);
  if (featured.length > 0) return featured;
  const latest = await getDb()
    .select()
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .orderBy(desc(schema.products.createdAt))
    .limit(8);
  return withSales(latest);
}

export default async function HomePage() {
  const settings = await getSettings();
  const dict = getDictionary(settings.locale);
  const [products, categories, counts, supporters, top, revenue, sales] = await Promise.all([
    getShowcase(),
    getCategories(),
    getProductCounts(),
    getRecentSupporters(12),
    getTopSupporter(),
    settings.monthlyGoal > 0 ? getMonthRevenue() : Promise.resolve(0),
    getActiveSales(),
  ]);
  const sale = sales[0];

  return (
    <>
      <Hero
        tagline={settings.tagline}
        serverAddress={settings.serverAddress}
        discordUrl={settings.discordUrl}
        hue={settings.accentHue}
        announcement={settings.announcement}
      />

      {sale && (
        <div className="px-5">
          <SaleBanner
            name={sale.name}
            percent={sale.percent}
            endsAt={sale.endsAt.toISOString()}
            categoryName={sale.categoryName}
            href={sale.categorySlug ? `/category/${sale.categorySlug}` : "#store"}
          />
        </div>
      )}

      <SupportersMarquee supporters={supporters} />

      <section id="store" className="mx-auto max-w-7xl scroll-mt-28 px-5 pt-24">
        <SectionHeading eyebrow={dict.home.featured} title={dict.home.featuredTitle} />
        {products.length === 0 ? (
          <p className="mt-10 text-muted">{dict.product.empty}</p>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-3 [perspective:1200px] sm:gap-5 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={toCard(product)} />
            ))}
          </div>
        )}
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pt-28">
          <SectionHeading eyebrow={dict.home.categories} title={dict.home.categoriesTitle} />
          <div className={`mt-10 grid gap-5 sm:grid-cols-2 ${categories.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
            {categories.map((category, index) => (
              <CategoryTile
                key={category.id}
                slug={category.slug}
                name={category.name}
                description={category.description}
                image={category.image}
                count={counts.get(category.id) ?? 0}
                index={index}
                itemsLabel={dict.product.items}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pt-28 lg:grid-cols-[1.6fr_1fr]">
        {settings.monthlyGoal > 0 ? (
          <GoalBar current={revenue} goal={settings.monthlyGoal} />
        ) : (
          <div className="pixel-clip pixel-frame p-8 [--step:6px]" data-reveal>
            <span className="eyebrow">{settings.storeName}</span>
            <p className="font-pixel mt-4 text-2xl leading-snug text-balance">{settings.about}</p>
          </div>
        )}
        <div className="pixel-clip pixel-frame relative overflow-hidden p-6 [--fill:color-mix(in_oklch,var(--accent-2)_14%,var(--surface))] [--step:6px] sm:p-8" data-reveal>
          <span className="eyebrow !text-accent-3">
            <Crown className="size-4" /> {dict.home.topSupporter}
          </span>
          {top ? (
            <div className="mt-5 flex items-center gap-5">
              <PlayerAvatar name={top.playerName} size={128} body className="h-28 w-auto" />
              <div>
                <p className="font-pixel text-3xl">{top.playerName}</p>
                <p className="font-mono mt-1 text-accent">{formatMoney(top.total, settings.currency, settings.locale)}</p>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-muted">{dict.home.nobody}</p>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-28">
        <SectionHeading eyebrow={dict.home.how} title={settings.storeName} />
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dict.home.steps.map((step, index) => (
            <li key={step.title} className="pixel-clip pixel-frame p-6 [--step:5px]" data-reveal>
              <span className="font-pixel text-6xl leading-none text-accent/25">{index + 1}</span>
              <h3 className="font-pixel mt-4 text-xl">{step.title}</h3>
              <p className="mt-2 text-sm text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
