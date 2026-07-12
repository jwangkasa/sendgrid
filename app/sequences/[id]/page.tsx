'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { firebaseAuth as auth } from "@/lib/firebase-client";
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { FlowCanvas } from './components/FlowCanvas';
import { ChevronLeftIcon, SaveIcon, PlayIcon, UsersIcon, CheckIcon } from 'lucide-react';
import type { SequenceFlow, RecipientRow } from '@/lib/types';
import { AppNav } from '@/app/components/AppNav';

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
  }, [idToken, id]);

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
    } finally {
      setRunning(false);
    }
  }, [idToken, id, running]);

  async function handleSignOut() {
    await firebaseSignOut(auth);
    router.push('/login');
  }

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', color: '#6b7280' }}>Loading…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f8fafc' }}>
      {/* Global nav */}
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
        <button onClick={() => void handleRun()} disabled={running} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: 'none', background: running ? '#d1fae5' : '#10b981', color: '#fff', fontSize: 12, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer' }}>
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
        <EnrollModal sequenceId={id} idToken={idToken} onClose={() => setShowEnroll(false)} />
      )}
    </div>
  );
}

function EnrollModal({ sequenceId, idToken, onClose }: { sequenceId: string; idToken: string; onClose: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [result, setResult] = useState<{ enrolled: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleEnroll() {
    const lines = csvText.trim().split('\n').filter(Boolean);
    if (lines.length === 0) return;
    const headers = lines[0]!.split(',').map((h) => h.trim().toUpperCase());
    const recipients: RecipientRow[] = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const row: Record<string, string> = { EMAIL_ADDRESS: '', FIRST_NAME: '', LAST_NAME: '', CATEGORY: '', COMPANY: '', PHONE_NUMBER: '', COMMENTS: '' };
      headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
      return row as RecipientRow;
    }).filter((r) => r.EMAIL_ADDRESS);

    setEnrolling(true);
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ recipients }),
      });
      const data = await res.json() as { enrolled: number };
      setResult(data);
    } finally {
      setEnrolling(false);
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string ?? '');
    reader.readAsText(file);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', fontFamily: 'Inter,Arial,sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Enroll Recipients</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#6b7280' }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Paste CSV content or upload a file. First row must be headers including <code>EMAIL_ADDRESS</code>.</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 12, cursor: 'pointer' }}>Upload CSV</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={'EMAIL_ADDRESS,FIRST_NAME,LAST_NAME\njane@acme.com,Jane,Doe'}
          rows={8}
          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }}
        />
        {result && (
          <div style={{ margin: '8px 0', padding: '8px 12px', background: '#d1fae5', borderRadius: 6, fontSize: 12, color: '#065f46' }}>
            ✓ {result.enrolled} recipients enrolled successfully
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', fontSize: 12, cursor: 'pointer' }}>Close</button>
          <button onClick={() => void handleEnroll()} disabled={enrolling || !csvText.trim()} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#0f52ba', color: '#fff', fontSize: 12, fontWeight: 600, cursor: enrolling || !csvText.trim() ? 'not-allowed' : 'pointer' }}>
            {enrolling ? 'Enrolling…' : 'Enroll'}
          </button>
        </div>
      </div>
    </div>
  );
}
