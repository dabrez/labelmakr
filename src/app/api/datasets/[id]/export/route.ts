import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Supported export formats:
//   jsonl (default) - one JSON object per line with "messages" key (OpenAI/Anthropic chat format)
//   alpaca          - {instruction, output} pairs
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'jsonl'
  const statusFilter = searchParams.get('status') ?? 'approved'

  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } })
  if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const examples = await prisma.example.findMany({
    where: {
      datasetId: params.id,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  const parsed = examples.map((e) => ({
    ...e,
    messages: JSON.parse(e.messages) as { role: string; content: string }[],
  }))

  let body = ''
  let contentType = 'application/x-ndjson'
  const filename = `${dataset.name.replace(/\s+/g, '_')}_${statusFilter}.jsonl`

  if (format === 'alpaca') {
    const alpacaLines = parsed.map((e) => {
      const user = e.messages.find((m) => m.role === 'user')?.content ?? ''
      const assistant = e.messages.find((m) => m.role === 'assistant')?.content ?? ''
      return JSON.stringify({ instruction: user, output: assistant })
    })
    body = alpacaLines.join('\n')
  } else {
    // Default: OpenAI/Anthropic JSONL chat format
    const lines = parsed.map((e) =>
      JSON.stringify({ messages: e.messages })
    )
    body = lines.join('\n')
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
