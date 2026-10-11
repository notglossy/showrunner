'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Logo } from '@/components/logo';
import { api } from '@/lib/client/api';

const REPO_URL = 'https://github.com/notglossy/showrunner';

const LINKS = [
  { href: '/devices', label: 'Devices' },
  { href: '/screens', label: 'Screens' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/design', label: 'Design' },
  { href: '/settings', label: 'Settings' },
];

/** Dashboard navigation: sidebar from md up, a menu bar with a dropdown on phones. */
export function Nav({ version }: { version?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  // Phones only: the links sit behind a menu button. From md up the sidebar always shows them.
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <header className="bg-ink text-steel shrink-0 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:gap-10 md:px-6 md:py-8">
      <div className="flex h-14 items-center justify-between px-4 md:h-auto md:px-0">
        <Link
          href="/devices"
          onClick={() => setOpen(false)}
          className="focus-visible:outline-signal-tint flex"
        >
          <Logo tone="dark" className="h-4.75 w-auto md:h-6" />
        </Link>
        <button
          ref={toggleRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="main-menu"
          onClick={() => setOpen((o) => !o)}
          className="focus-visible:outline-signal-tint -mr-2 rounded p-2 text-white md:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        </button>
      </div>
      <div
        id="main-menu"
        className={`${open ? 'flex' : 'hidden'} flex-col gap-6 px-4 pt-1 pb-5 md:flex md:flex-1 md:gap-10 md:p-0`}
      >
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {LINKS.map((link, i) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`label-mono focus-visible:outline-signal-tint flex gap-3 rounded p-3 ${active ? 'bg-signal text-white' : 'text-steel hover:bg-gunmetal hover:text-white'}`}
              >
                {/* Zero-padded index, the dashboard's numbered-list voice. */}
                <span className={active ? undefined : 'text-concrete'}>{`0${i + 1}.`}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between gap-4 md:mt-auto">
          <button
            type="button"
            onClick={logout}
            className="label-mono text-concrete focus-visible:outline-signal-tint hover:text-white"
          >
            Log out
          </button>
          <div className="flex items-center gap-3">
            {version && (
              <a
                href={`${REPO_URL}/releases/tag/${encodeURIComponent(version)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="caption-mono text-concrete focus-visible:outline-signal-tint normal-case hover:text-white"
              >
                {version}
              </a>
            )}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ShowRunner on GitHub"
              title="ShowRunner on GitHub"
              className="text-concrete focus-visible:outline-signal-tint -m-2 rounded p-2 hover:text-white"
            >
              {/* GitHub mark (Octicons, MIT). */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
