import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string; exampleId: string } }
) {
  const example = await prisma.example.findFirst({
    where: { id: params.exampleId, datasetId: params.id },
  })
  if (!example) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...example, messages: JSON.parse(example.messages) })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; exampleId: string } }
) {
  const body = await req.json()
  const data: Record<string, unknown> = {}

  if (body.messages !== undefined) {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 })
    }
    data.messages = JSON.stringify(body.messages)
  }
  if (body.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    data.status = body.status
  }
  if (body.notes !== undefined) {
    data.notes = body.notes?.trim() || null
  }

  const example = await prisma.example.update({
    where: { id: params.exampleId },
    data,
  })

  return NextResponse.json({ ...example, messages: JSON.parse(example.messages) })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; exampleId: string } }
) {
  await prisma.example.delete({ where: { id: params.exampleId } })
  return new NextResponse(null, { status: 204 })
}
