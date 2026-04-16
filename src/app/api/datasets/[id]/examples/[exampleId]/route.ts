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
  return NextResponse.json({ ...example, payload: JSON.parse(example.messages) })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; exampleId: string } }
) {
  const body = await req.json()
  const data: Record<string, unknown> = {}

  // Update raw payload (messages for SFT, {prompt,chosen,rejected} for DPO)
  if (body.messages !== undefined) {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'messages must be a non-empty array' }, { status: 400 })
    }
    data.messages = JSON.stringify(body.messages)
  }
  if (body.prompt !== undefined || body.chosen !== undefined || body.rejected !== undefined) {
    // DPO field update — fetch current to merge
    const current = await prisma.example.findUnique({ where: { id: params.exampleId } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const existing = JSON.parse(current.messages)
    data.messages = JSON.stringify({
      prompt: body.prompt ?? existing.prompt,
      chosen: body.chosen ?? existing.chosen,
      rejected: body.rejected ?? existing.rejected,
    })
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

  return NextResponse.json({ ...example, payload: JSON.parse(example.messages) })
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; exampleId: string } }
) {
  await prisma.example.delete({ where: { id: params.exampleId } })
  return new NextResponse(null, { status: 204 })
}
