'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

const MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
]

export default function GeneratePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [datasetName, setDatasetName] = useState('')
  const [userPromptTemplate, setUserPromptTemplate] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [includeSystemMessage, setIncludeSystemMessage] = useState(false)
  const [count, setCount] = useState(10)
  const [model, setModel] = useState(MODELS[0])
  const [temperature, setTemperature] = useState(1.0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ generated: number; requested: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/datasets/${id}`)
      .then((r) => r.json())
      .then((d) => setDatasetName(d.name))
      .catch(() => router.push('/'))
  }, [id])

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)

    const res = await fetch(`/api/datasets/${id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPromptTemplate,
        systemPrompt,
        includeSystemMessage,
        count,
        model,
        temperature,
      }),
    })

    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Generation failed')
    } else {
      setResult(data)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-300">Datasets</Link>
        <span>/</span>
        <Link href={`/datasets/${id}`} className="hover:text-gray-300">{datasetName}</Link>
        <span>/</span>
        <span className="text-gray-200">Generate</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Generate Synthetic Data</h1>
      <p className="text-gray-400 text-sm mb-8">
        Describe what kind of examples you want. Claude will generate them and add them to your dataset as pending.
      </p>

      <form onSubmit={generate} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">
            Generation Instructions <span className="text-red-400">*</span>
          </label>
          <textarea
            value={userPromptTemplate}
            onChange={(e) => setUserPromptTemplate(e.target.value)}
            rows={6}
            required
            placeholder={`Describe what training examples to generate. For example:

Generate customer support conversations for a SaaS product.
The user should have various common issues (billing, login, feature questions)
and the assistant should respond helpfully and concisely.
Each conversation should be 1-3 turns.`}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none font-mono"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="includeSystem"
            checked={includeSystemMessage}
            onChange={(e) => setIncludeSystemMessage(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="includeSystem" className="text-sm">
            Include system message in each example
          </label>
        </div>

        {includeSystemMessage && (
          <div>
            <label className="block text-sm font-medium mb-2">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              placeholder="You are a helpful assistant..."
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Examples to generate</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Temperature <span className="text-gray-500">({temperature})</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full mt-2"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="bg-green-950 border border-green-800 text-green-300 rounded-xl px-4 py-3 text-sm">
            Generated {result.generated} examples (requested {result.requested}).{' '}
            <Link href={`/datasets/${id}`} className="underline">
              View in dataset
            </Link>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Generating...' : `Generate ${count} Examples`}
          </button>
          <Link
            href={`/datasets/${id}`}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Back
          </Link>
        </div>
      </form>
    </div>
  )
}
