'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

interface Message { role: 'system' | 'user' | 'assistant'; content: string }
interface Example {
  id: string
  messages: Message[]
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

export default function DatasetPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [dataset, setDataset] = useState<DatasetStats | null>(null)
  const [examples, setExamples] = useState<Example[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const [dsRes, exRes] = await Promise.all([
      fetch(`/api/datasets/${id}`),
      fetch(`/api/datasets/${id}/examples?limit=100${statusFilter !== 'all' ? `&status=${statusFilter}` : ''}`),
    ])
    if (!dsRes.ok) { router.push('/'); return }
    const ds = await dsRes.json()
    const ex = await exRes.json()
    setDataset(ds)
    setExamples(ex.examples)
    setTotal(ex.total)
    setLoading(false)
  }

  useEffect(() => { load() }, [statusFilter])

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
    const result = await res.json()
    setImportResult(result)
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
          {dataset.description && (
            <p className="text-gray-400 text-sm mt-1">{dataset.description}</p>
          )}
          <div className="flex gap-4 mt-3 text-sm">
            <Stat label="Total" value={dataset.stats.total} />
            <Stat label="Pending" value={dataset.stats.pending} color="text-yellow-400" />
            <Stat label="Approved" value={dataset.stats.approved} color="text-green-400" />
            <Stat label="Rejected" value={dataset.stats.rejected} color="text-red-400" />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link
            href={`/datasets/${id}/generate`}
            className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Generate
          </Link>
          <a
            href={`/api/datasets/${id}/export?status=approved`}
            className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Export JSONL
          </a>
        </div>
      </div>

      {/* Import */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm font-medium mb-1">Import JSONL</p>
            <p className="text-xs text-gray-500">
              Supports: <code className="bg-gray-800 px-1 rounded">&#123;"messages":[...]&#125;</code>,{' '}
              <code className="bg-gray-800 px-1 rounded">&#123;"prompt","completion"&#125;</code>,{' '}
              <code className="bg-gray-800 px-1 rounded">&#123;"instruction","output"&#125;</code>
            </p>
          </div>
          <label className="ml-auto cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            {importing ? 'Importing...' : 'Choose File'}
            <input
              ref={fileRef}
              type="file"
              accept=".jsonl,.json,.txt"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>
        {importResult && (
          <p className="text-sm mt-2 text-green-400">
            Imported {importResult.imported} examples
            {importResult.skipped > 0 && `, skipped ${importResult.skipped}`}
          </p>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s} {s === 'all' ? `(${total})` : s === statusFilter ? `(${total})` : ''}
          </button>
        ))}
      </div>

      {/* Examples list */}
      {examples.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No examples yet. Import data or use Generate to create synthetic examples.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {examples.map((ex) => {
            const userMsg = ex.messages.find((m) => m.role === 'user')
            const assistantMsg = ex.messages.find((m) => m.role === 'assistant')
            return (
              <div
                key={ex.id}
                className="bg-gray-900 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ex.status]}`}>
                    {ex.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[ex.source]}`}>
                    {ex.source}
                  </span>
                  <span className="text-xs text-gray-600 ml-auto">
                    {new Date(ex.createdAt).toLocaleDateString()}
                  </span>
                </div>

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

                <div className="flex gap-2 mt-3">
                  {ex.status !== 'approved' && (
                    <button
                      onClick={() => updateStatus(ex.id, 'approved')}
                      className="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                  )}
                  {ex.status !== 'rejected' && (
                    <button
                      onClick={() => updateStatus(ex.id, 'rejected')}
                      className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  )}
                  {ex.status !== 'pending' && (
                    <button
                      onClick={() => updateStatus(ex.id, 'pending')}
                      className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => deleteExample(ex.id)}
                    className="text-xs text-gray-600 hover:text-red-400 px-2.5 py-1 rounded-lg transition-colors ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
