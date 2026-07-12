'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { firebaseAuth as auth } from "@/lib/firebase-client";
import { onAuthStateChanged } from 'firebase/auth';
import { PlusIcon, GitBranchIcon, PlayCircleIcon, PauseCircleIcon, FileEditIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface SequenceSummary {
  ID: string; NAME: string; STATUS: string; CREATED_AT: string; UPDATED_AT: string;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:   { bg: '#f1f5f9', color: '#475569' },
  active:  { bg: '#d1fae5', color: '#065f46' },
  paused:  { bg: '#fef3c7', color: '#92400e' },
};

export default function SequencesPage() {
  const router = useRouter();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [sequences, setSequences] = useState<SequenceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/login'); return; }
      const token = await user.getIdToken();
      setIdToken(token);
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!idToken) return;
    fetch('/api/sequences', { headers: { Authorization: `Bearer ${idToken}` } })
      .then((r) => r.json())
      .then((d: { sequences?: SequenceSummary[] }) => setSequences(d.sequences ?? []))
      .finally(() => setLoading(false));
  }, [idToken]);

  async function handleCreate() {
    if (!idToken || creating) return;
    setCreating(true);
    try {
      const id = uuidv4();
      // Create in DB then navigate — use a placeholder name
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ name: 'Untitled Sequence', flow: { nodes: [{ id: 'n-start', type: 'start', position: { x: 250, y: 50 }, data: { label: 'Campaign Start' } }], edges: [] } }),
      });
      const data = await res.json() as { id?: string };
      router.push(`/sequences/${data.id ?? id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter,Arial,sans-serif' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0f52ba,#1a6fd4)', padding: '18px 32px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>Email Sequences</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(214,234,255,0.85)' }}>
              Automate follow-up emails based on engagement — drag, drop, and connect nodes to build your flow
            </p>
          </div>
          <button onClick={() => void handleCreate()} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 8, border: 'none', background: '#fff', color: '#0f52ba', fontSize: 13, fontWeight: 700, cursor: creating ? 'not-allowed' : 'pointer' }}>
            <PlusIcon style={{ width: 15, height: 15 }} />
            {creating ? 'Creating…' : 'New Sequence'}
          </button>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: 960, margin: '0 auto' }}>
        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', paddingTop: 60 }}>Loading…</div>
        ) : sequences.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 80, color: '#94a3b8' }}>
            <GitBranchIcon style={{ width: 48, height: 48, margin: '0 auto 16px', opacity: 0.4 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No sequences yet</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Create your first automated email sequence to get started</div>
            <button onClick={() => void handleCreate()} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#0f52ba', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Create Sequence
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 16 }}>
            {sequences.map((seq) => {
              const sc = STATUS_COLOR[seq.STATUS] ?? STATUS_COLOR['draft']!;
              return (
                <div key={seq.ID} onClick={() => router.push(`/sequences/${seq.ID}`)} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', flex: 1, marginRight: 8 }}>{seq.NAME}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color, letterSpacing: '0.06em', flexShrink: 0 }}>
                      {seq.STATUS.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Updated {new Date(seq.UPDATED_AT).toLocaleDateString()}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280' }}>
                      <FileEditIcon style={{ width: 12, height: 12 }} /> Edit flow
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                      {seq.STATUS === 'active'
                        ? <><PlayCircleIcon style={{ width: 12, height: 12, color: '#10b981' }} /> Active</>
                        : seq.STATUS === 'paused'
                        ? <><PauseCircleIcon style={{ width: 12, height: 12, color: '#f59e0b' }} /> Paused</>
                        : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
