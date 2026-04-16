import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const datasets = await prisma.dataset.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { examples: true } },
    },
  })

  const withStats = await Promise.all(
    datasets.map(async (d) => {
      const statusCounts = await prisma.example.groupBy({
        by: ['status'],
        where: { datasetId: d.id },
        _count: { status: true },
      })
      const counts = { pending: 0, approved: 0, rejected: 0 }
      for (const row of statusCounts) {
        counts[row.status as keyof typeof counts] = row._count.status
      }
      return {
        ...d,
        stats: { total: d._count.examples, ...counts },
      }
    })
  )

  return NextResponse.json(withStats)
}

export async function POST(req: Request) {
  const { name, description } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  const dataset = await prisma.dataset.create({
    data: { name: name.trim(), description: description?.trim() || null },
  })
  return NextResponse.json(dataset, { status: 201 })
}
