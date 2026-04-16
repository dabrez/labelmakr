import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '50')
  const skip = (page - 1) * limit

  const where = {
    datasetId: params.id,
    ...(status ? { status } : {}),
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
    messages: JSON.parse(e.messages),
  }))

  return NextResponse.json({ examples: parsed, total, page, limit })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { messages, notes, source = 'manual' } = await req.json()
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 })
  }

  const example = await prisma.example.create({
    data: {
      datasetId: params.id,
      messages: JSON.stringify(messages),
      source,
      notes: notes?.trim() || null,
    },
  })

  return NextResponse.json({ ...example, messages }, { status: 201 })
}
