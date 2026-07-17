'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { firebaseAuth as auth } from "@/lib/firebase-client";
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { FlowCanvas } from './components/FlowCanvas';
import { ChevronLeftIcon, SaveIcon, PlayIcon, UsersIcon, CheckIcon, UploadCloudIcon } from 'lucide-react';
import type { SequenceFlow, RecipientRow, SequenceAuditLog } from '@/lib/types';
import { AppNav } from '@/app/components/AppNav';
import * as XLSX from 'xlsx';

const DEFAULT_FLOW: SequenceFlow = {
  nodes: [{ id: 'n-start', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Campaign Start' } }],
  edges: [],
};

export default function SequenceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [name, setName] = useState('Untitled Sequence');
  const [flow, setFlow] = useState<SequenceFlow>(DEFAULT_FLOW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveDone, setSaveDone] = useState(false);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ processed: number; emailsSent: number; completed: number; errors: number } | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [activeEnrollments, setActiveEnrollments] = useState<number | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SequenceAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const flowRef = useRef<SequenceFlow>(DEFAULT_FLOW);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return; }
      const token = await user.getIdToken();
      setIdToken(token);
      setUserEmail(user.email ?? null);
    });
    return unsub;
  }, [router]);

  const fetchEnrollmentCount = useCallback(async () => {
    if (!idToken || !id) return;
    try {
      const res = await fetch(`/api/sequences/${id}/status`, { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const data = await res.json() as { totals: { STATUS: string; CNT: number }[] };
        const active = data.totals.find((t) => t.STATUS === 'active');
        setActiveEnrollments(Number(active?.CNT ?? 0));
      }
    } catch {/* non-fatal */}
  }, [idToken, id]);

  useEffect(() => {
    if (!idToken || !id) return;
    fetch(`/api/sequences/${id}`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((data: { name?: string; flow?: SequenceFlow }) => {
        if (data.name) setName(data.name);
        if (data.flow?.nodes?.length) { setFlow(data.flow); flowRef.current = data.flow; }
      })
      .catch(() => {/* new sequence */})
      .finally(() => setLoading(false));
    void fetchEnrollmentCount();
  }, [idToken, id, fetchEnrollmentCount]);

  const handleSave = useCallback(async () => {
    if (!idToken || saving) return;
    setSaving(true);
    try {
      await fetch(`/api/sequences/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ name, flow: flowRef.current }),
      });
      setSaveDone(true);
      setTimeout(() => setSaveDone(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [idToken, id, name, saving]);

  const fetchAuditLogs = useCallback(async () => {
    if (!idToken || !id) return;
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/sequences/${id}/audit`, { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const data = await res.json() as { logs: SequenceAuditLog[] };
        setAuditLogs(data.logs);
      }
    } finally {
      setAuditLoading(false);
    }
  }, [idToken, id]);

  const handleRun = useCallback(async () => {
    if (!idToken || running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/sequences/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { processed: number; emailsSent: number; completed: number; errors: number };
      setRunResult(data);
      void fetchAuditLogs();
    } finally {
      setRunning(false);
    }
  }, [idToken, id, running, fetchAuditLogs]);

  async function handleSignOut() {
    await firebaseSignOut(auth);
    router.push('/login');
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', color: '#6b7280' }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f8fafc' }}>
      <AppNav
        active="sequences"
        userEmail={userEmail}
        onSignOut={() => void handleSignOut()}
      />

      {/* Sequence toolbar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button onClick={() => router.push('/sequences')} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500 }}>
          <ChevronLeftIcon style={{ width: 14, height: 14 }} />
          Back
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 10px', color: '#111827', fontSize: 14, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={() => setShowEnroll(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <UsersIcon style={{ width: 13, height: 13 }} /> Enroll Recipients
        </button>
        <button onClick={() => void handleRun()} disabled={running || activeEnrollments === 0} title={activeEnrollments === 0 ? 'No active enrollments' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', background: (running || activeEnrollments === 0) ? '#d1fae5' : '#10b981', color: (running || activeEnrollments === 0) ? '#6b7280' : '#fff', fontSize: 12, fontWeight: 600, cursor: (running || activeEnrollments === 0) ? 'not-allowed' : 'pointer', opacity: activeEnrollments === 0 ? 0.5 : 1 }}>
          <PlayIcon style={{ width: 13, height: 13 }} /> {running ? 'Running…' : 'Run Now'}
        </button>
        <button onClick={() => void handleSave()} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', background: saveDone ? '#10b981' : '#0f52ba', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {saveDone ? <CheckIcon style={{ width: 13, height: 13 }} /> : <SaveIcon style={{ width: 13, height: 13 }} />}
          {saving ? 'Saving…' : saveDone ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div style={{ padding: '8px 16px', background: runResult.errors > 0 ? '#fef3c7' : '#d1fae5', fontSize: 12, color: runResult.errors > 0 ? '#92400e' : '#065f46', display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          <span>Run complete — <strong>{runResult.processed}</strong> processed, <strong>{runResult.emailsSent}</strong> emails sent, <strong>{runResult.completed}</strong> completed, <strong>{runResult.errors}</strong> errors</span>
          <button onClick={() => setRunResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'inherit', opacity: 0.6 }}>✕</button>
        </div>
      )}

      {/* Execution History panel */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => {
              const next = !showAudit;
              setShowAudit(next);
              if (next) void fetchAuditLogs();
            }}
            style={{ flex: 1, padding: '6px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', textAlign: 'left' }}
          >
            <span style={{ fontSize: 10, transition: 'transform 0.15s', display: 'inline-block', transform: showAudit ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            Execution History
            {auditLogs.length > 0 && <span style={{ marginLeft: 4, color: '#9ca3af', fontWeight: 400 }}>({auditLogs.length})</span>}
            {auditLoading && <span style={{ marginLeft: 8, color: '#9ca3af', fontWeight: 400 }}>Loading…</span>}
          </button>
          {showAudit && (
            <button
              onClick={() => void fetchAuditLogs()}
              disabled={auditLoading}
              title="Refresh engagement counts"
              style={{ marginRight: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#6b7280', fontSize: 11, fontWeight: 600, cursor: auditLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
            >
              ↻ Refresh
            </button>
          )}
        </div>
        {showAudit && (
          <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid #f1f5f9' }}>
            {auditLogs.length === 0 && !auditLoading ? (
              <div style={{ padding: '16px', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>No runs yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                    {['Ran At', 'Processed', 'Emails Sent', 'Opened', 'Clicked', 'Completed', 'Errors'].map((h) => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Ran At' ? 'left' : 'center', fontWeight: 700, color: '#6b7280', fontSize: 10, letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', color: '#374151', whiteSpace: 'nowrap' }}>
                        {new Date(log.ranAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#374151' }}>{log.processed}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#374151' }}>{log.emailsSent}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: log.opens > 0 ? 700 : 400, color: log.opens > 0 ? '#0f52ba' : '#374151' }}>{log.opens}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: log.clicks > 0 ? 700 : 400, color: log.clicks > 0 ? '#7c3aed' : '#374151' }}>{log.clicks}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#374151' }}>{log.completed}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: log.errors > 0 ? 700 : 400, color: log.errors > 0 ? '#d97706' : '#374151' }}>{log.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <FlowCanvas
          initialFlow={flow}
          idToken={idToken}
          onChange={(f) => { flowRef.current = f; }}
        />
      </div>

      {/* Enroll modal */}
      {showEnroll && idToken && (
        <EnrollModal sequenceId={id} idToken={idToken} onClose={() => { setShowEnroll(false); void fetchEnrollmentCount(); }} />
      )}
    </div>
  );
}

// ── Wizard step header ────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, title: 'Upload Recipients', sub: 'Import .xlsx / .csv file' },
  { n: 2, title: 'Sequence Diagram', sub: 'Review your flow' },
  { n: 3, title: 'Enroll & Run',     sub: 'Start the automation' },
];

function StepHeader({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 28 }}>
      {STEPS.map((s, idx) => (
        <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', flex: idx < STEPS.length - 1 ? 1 : undefined }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, border: `2px solid ${current === s.n ? '#3b82f6' : current > s.n ? '#3b82f6' : '#d1d5db'}`,
              background: current > s.n ? '#3b82f6' : '#fff',
              color: current === s.n ? '#3b82f6' : current > s.n ? '#fff' : '#9ca3af',
            }}>
              {current > s.n ? '✓' : s.n}
            </div>
            <div style={{ marginTop: 6, textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: current === s.n ? '#3b82f6' : '#6b7280' }}>{s.title}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{s.sub}</div>
            </div>
          </div>
          {idx < STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: current > s.n ? '#3b82f6' : '#e5e7eb', marginTop: 17 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Enroll modal ──────────────────────────────────────────────────────────────
function EnrollModal({ sequenceId, idToken, onClose }: { sequenceId: string; idToken: string; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const recipientsRef = useRef<RecipientRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<{ enrolled: number; skipped: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseFile(file: File) {
    setParseError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setParseError('Unsupported file type. Please upload .xlsx, .xls, or .csv.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data, { type: ext === 'csv' ? 'string' : 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
        if (rows.length === 0) { setParseError('File is empty.'); return; }
        const normalised: RecipientRow[] = rows.map((r) => {
          const upper: Record<string, string> = {};
          for (const k of Object.keys(r)) upper[k.trim().toUpperCase()] = String(r[k] ?? '');
          return {
            EMAIL_ADDRESS: upper['EMAIL_ADDRESS'] ?? '',
            FIRST_NAME:    upper['FIRST_NAME']    ?? '',
            LAST_NAME:     upper['LAST_NAME']     ?? '',
            CATEGORY:      upper['CATEGORY']      ?? '',
            COMPANY:       upper['COMPANY']       ?? '',
            PHONE_NUMBER:  upper['PHONE_NUMBER']  ?? '',
            COMMENTS:      upper['COMMENTS']      ?? '',
          };
        }).filter((r) => r.EMAIL_ADDRESS.trim());
        if (normalised.length === 0) { setParseError('No rows with EMAIL_ADDRESS found.'); return; }
        recipientsRef.current = normalised;
        setRecipients(normalised);
        setStep(2);
      } catch {
        setParseError('Could not parse file. Make sure it is a valid spreadsheet.');
      }
    };
    if (ext === 'csv') reader.readAsText(file);
    else reader.readAsBinaryString(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }

  async function handleEnroll() {
    setEnrolling(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ recipients: recipientsRef.current }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        setParseError(err.message ?? 'Enrollment failed. Please try again.');
        return;
      }
      const data = await res.json() as { enrolled: number; skipped: number };
      setResult(data);
      setStep(3);
    } finally {
      setEnrolling(false);
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modalStyle: React.CSSProperties = {
    background: '#f8fafc', borderRadius: 16, padding: 32, width: 640,
    boxShadow: '0 24px 64px rgba(0,0,0,0.25)', fontFamily: 'Inter,Arial,sans-serif',
    maxHeight: '90vh', overflowY: 'auto',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalStyle}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Enroll Recipients</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}>✕</button>
        </div>

        <StepHeader current={step} />

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Upload Recipient List</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748b' }}>
              Drop an <span style={{ color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>.xlsx</span> file. Required column: <span style={{ color: '#3b82f6', fontFamily: 'monospace', fontWeight: 600 }}>EMAIL_ADDRESS</span>.
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#3b82f6' : '#cbd5e1'}`,
                borderRadius: 10, padding: '48px 24px', textAlign: 'center',
                cursor: 'pointer', background: dragOver ? '#eff6ff' : '#f8fafc',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UploadCloudIcon style={{ width: 26, height: 26, color: '#94a3b8' }} />
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 }}>Drop file here or click to browse</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>.xlsx · .xls · .csv — max 50,000 rows</div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFileInput} />

            {parseError && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#dc2626', border: '1px solid #fecaca' }}>
                ⚠ {parseError}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Sequence Diagram summary ── */}
        {step === 2 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Sequence Diagram</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>Review before enrolling.</p>

            {/* File summary */}
            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>{fileName}</div>
                <div style={{ fontSize: 11, color: '#4ade80' }}>{recipients.length.toLocaleString()} valid recipients found</div>
              </div>
            </div>

            {/* Preview table */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['EMAIL_ADDRESS', 'FIRST_NAME', 'LAST_NAME', 'COMPANY'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 10, letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recipients.slice(0, 5).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 12px', color: '#0f172a' }}>{r.EMAIL_ADDRESS}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.FIRST_NAME}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.LAST_NAME}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.COMPANY}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recipients.length > 5 && (
                <div style={{ padding: '6px 12px', background: '#f8fafc', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
                  + {(recipients.length - 5).toLocaleString()} more rows
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep(1); setRecipients([]); setFileName(null); }} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                ← Back
              </button>
              <button onClick={() => void handleEnroll()} disabled={enrolling} style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#0f52ba', color: '#fff', fontSize: 13, fontWeight: 700, cursor: enrolling ? 'not-allowed' : 'pointer' }}>
                {enrolling ? 'Enrolling…' : `Enroll ${recipients.length.toLocaleString()} Recipients →`}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Done ── */}
        {step === 3 && result && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 32, border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Enrollment Complete!</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b' }}>
              <strong style={{ color: '#0f52ba', fontSize: 22 }}>{result.enrolled.toLocaleString()}</strong> recipients enrolled into this sequence.
            </p>
            {result.skipped > 0 && (
              <p style={{ margin: '-12px 0 20px', fontSize: 12, color: '#94a3b8' }}>
                {result.skipped.toLocaleString()} already-active recipient{result.skipped !== 1 ? 's' : ''} skipped.
              </p>
            )}
            <p style={{ margin: '0 0 24px', fontSize: 12, color: '#94a3b8' }}>Click <strong>Run Now</strong> in the toolbar to start processing.</p>
            <button onClick={onClose} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: '#0f52ba', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
