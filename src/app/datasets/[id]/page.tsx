'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }
interface SftPayload { role: never } // discriminated via exampleType
interface DpoPayload { prompt: Message[]; chosen: string; rejected: string }

interface Example {
  id: string
  exampleType: 'sft' | 'dpo'
  payload: Message[] | DpoPayload
  status: string
  source: string
  notes: string | null
  createdAt: string
}
interface DatasetStats {
  id: string
  name: string
  description: string | null
  stats: { total: number; pending: number; approved: number; rejected: number }
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900 text-yellow-300',
  approved: 'bg-green-900 text-green-300',
  rejected: 'bg-red-900 text-red-300',
}
const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-gray-800 text-gray-400',
  imported: 'bg-blue-900 text-blue-300',
  synthetic: 'bg-purple-900 text-purple-300',
}

const EXPORT_FORMATS = [
  { value: 'jsonl', label: 'JSONL (OpenAI / Anthropic / TRL SFT)', ext: 'jsonl' },
  { value: 'sharegpt', label: 'ShareGPT (Axolotl)', ext: 'jsonl' },
  { value: 'alpaca', label: 'Alpaca', ext: 'jsonl' },
  { value: 'completion', label: 'Completion / text (HuggingFace)', ext: 'jsonl' },
  { value: 'dpo', label: 'DPO pairs (TRL DPOTrainer / ORPO)', ext: 'jsonl' },
]

