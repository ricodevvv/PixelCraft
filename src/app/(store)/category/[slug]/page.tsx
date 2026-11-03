import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoryWithProducts } from "@/lib/catalog";
import { toCard } from "@/lib/card";
import { getDictionary } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { PixelSprite } from "@/components/ui/pixel-sprite";
import { ProductCard } from "@/components/store/product-card";
import { SectionHeading } from "@/components/store/section-heading";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getCategoryWithProducts((await params).slug);
  return data ? { title: data.category.name, description: data.category.description || undefined } : {};
}

export default async function CategoryPage({ params }: Props) {
  const [data, settings] = await Promise.all([getCategoryWithProducts((await params).slug), getSettings()]);
  if (!data) notFound();
  const dict = getDictionary(settings.locale);
  const { category, products } = data;

  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,color-mix(in_oklch,var(--accent-2)_20%,transparent),transparent)]" />
      <div className="grid-bg absolute inset-x-0 top-0 -z-10 h-[420px] [mask-image:linear-gradient(black,transparent)]" />
      <section className="mx-auto max-w-7xl px-5 pt-36">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          <div className="slot pixel-clip grid size-28 shrink-0 place-items-center [--step:6px]" data-reveal>
            {category.image ? (
              <img src={category.image} alt="" className="size-20 object-contain" />
            ) : (
              <PixelSprite seed={`category-${category.slug}`} className="size-20" />
            )}
          </div>
          <div className="flex-1">
            <SectionHeading eyebrow={`${products.length} ${dict.product.items}`} title={category.name} />
            {category.description && <p className="mt-4 max-w-2xl text-muted">{category.description}</p>}
          </div>
        </div>

        {products.length === 0 ? (
          <p className="mt-16 text-muted">{dict.product.empty}</p>
        ) : (
          <div className="mt-14 grid grid-cols-2 gap-3 [perspective:1200px] sm:gap-5 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={toCard(product)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
