'use client';

import { useRef, useState } from 'react';
import { XIcon, WandIcon, UploadIcon } from 'lucide-react';
import type { SequenceNode } from '@/lib/types';
import type { TemplateState } from '@/app/campaign/components/TemplateBuilder/types';
import { TemplateBuilder } from '@/app/campaign/components/TemplateBuilder';
import { parseAndConvertJson } from '@/app/campaign/components/TemplateBuilder/importConverter';
import { exportBodyHtml } from '@/app/campaign/components/TemplateBuilder/htmlExporter';

const STATUS_OPTIONS = ['Delivered', 'Opened', 'Clicked', 'Bounced', 'Dropped'];

interface Props {
  node: SequenceNode;
  idToken: string | null;
  onUpdate: (id: string, data: Partial<SequenceNode['data']>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function NodeConfigPanel({ node, idToken, onUpdate, onDelete, onClose }: Props) {
  const [aiPrompt, setAiPrompt] = useState(node.data.aiPrompt ?? '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const jsonRef = useRef<HTMLInputElement>(null);

  const d = node.data;

  async function handleAiGenerate() {
    const prompt = aiPrompt.trim();
    if (!prompt || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/campaign/generate-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ description: prompt }),
      });
      const data = await res.json() as { sections?: { type: string; content: string; href?: string }[]; message?: string };
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);

      const sections = data.sections ?? [];
      const heading = sections.find((s) => s.type === 'heading')?.content ?? '';
      const body = sections.filter((s) => s.type === 'body').map((s) => s.content).join('\n\n');
      const cta = sections.find((s) => s.type === 'cta');

      const subject = heading || prompt.slice(0, 80);
      const htmlBody = `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
  <tr><td align="center" style="padding:24px 0;">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;background:#ffffff;border-radius:6px;overflow:hidden;">
      ${heading ? `<tr><td style="font-size:24px;color:#111827;font-weight:bold;text-align:center;padding:8px;font-family:Arial,Helvetica,sans-serif;line-height:1.5">${heading}</td></tr>` : ''}
      ${body ? `<tr><td style="font-size:14px;color:#374151;font-weight:normal;text-align:left;padding:8px;font-family:Arial,Helvetica,sans-serif;line-height:1.5">${body.replace(/\n/g, '<br/>')}</td></tr>` : ''}
      ${cta ? `<tr><td style="text-align:center;padding:8px 0;"><a href="${cta.href ?? '#'}" style="background-color:#4f46e5;color:#ffffff;font-size:14px;border-radius:6px;display:inline-block;padding:10px 24px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:bold">${cta.content}</a></td></tr>` : ''}
    </table>
  </td></tr>
</table>`;

