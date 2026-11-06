import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ItemImage } from "@/components/ui/item-image";

type Props = { slug: string; name: string; description: string; image: string | null; count: number; index: number; itemsLabel: string };

export function CategoryTile({ slug, name, description, image, count, index, itemsLabel }: Props) {
  return (
    <Link
      href={`/category/${slug}`}
      data-reveal
      className="group pixel-clip pixel-frame relative flex min-h-56 flex-col justify-between overflow-hidden p-6 [--step:6px] hover:[--frame:var(--accent-deep)]"
    >
      <div className="absolute -top-6 -right-6 size-40 opacity-20 transition-all duration-500 group-hover:scale-125 group-hover:rotate-12 group-hover:opacity-50">
        <ItemImage src={image} seed={`category-${slug}`} className="size-full object-contain" spriteClassName="size-full" />
      </div>
      <span className="font-label text-xs text-faint">{String(index + 1).padStart(2, "0")}</span>
      <div className="relative">
        <h3 className="font-pixel text-3xl leading-none transition-colors group-hover:text-accent">{name}</h3>
        {description && <p className="mt-2 line-clamp-2 max-w-xs text-sm text-muted">{description}</p>}
        <div className="mt-5 flex items-center justify-between">
          <span className="badge bg-surface-3 text-muted">{count} {itemsLabel}</span>
          <span className="pixel-clip grid size-10 place-items-center bg-surface-3 transition-all duration-300 group-hover:bg-accent group-hover:text-accent-ink [--step:3px]">
            <ArrowUpRight className="size-5 transition-transform duration-300 group-hover:rotate-45" />
          </span>
        </div>
      </div>
    </Link>
  );
}
