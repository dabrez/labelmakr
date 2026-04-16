import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const exampleType = searchParams.get('exampleType')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const skip = (page - 1) * limit

  const where = {
    datasetId: params.id,
    ...(status ? { status } : {}),
    ...(exampleType ? { exampleType } : {}),
  }

  const [examples, total] = await Promise.all([
    prisma.example.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.example.count({ where }),
  ])

  const parsed = examples.map((e) => ({
    ...e,
    payload: JSON.parse(e.messages),
  }))

  return NextResponse.json({ examples: parsed, total, page, limit })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { notes, source = 'manual', exampleType = 'sft' } = body

  if (exampleType === 'dpo') {
    // DPO: expects { prompt: Message[], chosen: string, rejected: string }
    const { prompt, chosen, rejected } = body
    if (!Array.isArray(prompt) || prompt.length === 0) {
      return NextResponse.json({ error: 'prompt (Message[]) is required for DPO' }, { status: 400 })
    }
    if (!chosen?.trim() || !rejected?.trim()) {
      return NextResponse.json({ error: 'chosen and rejected are required for DPO' }, { status: 400 })
    }
    const payload = { prompt, chosen, rejected }
    const example = await prisma.example.create({
      data: {
        datasetId: params.id,
        messages: JSON.stringify(payload),
        exampleType: 'dpo',
        source,
        notes: notes?.trim() || null,
      },
    })
    return NextResponse.json({ ...example, payload }, { status: 201 })
  }

  // SFT (default): expects { messages: Message[] }
  const { messages } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required for SFT' }, { status: 400 })
  }
  const example = await prisma.example.create({
    data: {
      datasetId: params.id,
      messages: JSON.stringify(messages),
      exampleType: 'sft',
      source,
      notes: notes?.trim() || null,
    },
  })
  return NextResponse.json({ ...example, payload: messages }, { status: 201 })
}
