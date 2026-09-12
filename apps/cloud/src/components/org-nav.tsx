'use client';

import { usePathname } from 'next/navigation';

const ITEMS = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'clients', label: 'Clientes' },
  { key: 'team', label: 'Equipe' },
];

export function OrgNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <div className="topbar" style={{ paddingTop: 8, paddingBottom: 8 }}>
      <div className="nav">
        {ITEMS.map((it) => {
          const href = `/app/${slug}/${it.key}`;
          const active = pathname?.startsWith(href);
          return (
            <a key={it.key} href={href} className={active ? 'active' : ''}>
              {it.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
