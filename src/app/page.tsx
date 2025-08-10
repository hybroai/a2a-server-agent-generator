'use client';

import { useState } from 'react';

export default function Page() {
  const [agentDescription, setAgentDescription] = useState('Echo agent that repeats user text.');
  const [webSearch, setWebSearch] = useState(false);
  const [extraServices, setExtraServices] = useState('{}'); // JSON (optional)
  const [model, setModel] = useState('gpt-5');
  const [reasoningEffort, setReasoningEffort] = useState<'minimal' | 'medium' | 'high'>('minimal');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const buildServices = () => {
    let extra: Record<string, unknown> = {};
    if (extraServices.trim()) {
      try {
        extra = JSON.parse(extraServices);
      } catch {
        throw new Error('Extra services must be valid JSON');
      }
    }
    return { web_search: webSearch, ...extra };
  };

  const onPreviewJSON = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const services = buildServices();
      const res = await fetch('/api/generate-python', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentDescription, services, model, reasoningEffort }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const onDownloadZIP = async () => {
    setBusy(true);
    setError(null);
    try {
      const services = buildServices();
      const res = await fetch('/api/generate-python?zip=1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentDescription, services, model, reasoningEffort }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'a2a-python-server.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">A2A Python Server Generator</h1>
      <h2>Generate a Python A2A server with description</h2>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Agent Description</span>
        <textarea
          className="border rounded p-3 min-h-[120px]"
          value={agentDescription}
          onChange={(e) => setAgentDescription(e.target.value)}
          placeholder="Describe your agent’s behavior and capabilities"
        />
      </label>

      <div className="flex gap-3">
        <button
          onClick={onDownloadZIP}
          disabled={busy || !agentDescription.trim()}
          className="px-4 py-2 rounded border disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Generate and Download'}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {result && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Generated Files</div>
          <pre className="border rounded p-3 text-xs overflow-auto max-h-[360px] bg-[var(--background)]">
{JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}