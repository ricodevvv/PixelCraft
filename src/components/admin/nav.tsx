"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgePercent, Boxes, FolderTree, Gift, LayoutDashboard, Receipt, Server, Settings, TicketPercent } from "lucide-react";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Receipt },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/sales", label: "Sales", icon: BadgePercent },
  { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  { href: "/admin/gift-cards", label: "Gift cards", icon: Gift },
  { href: "/admin/servers", label: "Servers", icon: Server },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`pixel-clip flex shrink-0 items-center gap-3 px-3 py-2.5 text-sm transition-colors [--step:3px] ${
              active ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-3 hover:text-text"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
