import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="font-pixel text-[clamp(6rem,25vw,14rem)] leading-none font-bold text-gradient">404</p>
      <p className="font-pixel mt-4 text-2xl">This chunk didn&apos;t load.</p>
      <p className="mt-2 text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn btn-primary mt-10">
        Back home
      </Link>
    </div>
  );
}
