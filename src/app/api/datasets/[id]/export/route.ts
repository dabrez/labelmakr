import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Supported export formats:
//   jsonl      (default) - {"messages":[...]}  OpenAI / Anthropic / TRL SFTTrainer
//   alpaca               - {"instruction","input","output"}  Alpaca / many scripts
//   sharegpt             - {"conversations":[{"from":"human","value":"..."},{"from":"gpt","value":"..."}]}  Axolotl / ShareGPT
//   completion           - {"text": "<full conversation as text>"}  HuggingFace datasets / plain SFT
//   dpo                  - {"prompt","chosen","rejected"}  TRL DPOTrainer / ORPO — only for DPO examples
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') ?? 'jsonl'
  const statusFilter = searchParams.get('status') ?? 'approved'

  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } })
  if (!dataset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isDpoExport = format === 'dpo'

  const examples = await prisma.example.findMany({
    where: {
      datasetId: params.id,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(isDpoExport ? { exampleType: 'dpo' } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })

  type SftMessages = { role: string; content: string }[]
  type DpoPayload = { prompt: SftMessages; chosen: string; rejected: string }

  const parsed = examples.map((e) => {
    const raw = JSON.parse(e.messages)
    return { ...e, raw }
  })

  const ext = isDpoExport ? 'jsonl' : format === 'completion' ? 'jsonl' : 'jsonl'
  const filename = `${dataset.name.replace(/\s+/g, '_')}_${format}_${statusFilter}.${ext}`

  let lines: string[] = []

  switch (format) {
    case 'alpaca':
      lines = parsed.map((e) => {
        const msgs = e.raw as SftMessages
        const system = msgs.find((m) => m.role === 'system')?.content ?? ''
        const user = msgs.find((m) => m.role === 'user')?.content ?? ''
        const assistant = msgs.find((m) => m.role === 'assistant')?.content ?? ''
        return JSON.stringify({
          instruction: user,
          input: system,
          output: assistant,
        })
      })
      break

    case 'sharegpt':
      lines = parsed.map((e) => {
        const msgs = e.raw as SftMessages
        const roleMap: Record<string, string> = {
          system: 'system',
          user: 'human',
          assistant: 'gpt',
        }
        const conversations = msgs.map((m) => ({
          from: roleMap[m.role] ?? m.role,
          value: m.content,
        }))
        return JSON.stringify({ conversations })
      })
      break

    case 'completion': {
      // Format as a single text string using a simple chat template.
      // Compatible with TRL SFTTrainer when dataset_text_field="text".
      lines = parsed.map((e) => {
        const msgs = e.raw as SftMessages
        const text = msgs
          .map((m) => {
            if (m.role === 'system') return `### System:\n${m.content}`
            if (m.role === 'user') return `### User:\n${m.content}`
            return `### Assistant:\n${m.content}`
          })
          .join('\n\n')
        return JSON.stringify({ text })
      })
      break
    }

    case 'dpo':
      lines = parsed.map((e) => {
        const payload = e.raw as DpoPayload
        // Flatten prompt messages into a single string for TRL DPOTrainer
        const promptText = Array.isArray(payload.prompt)
          ? payload.prompt.map((m) => m.content).join('\n')
          : String(payload.prompt)
        return JSON.stringify({
          prompt: promptText,
          chosen: payload.chosen,
          rejected: payload.rejected,
        })
      })
      break

    default:
      // jsonl — OpenAI / Anthropic / TRL SFTTrainer chat format
      lines = parsed.map((e) => JSON.stringify({ messages: e.raw as SftMessages }))
  }

  const body = lines.join('\n')

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
