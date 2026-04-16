import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Accepts a JSONL body where each line is one of:
//   { messages: [{role, content}, ...] }           (chat format)
//   { prompt: string, completion: string }          (completion format - converted)
//   { instruction: string, output: string }         (alpaca format - converted)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } })
  if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })

  const text = await req.text()
  const lines = text.split('\n').filter((l) => l.trim())

  if (lines.length === 0) {
    return NextResponse.json({ error: 'No data found in body' }, { status: 400 })
  }

  const rows: { messages: string }[] = []
  const errors: { line: number; error: string }[] = []

  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i])
      let messages: { role: string; content: string }[]

      if (Array.isArray(obj.messages)) {
        messages = obj.messages
      } else if (obj.prompt !== undefined && obj.completion !== undefined) {
        messages = [
          { role: 'user', content: String(obj.prompt) },
          { role: 'assistant', content: String(obj.completion) },
        ]
      } else if (obj.instruction !== undefined && obj.output !== undefined) {
        messages = [
          { role: 'user', content: String(obj.instruction) },
          { role: 'assistant', content: String(obj.output) },
        ]
      } else {
        errors.push({ line: i + 1, error: 'Unrecognized format' })
        continue
      }

      // Validate roles
      const validRoles = ['system', 'user', 'assistant']
      const invalid = messages.find((m) => !validRoles.includes(m.role))
      if (invalid) {
        errors.push({ line: i + 1, error: `Invalid role: ${invalid.role}` })
        continue
      }

      rows.push({ messages: JSON.stringify(messages) })
    } catch {
      errors.push({ line: i + 1, error: 'Invalid JSON' })
    }
  }

  if (rows.length > 0) {
    await prisma.example.createMany({
      data: rows.map((r) => ({
        datasetId: params.id,
        messages: r.messages,
        source: 'imported',
        status: 'pending',
      })),
    })
  }

  return NextResponse.json({
    imported: rows.length,
    skipped: errors.length,
    errors,
  })
}
