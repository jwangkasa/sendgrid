'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { WizardStep, EmailTemplate, RecipientRow } from '@/lib/types';
import { WizardNav } from './components/WizardNav';
import { StepIngestion } from './components/StepIngestion';
import { StepTemplateComposer } from './components/StepTemplateComposer';
import { StepPreview } from './components/StepPreview';
import { useRecipients } from './hooks/useRecipients';
import { TemplateBuilder } from './components/TemplateBuilder';
import { LogOutIcon, PaintbrushIcon, CheckIcon } from 'lucide-react';
import { Logo } from '@/app/components/Logo';

export default function CampaignPage() {
  const { user, loading, signOut, idToken } = useAuth();
  const router = useRouter();

  const [currentStep, setCurrentStep]       = useState<WizardStep>('ingestion');
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [campaignName, setCampaignName]     = useState('');
  const [template, setTemplate]             = useState<EmailTemplate>({
    subject:   '',
    htmlBody:  '',
    textBody:  '',
    fromEmail: '',
    fromName:  '',
  });
  const [dispatching, setDispatching]       = useState(false);
  const [dispatchError, setDispatchError]   = useState<string | null>(null);
  const [builderOpen, setBuilderOpen]       = useState(false);
  const [builderCopied, setBuilderCopied]   = useState(false);

  const { recipients, fileName, setRecipients, count } = useRecipients();

  // All hooks must be declared before any conditional returns
  const markCompleted = useCallback((step: WizardStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  }, []);

  const handleIngestComplete = useCallback((rows: RecipientRow[], name: string) => {
    setRecipients(rows, name);
    setCompletedSteps((prev) => new Set([...prev, 'ingestion' as WizardStep]));
    setCurrentStep('compose');
  }, [setRecipients]);

  const handleTemplateComplete = useCallback((tpl: EmailTemplate) => {
    setTemplate(tpl);
    setCompletedSteps((prev) => new Set([...prev, 'compose' as WizardStep]));
    setCurrentStep('preview');
  }, []);

  const handleDispatch = useCallback(
    async (batchId: string) => {
      if (!idToken) return;
      setDispatching(true);
      setDispatchError(null);

      try {
        const res = await fetch('/api/campaign/dispatch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ campaignName, recipients, template, batchId }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: res.statusText }));
          throw new Error(body.message ?? 'Dispatch failed');
        }

        const data = await res.json();
        setCompletedSteps((prev) => new Set([...prev, 'preview' as WizardStep]));
        router.push(`/dashboard?batchId=${encodeURIComponent(data.batchId)}`);
      } catch (err) {
        setDispatchError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setDispatching(false);
      }
    },
    [idToken, campaignName, recipients, template, router]
  );

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Pre-populate from Vendor Campaign page via sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('vendor_prefill');
    if (!raw) return;
    sessionStorage.removeItem('vendor_prefill');
    try {
      const { recipients: rows } = JSON.parse(raw) as { recipients: RecipientRow[] };
      if (Array.isArray(rows) && rows.length > 0) {
        setRecipients(rows, 'Vendor Selection');
        setCompletedSteps(new Set<WizardStep>(['ingestion']));
        setCurrentStep('compose');
      }
    } catch {
      // malformed sessionStorage value — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-populate from AI Follow-Up panel via sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('ai_followup_prefill');
    if (!raw) return;
    sessionStorage.removeItem('ai_followup_prefill');
    try {
      const { recipients: rows, subject, htmlBody } = JSON.parse(raw) as {
        recipients: RecipientRow[];
        subject:   string;
        htmlBody:  string;
      };
      if (Array.isArray(rows) && rows.length > 0) {
        setRecipients(rows, 'AI Follow-Up');
        setTemplate((prev) => ({ ...prev, subject: subject ?? prev.subject, htmlBody: htmlBody ?? prev.htmlBody }));
        setCompletedSteps(new Set<WizardStep>(['ingestion']));
        setCurrentStep('compose');
      }
    } catch {
      // malformed sessionStorage value — ignore
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || (!loading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
              <Logo size="sm" />
              <span className="text-sm font-semibold text-gray-900">Bulk Email Engine</span>
            </div>

          {/* Nav tabs */}
          <nav className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => router.push('/vendors')}
              className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors"
            >
              Vendor Campaign
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold">
              New Campaign
            </span>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors"
            >
              Dashboard
            </button>
            <button
              onClick={() => setBuilderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium transition-colors"
            >
              <PaintbrushIcon className="w-3 h-3" />
              Template Builder
            </button>
          </nav>

          <div className="flex items-center gap-4">
            {user && (
              <span className="text-xs text-gray-500 hidden sm:block">
                {user.email}
              </span>
            )}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              <LogOutIcon className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 flex flex-col gap-10">
        {/* Heading + Campaign name */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">New Campaign</h1>
            <p className="text-sm text-gray-500">
              Upload recipients, compose your template, preview, and dispatch.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="campaign-name" className="text-xs font-semibold text-gray-600">
              Campaign Name <span className="text-red-500">*</span>
            </label>
            <input
              id="campaign-name"
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Q3 Vendor Outreach, June Newsletter…"
              maxLength={120}
              className="w-full sm:max-w-md px-3 py-2 rounded-lg border border-gray-300 bg-white
                         text-sm text-gray-900 placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                         transition-colors"
            />
          </div>
        </div>

        {/* Wizard navigation */}
        <WizardNav
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={setCurrentStep}
        />

        {/* Step content */}
        <div className="animate-slide-up">
          {currentStep === 'ingestion' && (
            <StepIngestion onComplete={handleIngestComplete} />
          )}
          {currentStep === 'compose' && (
            <StepTemplateComposer
              initialTemplate={template}
              recipientCount={count}
              idToken={idToken}
              onComplete={handleTemplateComplete}
              onBack={() => setCurrentStep('ingestion')}
            />
          )}
          {currentStep === 'preview' && (
            <StepPreview
              recipients={recipients}
              template={template}
              fileName={fileName}
              campaignName={campaignName}
              idToken={idToken}
              dispatching={dispatching}
              dispatchError={dispatchError}
              onDispatch={handleDispatch}
              onBack={() => setCurrentStep('compose')}
            />
          )}
        </div>
      </main>

      {/* Standalone Template Builder */}
      {builderOpen && (
        <TemplateBuilder
          onApply={async (html) => {
            await navigator.clipboard.writeText(html);
            setBuilderOpen(false);
            setBuilderCopied(true);
            setTimeout(() => setBuilderCopied(false), 3000);
          }}
          onClose={() => setBuilderOpen(false)}
          idToken={idToken}
        />
      )}

      {/* Copy confirmation toast */}
      {builderCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2
                        px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm shadow-xl animate-slide-up">
          <CheckIcon className="w-4 h-4 text-emerald-400" />
          HTML copied to clipboard
        </div>
      )}
    </div>
  );
}