      onUpdate(node.id, {
        aiPrompt: prompt,
        template: { ...d.template, subject, htmlBody, textBody: '', fromEmail: d.template?.fromEmail ?? '', fromName: d.template?.fromName ?? '' },
      });
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setAiLoading(false);
    }
  }

  function handleJsonUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const state: TemplateState = parseAndConvertJson(ev.target?.result as string);
        const htmlBody = exportBodyHtml(state);
        onUpdate(node.id, {
          template: { ...d.template, htmlBody, textBody: '', subject: d.template?.subject ?? '', fromEmail: d.template?.fromEmail ?? '', fromName: d.template?.fromName ?? '' },
        });
      } catch {
        alert('Invalid template JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
    background: '#fff', borderLeft: '1px solid #e2e8f0',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
    zIndex: 100, overflowY: 'auto',
    fontFamily: 'Inter,Arial,sans-serif', display: 'flex', flexDirection: 'column',
  };

  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.06em', marginBottom: 4, display: 'block' };
  const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
  const sectionStyle: React.CSSProperties = { padding: '14px 16px', borderBottom: '1px solid #f1f5f9' };

  const nodeTypeColor: Record<string, string> = { start: '#0f52ba', email: '#6366f1', wait: '#d97706', condition: '#16a34a', end: '#6b7280' };
  const color = nodeTypeColor[node.type] ?? '#6b7280';

  return (
    <>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: color, color: '#fff' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', opacity: 0.8 }}>{node.type.toUpperCase()} NODE</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{d.label ?? 'Configure'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#fff', display: 'flex' }}>
            <XIcon style={{ width: 14, height: 14 }} />
          </button>
        </div>

        <div style={{ flex: 1 }}>
          {/* Label (all node types) */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={d.label ?? ''} onChange={(e) => onUpdate(node.id, { label: e.target.value })} placeholder="e.g. Follow-up Email" />
          </div>

          {/* START node */}
          {node.type === 'start' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Source Batch ID</label>
              <input style={inputStyle} value={d.batchId ?? ''} onChange={(e) => onUpdate(node.id, { batchId: e.target.value })} placeholder="Paste a batch ID from Dashboard" />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Recipients enrolled into this sequence will be the ones from this campaign batch.</div>
            </div>
          )}

          {/* WAIT node */}
          {node.type === 'wait' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Wait mode</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {(['days', 'date'] as const).map((mode) => (
                  <button key={mode} onClick={() => onUpdate(node.id, mode === 'days' ? { date: null } : { days: undefined })}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${(mode === 'date') === !!d.date ? color : '#e2e8f0'}`, background: (mode === 'date') === !!d.date ? `${color}15` : '#f9fafb', fontSize: 12, cursor: 'pointer', color: (mode === 'date') === !!d.date ? color : '#374151', fontWeight: (mode === 'date') === !!d.date ? 700 : 400 }}>
                    {mode === 'days' ? 'Wait X days' : 'Specific date'}
                  </button>
                ))}
              </div>
              {!d.date ? (
                <>
                  <label style={labelStyle}>Days to wait</label>
                  <input type="number" min={0} max={365} style={inputStyle} value={d.days ?? 1} onChange={(e) => onUpdate(node.id, { days: Number(e.target.value) })} />
                </>
              ) : (
                <>
                  <label style={labelStyle}>Send on date</label>
                  <input type="date" style={inputStyle} value={d.date ?? ''} onChange={(e) => onUpdate(node.id, { date: e.target.value })} />
                </>
              )}
            </div>
          )}

          {/* CONDITION node */}
          {node.type === 'condition' && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Delivery Status is…</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {STATUS_OPTIONS.map((s) => {
                  const active = (d.value ?? []).includes(s);
                  return (
                    <button key={s} onClick={() => {
                      const cur = d.value ?? [];
                      onUpdate(node.id, { value: active ? cur.filter((v) => v !== s) : [...cur, s] });
                    }} style={{ padding: '4px 10px', borderRadius: 20, border: `1px solid ${active ? color : '#d1d5db'}`, background: active ? `${color}15` : '#f9fafb', fontSize: 11, cursor: 'pointer', color: active ? color : '#374151', fontWeight: active ? 700 : 400 }}>
                      {s}
                    </button>
                  );
                })}
              </div>
              <label style={labelStyle}>Match type</label>
              <select style={inputStyle} value={d.op ?? 'in'} onChange={(e) => onUpdate(node.id, { op: e.target.value as 'in' | 'not_in' })}>
                <option value="in">IS one of the above (YES branch)</option>
                <option value="not_in">IS NOT one of the above (YES branch)</option>
              </select>
              <div style={{ marginTop: 8, padding: 8, background: '#f0fdf4', borderRadius: 6, fontSize: 10, color: '#166534' }}>
                ✓ YES → matched status&nbsp;&nbsp;&nbsp;✗ NO → did not match
              </div>
            </div>
          )}

          {/* EMAIL node */}
          {node.type === 'email' && (
            <>
              {/* Subject */}
              <div style={sectionStyle}>
                <label style={labelStyle}>Subject Line</label>
                <input style={inputStyle} value={d.template?.subject ?? ''} onChange={(e) => onUpdate(node.id, { template: { ...d.template, subject: e.target.value, htmlBody: d.template?.htmlBody ?? '', textBody: d.template?.textBody ?? '', fromEmail: d.template?.fromEmail ?? '', fromName: d.template?.fromName ?? '' } })} placeholder="e.g. Hi {{FIRST_NAME}}, following up…" />
              </div>

              {/* AI generation */}
              <div style={{ ...sectionStyle, background: 'linear-gradient(135deg, #1e1b4b, #312e81)' }}>
                <label style={{ ...labelStyle, color: '#c7d2fe' }}>✦ Write with AI</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...inputStyle, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', flex: 1 }}
                    value={aiPrompt}
                    onChange={(e) => { setAiPrompt(e.target.value); setAiError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleAiGenerate(); }}
                    placeholder="e.g. Reminder for those who didn't open the SAP Sapphire invite"
                  />
                  <button onClick={() => void handleAiGenerate()} disabled={aiLoading || !aiPrompt.trim()} style={{ padding: '7px 12px', borderRadius: 6, border: 'none', background: aiLoading || !aiPrompt.trim() ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg,#818cf8,#6366f1)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: aiLoading || !aiPrompt.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {aiLoading ? '…' : 'Generate'}
                  </button>
                </div>
                {aiError && <div style={{ fontSize: 10, color: '#fca5a5', marginTop: 4 }}>{aiError}</div>}
              </div>

              {/* Template actions */}
              <div style={sectionStyle}>
                <label style={labelStyle}>Email Body</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setShowBuilder(true)} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: `1px solid ${color}`, background: `${color}10`, color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    🎨 Open Template Builder
                  </button>
                  <button onClick={() => jsonRef.current?.click()} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <UploadIcon style={{ width: 12, height: 12 }} /> Upload JSON
                  </button>
                  <input ref={jsonRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleJsonUpload} />
                </div>
                {d.template?.htmlBody ? (
                  <>
                    <div style={{ padding: '6px 8px', background: '#f0fdf4', borderRadius: 6, fontSize: 10, color: '#166534', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                      ✓ Template set ({d.template.htmlBody.length} chars)
                      <button onClick={() => onUpdate(node.id, { template: { subject: d.template?.subject ?? '', htmlBody: '', textBody: '', fromEmail: d.template?.fromEmail ?? '', fromName: d.template?.fromName ?? '' } })} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 10 }}>Clear</button>
                    </div>
                    {/* Body preview */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ padding: '4px 8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 9, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        PREVIEW
                        <button
                          onClick={() => {
                            const blob = new Blob([d.template!.htmlBody], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                            setTimeout(() => URL.revokeObjectURL(url), 60000);
                          }}
                          style={{ background: '#6366f1', border: 'none', borderRadius: 4, padding: '2px 8px', color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}
                        >
                          ↗ Preview Email
                        </button>
                      </div>
                      <iframe
                        srcDoc={d.template.htmlBody}
                        style={{ width: '100%', height: 200, border: 'none', display: 'block' }}
                        sandbox="allow-same-origin"
                        title="Email preview"
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 8, background: '#fffbeb', borderRadius: 6, fontSize: 10, color: '#92400e' }}>
                    ⚠ No body set — use Template Builder, upload JSON, or Write with AI above
                  </div>
                )}
                {/* Plain text fallback */}
                <label style={{ ...labelStyle, marginTop: 10 }}>Plain Text (optional)</label>
                <textarea rows={3} style={{ ...inputStyle, resize: 'vertical', fontSize: 12 }} value={d.template?.textBody ?? ''} onChange={(e) => onUpdate(node.id, { template: { ...d.template, textBody: e.target.value, subject: d.template?.subject ?? '', htmlBody: d.template?.htmlBody ?? '', fromEmail: d.template?.fromEmail ?? '', fromName: d.template?.fromName ?? '' } })} placeholder="Plain text fallback…" />
              </div>
            </>
          )}
        </div>

        {/* Delete */}
        {node.type !== 'start' && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #fee2e2' }}>
            <button onClick={() => onDelete(node.id)} style={{ width: '100%', padding: '8px 0', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff5f5', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Delete node
            </button>
          </div>
        )}
      </div>

      {/* Template Builder overlay */}
      {showBuilder && (
        <TemplateBuilder
          onApply={(html) => {
            onUpdate(node.id, {
              template: { ...d.template, htmlBody: html, subject: d.template?.subject ?? '', textBody: d.template?.textBody ?? '', fromEmail: d.template?.fromEmail ?? '', fromName: d.template?.fromName ?? '' },
            });
            setShowBuilder(false);
          }}
          onClose={() => setShowBuilder(false)}
          idToken={idToken}
        />
      )}
    </>
  );
}
