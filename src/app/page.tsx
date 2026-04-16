'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DatasetWithStats {
  id: string
  name: string
  description: string | null
  createdAt: string
  stats: { total: number; pending: number; approved: number; rejected: number }
}

export default function Home() {
  const [datasets, setDatasets] = useState<DatasetWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = async () => {
    const res = await fetch('/api/datasets')
    setDatasets(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    await fetch('/api/datasets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    })
    setName('')
    setDescription('')
    setShowForm(false)
    setCreating(false)
    load()
  }

  const del = async (id: string, dsName: string) => {
    if (!confirm(`Delete dataset "${dsName}" and all its examples?`)) return
    await fetch(`/api/datasets/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Datasets</h1>
          <p className="text-gray-400 text-sm mt-1">
            Collect, correct, and export fine-tuning data
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Dataset
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">New Dataset</h2>
          <input
            type="text"
            placeholder="Dataset name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-500"
            required
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : datasets.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📂</p>
          <p className="font-medium">No datasets yet</p>
          <p className="text-sm mt-1">Create one to start collecting training data.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {datasets.map((d) => (
            <div
              key={d.id}
              className="bg-gray-900 border border-gray-700 rounded-xl p-5 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/datasets/${d.id}`}
                    className="font-semibold hover:text-blue-400 transition-colors"
                  >
                    {d.name}
                  </Link>
                  {d.description && (
                    <p className="text-gray-400 text-sm mt-0.5 truncate">{d.description}</p>
                  )}
                </div>
                <button
                  onClick={() => del(d.id, d.name)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-sm flex-shrink-0"
                >
                  Delete
                </button>
              </div>

              <div className="flex gap-4 mt-4 text-sm">
                <Stat label="Total" value={d.stats.total} />
                <Stat label="Pending" value={d.stats.pending} color="text-yellow-400" />
                <Stat label="Approved" value={d.stats.approved} color="text-green-400" />
                <Stat label="Rejected" value={d.stats.rejected} color="text-red-400" />
              </div>

              <div className="flex gap-2 mt-4">
                <Link
                  href={`/datasets/${d.id}`}
                  className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Manage
                </Link>
                <Link
                  href={`/datasets/${d.id}/generate`}
                  className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Generate
                </Link>
                <a
                  href={`/api/datasets/${d.id}/export?status=approved`}
                  className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Export JSONL
                </a>
              </div>
            </div>
          ))}
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
