import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { ArrowLeft, Server } from "lucide-react";
import { getDb, schema } from "@/lib/db";
import { getProduct } from "@/lib/catalog";
import { toCard } from "@/lib/card";
import { getDictionary } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";
import { withSales } from "@/lib/sales";
import { getSettings } from "@/lib/settings";
import { AddToCart } from "@/components/store/add-to-cart";
import { Countdown } from "@/components/store/countdown";
import { ProductArt } from "@/components/store/product-art";
import { ProductCard } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/section-heading";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const row = await getProduct((await params).slug);
  if (!row) return {};
  return {
    title: row.product.name,
    description: row.product.tagline || row.product.description.slice(0, 160) || undefined,
    openGraph: row.product.image ? { images: [row.product.image] } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const [row, settings] = await Promise.all([getProduct((await params).slug), getSettings()]);
  if (!row) notFound();
  const { product, category } = row;
  const dict = getDictionary(settings.locale);
  const money = (amount: number) => formatMoney(amount, settings.currency, settings.locale);
  const onSale = product.comparePrice !== null && product.comparePrice > product.price;

  const related = category
    ? await withSales(
        await getDb()
        .select()
        .from(schema.products)
        .where(
          and(eq(schema.products.categoryId, category.id), eq(schema.products.active, true), ne(schema.products.id, product.id)),
        )
        .limit(4),
      )
    : [];

  return (
    <div className="mx-auto max-w-7xl px-5 pt-32">
      <Link
        href={category ? `/category/${category.slug}` : "/"}
        className="font-label inline-flex items-center gap-2 text-xs text-muted uppercase transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" /> {category?.name ?? dict.product.back}
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductArt id="product-art" slug={product.slug} image={product.image} name={product.name} />

        <div className="flex flex-col justify-center" data-reveal>
          <div className="flex flex-wrap gap-2">
            {category && <span className="badge bg-surface-3 text-muted">{category.name}</span>}
            {onSale && (
              <span className="badge bg-accent-2 text-white">{product.sale ? `-${product.sale.percent}%` : dict.product.sale}</span>
            )}
          </div>
          <h1 className="font-pixel mt-4 text-5xl leading-none font-bold sm:text-6xl">{product.name}</h1>
          {product.tagline && <p className="mt-4 text-lg text-muted">{product.tagline}</p>}

          <div className="mt-8 flex items-baseline gap-3">
            <span className="font-pixel text-5xl text-accent">
              {money(product.price)}
              {product.kind === "subscription" && (
                <span className="text-2xl text-muted">{product.interval === "year" ? dict.product.perYear : dict.product.perMonth}</span>
              )}
            </span>
            {onSale && <span className="font-mono text-xl text-faint line-through">{money(product.comparePrice!)}</span>}
          </div>
          {product.sale && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-label text-[11px] text-accent-3 uppercase">
                {product.sale.name} · {dict.sale.endsIn}
              </span>
              <Countdown endsAt={product.sale.endsAt} units={dict.sale.units} size="sm" />
            </div>
          )}

          <div className="mt-8">
            <AddToCart product={toCard(product)} artId="product-art" />
          </div>

          {product.kind === "giftcard" ? (
            <p className="mt-6 text-sm text-faint">{dict.product.giftCardNote}</p>
          ) : (
            <p className="mt-6 inline-flex items-center gap-2 text-sm text-faint">
              <Server className="size-4" /> {dict.product.deliveredTo} <span className="font-mono text-muted">{product.group}</span>
            </p>
          )}
          {product.kind === "subscription" && <p className="mt-2 text-sm text-faint">{dict.product.subscriptionNote}</p>}

          {product.description && (
            <div className="pixel-clip pixel-frame mt-8 p-6 leading-relaxed whitespace-pre-line text-muted [--step:5px]">
              {product.description}
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="pt-28">
          <SectionHeading eyebrow={category?.name ?? ""} title={dict.product.related} />
          <div className="mt-10 grid grid-cols-2 gap-3 [perspective:1200px] sm:gap-5 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={toCard(item)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
