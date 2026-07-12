'use client';

import { useRouter } from 'next/navigation';
import { Logo } from './Logo';
import {
  BuildingIcon,
  MailPlusIcon,
  LayoutDashboardIcon,
  PaintbrushIcon,
  GitBranchIcon,
  LogOutIcon,
} from 'lucide-react';

export type ActivePage = 'vendors' | 'campaign' | 'dashboard' | 'template-builder' | 'sequences';

interface AppNavProps {
  active: ActivePage;
  userEmail?: string | null;
  onSignOut?: () => void;
  /** Override for Template Builder — opens a modal instead of routing */
  onTemplateBuilder?: () => void;
  /** Extra content rendered on the right side, before the email/signout */
  rightSlot?: React.ReactNode;
}

const NAV_ITEMS: { key: ActivePage; label: string; icon: React.ReactNode; href?: string }[] = [
  { key: 'vendors',          label: 'Vendor Campaign',   icon: <BuildingIcon className="w-3.5 h-3.5" />,         href: '/vendors' },
  { key: 'campaign',         label: 'New Campaign',      icon: <MailPlusIcon className="w-3.5 h-3.5" />,         href: '/campaign' },
  { key: 'dashboard',        label: 'Dashboard',         icon: <LayoutDashboardIcon className="w-3.5 h-3.5" />,  href: '/dashboard' },
  { key: 'template-builder', label: 'Template Builder',  icon: <PaintbrushIcon className="w-3.5 h-3.5" /> },
  { key: 'sequences',        label: 'Sequences',         icon: <GitBranchIcon className="w-3.5 h-3.5" />,        href: '/sequences' },
];

export function AppNav({ active, userEmail, onSignOut, onTemplateBuilder, rightSlot }: AppNavProps) {
  const router = useRouter();

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-20 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-6 py-2.5 flex items-center justify-between gap-4">

        {/* Logo + brand */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Logo size="sm" />
          <span className="text-sm font-bold text-gray-900 hidden sm:block">Bulk Email Engine</span>
        </div>

        {/* Nav */}
        <nav className="hidden sm:flex items-center gap-0.5">
          {NAV_ITEMS.map(({ key, label, icon, href }) => {
            const isActive = key === active;
            const baseClass = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors';
            const activeClass = 'bg-brand-50 border border-brand-200 text-brand-700 font-semibold';
            const inactiveClass = 'text-gray-500 hover:text-gray-900 hover:bg-gray-100';

            if (isActive) {
              return (
                <span key={key} className={`${baseClass} ${activeClass}`}>
                  {icon}{label}
                </span>
              );
            }

            if (key === 'template-builder') {
              return (
                <button key={key} onClick={onTemplateBuilder} className={`${baseClass} ${inactiveClass}`}>
                  {icon}{label}
                </button>
              );
            }

            return (
              <button key={key} onClick={() => router.push(href!)} className={`${baseClass} ${inactiveClass}`}>
                {icon}{label}
              </button>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {rightSlot}
          {userEmail && (
            <span className="text-xs text-gray-400 hidden md:block">{userEmail}</span>
          )}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
              title="Sign out"
            >
              <LogOutIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