export default function DatasetPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [dataset, setDataset] = useState<DatasetStats | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [exportFormat, setExportFormat] = useState('jsonl')
  const [exportStatus, setExportStatus] = useState('approved')
  const [showDpoForm, setShowDpoForm] = useState(false)
  const [dpoPrompt, setDpoPrompt] = useState('')
  const [dpoChosen, setDpoChosen] = useState('')
  const [dpoRejected, setDpoRejected] = useState('')
  const [savingDpo, setSavingDpo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const qs = new URLSearchParams({ limit: '100' })
    if (statusFilter !== 'all') qs.set('status', statusFilter)
    if (typeFilter !== 'all') qs.set('exampleType', typeFilter)

    const [dsRes, exRes] = await Promise.all([
      fetch(`/api/datasets/${id}`),
      fetch(`/api/datasets/${id}/examples?${qs}`),
    ])
    if (!dsRes.ok) { router.push('/'); return }
    setDataset(await dsRes.json())
    const ex = await exRes.json()
    setExamples(ex.examples)
    setTotal(ex.total)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter, typeFilter])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    const text = await file.text()
    const res = await fetch(`/api/datasets/${id}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    })
    setImportResult(await res.json())
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  const updateStatus = async (exampleId: string, status: string) => {
    await fetch(`/api/datasets/${id}/examples/${exampleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  const deleteExample = async (exampleId: string) => {
    await fetch(`/api/datasets/${id}/examples/${exampleId}`, { method: 'DELETE' })
    load()
  }

  const saveDpo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dpoPrompt.trim() || !dpoChosen.trim() || !dpoRejected.trim()) return
    setSavingDpo(true)
    await fetch(`/api/datasets/${id}/examples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exampleType: 'dpo',
        prompt: [{ role: 'user', content: dpoPrompt.trim() }],
        chosen: dpoChosen.trim(),
        rejected: dpoRejected.trim(),
      }),
    })
    setSavingDpo(false)
    setDpoPrompt(''); setDpoChosen(''); setDpoRejected('')
    setShowDpoForm(false)
    load()
  }

  if (loading) return <p className="text-gray-500 text-sm">Loading...</p>
  if (!dataset) return null

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-300">Datasets</Link>
        <span>/</span>
        <span className="text-gray-200">{dataset.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dataset.name}</h1>
          {dataset.description && <p className="text-gray-400 text-sm mt-1">{dataset.description}</p>}
          <div className="flex gap-4 mt-3 text-sm">
            <Stat label="Total" value={dataset.stats.total} />
            <Stat label="Pending" value={dataset.stats.pending} color="text-yellow-400" />
            <Stat label="Approved" value={dataset.stats.approved} color="text-green-400" />
            <Stat label="Rejected" value={dataset.stats.rejected} color="text-red-400" />
          </div>
        </div>
        <Link
          href={`/datasets/${id}/generate`}
          className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          Generate
        </Link>
      </div>

      {/* Import */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-medium mb-1">Import JSONL</p>
            <p className="text-xs text-gray-500">
              Auto-detects: <code className="bg-gray-800 px-1 rounded">messages</code>,{' '}
              <code className="bg-gray-800 px-1 rounded">prompt/completion</code>,{' '}
              <code className="bg-gray-800 px-1 rounded">instruction/output</code>
            </p>
          </div>
          <label className="ml-auto cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            {importing ? 'Importing...' : 'Choose File'}
            <input ref={fileRef} type="file" accept=".jsonl,.json,.txt" onChange={handleImport} className="hidden" disabled={importing} />
          </label>
        </div>
        {importResult && (
          <p className="text-sm mt-2 text-green-400">
            Imported {importResult.imported} examples{importResult.skipped > 0 && `, skipped ${importResult.skipped}`}
          </p>
        )}
      </div>

      {/* Export */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
        <p className="text-sm font-medium mb-3">Export</p>
        <div className="flex gap-2 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={exportStatus}
              onChange={(e) => setExportStatus(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="approved">Approved only</option>
              <option value="all">All</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <a
            href={`/api/datasets/${id}/export?format=${exportFormat}&status=${exportStatus}`}
            className="bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            Download
          </a>
        </div>
        {exportFormat === 'dpo' && (
          <p className="text-xs text-purple-400 mt-2">DPO export only includes examples created as preference pairs.</p>
        )}
      </div>

      {/* Add DPO pair */}
      <div className="mb-4">
        <button
          onClick={() => setShowDpoForm(!showDpoForm)}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showDpoForm ? '− Cancel DPO pair' : '+ Add preference pair (DPO)'}
        </button>
      </div>

      {showDpoForm && (
        <form onSubmit={saveDpo} className="bg-gray-900 border border-purple-800 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-purple-300 mb-1">New Preference Pair (DPO)</h2>
          <p className="text-xs text-gray-500 mb-4">
            Used for TRL DPOTrainer / ORPO. Provide a prompt and two responses — one preferred (chosen) and one not (rejected).
          </p>
          <label className="block text-xs text-gray-400 mb-1">Prompt</label>
          <textarea
            value={dpoPrompt}
            onChange={(e) => setDpoPrompt(e.target.value)}
            rows={2}
            required
            placeholder="User prompt..."
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-purple-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-green-400 mb-1">Chosen (preferred response)</label>
              <textarea
                value={dpoChosen}
                onChange={(e) => setDpoChosen(e.target.value)}
                rows={4}
                required
                placeholder="The better response..."
                className="w-full bg-gray-800 border border-green-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-600 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-red-400 mb-1">Rejected (worse response)</label>
              <textarea
                value={dpoRejected}
                onChange={(e) => setDpoRejected(e.target.value)}
                rows={4}
                required
                placeholder="The worse response..."
                className="w-full bg-gray-800 border border-red-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-700 resize-none"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={savingDpo}
            className="mt-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {savingDpo ? 'Saving...' : 'Save Pair'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {s}
          </button>
        ))}
        <div className="w-px bg-gray-700 mx-1" />
        {['all', 'sft', 'dpo'].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors uppercase ${typeFilter === t ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-600 mb-4">{total} examples</p>

      {/* Examples */}
      {examples.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No examples. Import data, use Generate, or add a DPO pair above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {examples.map((ex) => (
            <ExampleRow
              key={ex.id}
              ex={ex}
              onStatus={(s) => updateStatus(ex.id, s)}
              onDelete={() => deleteExample(ex.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExampleRow({
  ex,
  onStatus,
  onDelete,
}: {
  ex: Example
  onStatus: (s: string) => void
  onDelete: () => void
}) {
  const isDpo = ex.exampleType === 'dpo'
  const dpo = isDpo ? (ex.payload as DpoPayload) : null
  const msgs = !isDpo ? (ex.payload as Message[]) : null
  const userMsg = msgs?.find((m) => m.role === 'user')
  const assistantMsg = msgs?.find((m) => m.role === 'assistant')

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ex.status]}`}>{ex.status}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[ex.source]}`}>{ex.source}</span>
        {isDpo && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300">DPO</span>}
        <span className="text-xs text-gray-600 ml-auto">{new Date(ex.createdAt).toLocaleDateString()}</span>
      </div>

      {isDpo && dpo ? (
        <div className="space-y-2">
          <div>
            <span className="text-xs text-blue-400 font-mono uppercase tracking-wide">Prompt</span>
            <p className="text-sm text-gray-300 mt-0.5 line-clamp-1">{dpo.prompt[0]?.content}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-950 rounded-lg p-2">
              <span className="text-xs text-green-400 font-mono uppercase tracking-wide">Chosen</span>
              <p className="text-xs text-gray-300 mt-0.5 line-clamp-2">{dpo.chosen}</p>
            </div>
            <div className="bg-red-950 rounded-lg p-2">
              <span className="text-xs text-red-400 font-mono uppercase tracking-wide">Rejected</span>
              <p className="text-xs text-gray-300 mt-0.5 line-clamp-2">{dpo.rejected}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {userMsg && (
            <div className="mb-2">
              <span className="text-xs text-blue-400 font-mono uppercase tracking-wide">User</span>
              <p className="text-sm text-gray-300 mt-0.5 line-clamp-2">{userMsg.content}</p>
            </div>
          )}
          {assistantMsg && (
            <div>
              <span className="text-xs text-green-400 font-mono uppercase tracking-wide">Assistant</span>
              <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">{assistantMsg.content}</p>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 mt-3">
        {ex.status !== 'approved' && (
          <button onClick={() => onStatus('approved')} className="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-2.5 py-1 rounded-lg transition-colors">Approve</button>
        )}
        {ex.status !== 'rejected' && (
          <button onClick={() => onStatus('rejected')} className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-2.5 py-1 rounded-lg transition-colors">Reject</button>
        )}
        {ex.status !== 'pending' && (
          <button onClick={() => onStatus('pending')} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-2.5 py-1 rounded-lg transition-colors">Reset</button>
        )}
        <button onClick={onDelete} className="text-xs text-gray-600 hover:text-red-400 px-2.5 py-1 rounded-lg transition-colors ml-auto">Delete</button>
      </div>
    </div>
  )
}

function Stat({ label, value, color = 'text-gray-300' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-gray-500 ml-1">{label}</span>
    </div>
  )
}
