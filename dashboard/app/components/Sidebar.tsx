'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── SVG Icons (Lucide-style) ── */
const DashboardIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const LegionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const AthletesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-1.5-3.1"/><path d="M16 3.13a4 4 0 0 1 0 7.74"/>
  </svg>
);
const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
  </svg>
);

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon />, section: 'core' },
  { href: '/legion', label: 'Legion', icon: <LegionIcon />, section: 'core' },
  { href: '/athletes', label: 'Athletes', icon: <AthletesIcon />, section: 'core' },
];

export function Sidebar() {
  const path = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="nav-logo">R</div>

      {/* Section label */}
      <div className="nav-section">MANAGEMENT</div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ href, label, icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item ${active ? 'active' : ''}`}
          >
            <span className="nav-ico">{icon}</span>
            <span className="nav-lbl">{label}</span>
          </Link>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings */}
      <div className="nav-section">SYSTEM</div>
      <div className="nav-item" style={{ cursor: 'pointer' }}>
        <span className="nav-ico"><SettingsIcon /></span>
        <span className="nav-lbl">Settings</span>
      </div>

      {/* Footer */}
      <div style={{
        fontFamily: 'var(--font-ibm-mono, "IBM Plex Mono")',
        fontSize: '8px',
        color: 'var(--text3)',
        letterSpacing: '1.5px',
        textAlign: 'center',
        paddingTop: '12px',
        borderTop: '1px solid var(--border)',
        width: 'calc(100% - 24px)',
        marginTop: '8px',
      }}>
        RECOVO · 2026
      </div>
    </aside>
  );
}
