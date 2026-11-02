import Link from "next/link";
import { GithubIcon } from "@/components/ui/github-icon";
import type { Dictionary } from "@/lib/i18n";
import { DiscordIcon } from "@/components/ui/discord-icon";
import { PixelSprite } from "@/components/ui/pixel-sprite";

type Props = {
  dict: Dictionary;
  storeName: string;
  about: string;
  hue: number;
  discordUrl: string;
  categories: { slug: string; name: string }[];
};

export function Footer({ dict, storeName, about, hue, discordUrl, categories }: Props) {
  return (
    <footer className="relative mt-32 border-t-2 border-line bg-bg-2">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <PixelSprite seed={storeName} hue={hue} size={10} className="size-10" />
            <span className="font-pixel text-2xl">{storeName}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted">{about}</p>
          {discordUrl && (
            <a href={discordUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-5">
              <DiscordIcon className="size-4" /> Discord
            </a>
          )}
        </div>
        <div>
          <p className="font-label text-xs text-faint uppercase">{dict.home.categories}</p>
          <ul className="mt-4 space-y-2">
            {categories.map((category) => (
              <li key={category.slug}>
                <Link href={`/category/${category.slug}`} className="text-muted transition-colors hover:text-accent">
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="text-sm text-muted">
          <a
            href="https://github.com/ricodevvv/pixelcraft"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-accent"
          >
            <GithubIcon className="size-4" /> {dict.footer.powered}
          </a>
          <p className="mt-3 text-faint">{dict.footer.disclaimer}</p>
          <p className="mt-3 text-faint">
            © {new Date().getFullYear()} {storeName}
          </p>
        </div>
      </div>
    </footer>
  );
}
