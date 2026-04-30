import { NextRequest, NextResponse } from 'next/server'
import { GenerateTemplateSchema, validateBody, formatZodErrors } from '@/lib/api-validation'
import { generateText } from '@/lib/ai'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const validation = validateBody(GenerateTemplateSchema, body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: formatZodErrors(validation.error) },
        { status: 400 }
      )
    }

    const { prompt } = validation.data

    const result = await generateText({
      prompt: `Crie uma mensagem de WhatsApp curta, profissional e persuasiva baseada neste pedido: "${prompt}". 
      Regras:
      1. Use a variável {{1}} para o nome do cliente.
      2. Use emojis com moderação.
      3. Seja direto (max 300 caracteres).
      4. Retorne APENAS o texto da mensagem, sem explicações.`,
    })

    return NextResponse.json({ content: result.text })
  } catch (error) {
    console.error('AI Error:', error)
    return NextResponse.json(
      { error: 'Falha ao gerar conteúdo com IA' },
      { status: 500 }
    )
  }
}
