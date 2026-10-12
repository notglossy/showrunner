'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/design', label: 'Theme' },
  { href: '/design/fonts', label: 'Fonts' },
  { href: '/design/instructions', label: 'Instructions' },
];

/** Design section tab bar; the active tab is the exact pathname match. */
export function DesignTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Design" className="border-ink flex gap-1 border-b pb-px">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`label-mono focus-visible:outline-signal-tint rounded-t px-4 py-2 ${
              active ? 'bg-ink text-white' : 'text-subtle hover:bg-gunmetal hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
