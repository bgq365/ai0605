"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "导入工作台" },
  { href: "/rules", label: "解析规则" },
  { href: "/shipments", label: "已导入运单" },
];

type AppNavProps = {
  className?: string;
};

export function AppNav({ className = "" }: AppNavProps) {
  const pathname = usePathname();

  return (
    <nav className={`flex flex-wrap gap-3 text-sm font-medium ${className}`.trim()}>
      {navItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            className={
              isActive
                ? "rounded-full border border-[#b7dfde] bg-[#f7fefe] px-4 py-2 text-[#0b6e6e]"
                : "rounded-full border border-[#b7dfde] bg-white px-4 py-2 text-[#234548] hover:bg-[#f7fefe]"
            }
            href={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
