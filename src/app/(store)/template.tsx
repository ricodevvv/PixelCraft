import { PixelTransition } from "@/components/store/pixel-transition";

export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PixelTransition />
      {children}
    </>
  );
}
