import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const client = new Anthropic()

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const dataset = await prisma.dataset.findUnique({ where: { id: params.id } })
  if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })

  const {
    systemPrompt,
    userPromptTemplate,
    count = 5,
    temperature = 1.0,
    model = 'claude-sonnet-4-6',
    includeSystemMessage = false,
    generatorSystemPrompt,
  } = await req.json()

  if (!userPromptTemplate?.trim()) {
    return NextResponse.json({ error: 'userPromptTemplate is required' }, { status: 400 })
  }
  if (count < 1 || count > 50) {
    return NextResponse.json({ error: 'count must be between 1 and 50' }, { status: 400 })
  }

  // Build the meta-prompt that instructs Claude to generate training examples
  const metaPrompt = `You are a synthetic training data generator. Generate ${count} diverse, high-quality training examples in JSON format.

Each example should follow this structure:
{
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
${includeSystemMessage && systemPrompt ? `
Include a system message as the first message in each example:
{"role": "system", "content": ${JSON.stringify(systemPrompt)}}
` : ''}

Generation instructions:
${userPromptTemplate}

Respond with a JSON array of exactly ${count} examples. No explanation, just the JSON array.
Output format:
[
  {"messages": [...]},
  {"messages": [...]}
]`

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: metaPrompt },
  ]

  let responseText = ''
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      temperature,
      system: generatorSystemPrompt || 'You are a synthetic training data generator. Output only valid JSON.',
      messages,
    })

    responseText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 502 })
  }

  // Parse the generated examples
  let generated: { messages: { role: string; content: string }[] }[]
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found in response')
    generated = JSON.parse(jsonMatch[0])
    if (!Array.isArray(generated)) throw new Error('Expected an array')
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to parse generated output', raw: responseText },
      { status: 422 }
    )
  }

  const validExamples = generated.filter(
    (g) => Array.isArray(g?.messages) && g.messages.length > 0
  )

  if (validExamples.length === 0) {
    return NextResponse.json(
      { error: 'No valid examples in generated output', raw: responseText },
      { status: 422 }
    )
  }

  const created = await prisma.example.createMany({
    data: validExamples.map((g) => ({
      datasetId: params.id,
      messages: JSON.stringify(g.messages),
      source: 'synthetic',
      status: 'pending',
    })),
  })

  return NextResponse.json({
    generated: created.count,
    requested: count,
  })
}
