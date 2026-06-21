'use client';

import type { MetricsResponseBody } from '@/lib/types';
import {
  SendIcon,
  CheckCircle2Icon,
  MailOpenIcon,
  MousePointerClickIcon,
  XCircleIcon,
  AlertTriangleIcon,
} from 'lucide-react';

// ─── Animated counter (CSS transition on number display) ─────────────────────

interface StatBarProps {
  value: number;    // 0–100
  color: string;    // Tailwind bg class
}

function StatBar({ value, color }: StatBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full h-1 rounded-full bg-gray-200 overflow-hidden mt-auto">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Single KPI card ──────────────────────────────────────────────────────────

interface KPICardProps {
  label:       string;
  value:       string | number;
  subValue?:   string;
  Icon:        React.ElementType;
  iconColor:   string;   // Tailwind text class
  iconBg:      string;   // Tailwind bg class
  barValue?:   number;   // 0–100 for the progress bar; omit to hide
  barColor?:   string;   // Tailwind bg class for bar fill
  accent?:     string;   // Tailwind border-l class
}

function KPICard({
  label,
  value,
  subValue,
  Icon,
  iconColor,
  iconBg,
  barValue,
  barColor = 'bg-brand-500',
  accent   = 'border-l-brand-600',
}: KPICardProps) {
  return (
    <div className={`panel p-5 flex flex-col gap-3 border-l-4 ${accent} min-h-[120px]`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight truncate">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subValue && (
            <p className="text-xs text-gray-400 font-medium">{subValue}</p>
          )}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      {barValue !== undefined && (
        <StatBar value={barValue} color={barColor} />
      )}
    </div>
  );
}

// ─── KPI card grid ────────────────────────────────────────────────────────────

interface KPICardsProps {
  metrics: MetricsResponseBody;
}

export function KPICards({ metrics }: KPICardsProps) {
  const {
    total,
    delivered,
    opened,
    clicked,
    bounced,
    dropped,
    failed,
    deliveryRate,
    openRate,
    clickRate,
  } = metrics;

  const negativeTotal = bounced + dropped + failed;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard
        label="Total Dispatched"
        value={total}
        subValue={`${metrics.pending.toLocaleString()} pending`}
        Icon={SendIcon}
        iconColor="text-brand-600"
        iconBg="bg-brand-50"
        barValue={(delivered / Math.max(total, 1)) * 100}
        barColor="bg-brand-500"
        accent="border-l-brand-600"
      />

      <KPICard
        label="Delivery Rate"
        value={`${deliveryRate.toFixed(1)}%`}
        subValue={`${delivered.toLocaleString()} delivered`}
        Icon={CheckCircle2Icon}
        iconColor="text-emerald-600"
        iconBg="bg-emerald-50"
        barValue={deliveryRate}
        barColor="bg-emerald-500"
        accent="border-l-emerald-600"
      />

      <KPICard
        label="Total Opens"
        value={opened}
        subValue={`${openRate.toFixed(1)}% open rate`}
        Icon={MailOpenIcon}
        iconColor="text-sky-600"
        iconBg="bg-sky-50"
        barValue={openRate}
        barColor="bg-sky-500"
        accent="border-l-sky-600"
      />

      <KPICard
        label="Total Clicks"
        value={clicked}
        subValue={`${clickRate.toFixed(1)}% click rate`}
        Icon={MousePointerClickIcon}
        iconColor="text-violet-600"
        iconBg="bg-violet-50"
        barValue={clickRate}
        barColor="bg-violet-500"
        accent="border-l-violet-600"
      />

      <KPICard
        label="Bounced"
        value={bounced}
        subValue={total > 0 ? `${((bounced / total) * 100).toFixed(1)}% of total` : '—'}
        Icon={XCircleIcon}
        iconColor="text-red-500"
        iconBg="bg-red-50"
        barValue={total > 0 ? (bounced / total) * 100 : 0}
        barColor="bg-red-500"
        accent="border-l-red-500"
      />

      <KPICard
        label="Dropped / Failed"
        value={dropped + failed}
        subValue={total > 0 ? `${((negativeTotal / total) * 100).toFixed(1)}% failure` : '—'}
        Icon={AlertTriangleIcon}
        iconColor="text-amber-500"
        iconBg="bg-amber-50"
        barValue={total > 0 ? (negativeTotal / total) * 100 : 0}
        barColor="bg-amber-500"
        accent="border-l-amber-500"
      />
    </div>
  );
}
