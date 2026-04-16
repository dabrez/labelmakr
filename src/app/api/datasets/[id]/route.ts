import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const dataset = await prisma.dataset.findUnique({
    where: { id: params.id },
  })
  if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const statusCounts = await prisma.example.groupBy({
    by: ['status'],
    where: { datasetId: params.id },
    _count: { status: true },
  })
  const counts = { pending: 0, approved: 0, rejected: 0 }
  for (const row of statusCounts) {
    counts[row.status as keyof typeof counts] = row._count.status
  }
  const total = counts.pending + counts.approved + counts.rejected

  return NextResponse.json({ ...dataset, stats: { total, ...counts } })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { name, description } = await req.json()
  const dataset = await prisma.dataset.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description?.trim() || null }),
    },
  })
  return NextResponse.json(dataset)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await prisma.dataset.delete({ where: { id: params.id } })
  return new NextResponse(null, { status: 204 })
}
