import { generateObject } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { JudgmentSchema, type Judgment } from '../schemas/template-schemas'
import { PROHIBITED_WORDS } from '../tools/validate-utility'

// ============================================================================
// AI JUDGE SERVICE
// Usa LLM para analisar se template será aprovado como UTILITY pela Meta
// ============================================================================

const JUDGE_SYSTEM_PROMPT = `Você é um juiz especializado em aprovação de templates WhatsApp Business API para a Meta.

Sua função é analisar templates e prever se serão aprovados como UTILITY ou reclassificados como MARKETING.

## CRITÉRIOS DA META PARA UTILITY:
- Templates informativos, não promocionais
- Sem linguagem de urgência, escassez ou promoção hardcoded
- A Meta NÃO analisa o valor das variáveis, apenas a estrutura

## PALAVRAS QUE ATIVAM MARKETING SE HARDCODED:
### Escassez: ${PROHIBITED_WORDS.scarcity.join(', ')}
### Urgência: ${PROHIBITED_WORDS.urgency.join(', ')}
### Promocional: ${PROHIBITED_WORDS.promotional.join(', ')}
### CTA Agressivo: ${PROHIBITED_WORDS.aggressiveCTA.join(', ')}

## 🔑 ESTRATÉGIA DE CORREÇÃO: USE VARIÁVEIS!

Quando encontrar palavras problemáticas, NÃO REMOVA - SUBSTITUA POR VARIÁVEIS!

### Exemplos de correção:
❌ Original: "boleto parcelado estará disponível"
✅ Corrigido: "{{1}} estará disponível"

❌ Original: "23 vagas foram liberadas"
✅ Corrigido: "{{1}} foram liberadas"

❌ Original: "quarta-feira às 19h"
✅ Corrigido: "{{1}} às {{2}}"

### Use variáveis sequenciais: {{1}}, {{2}}, {{3}}...
### Se já existem variáveis no texto, continue a numeração.

## REGRAS TÉCNICAS:
- Variáveis NÃO podem iniciar o texto (adicione "Olá! " se necessário)
- Variáveis NÃO podem finalizar o texto (adicione ". Aguardamos seu retorno." se necessário)
- Mantenha o sentido original - apenas substitua palavras por variáveis`

function buildJudgePrompt(header: string | null, body: string): string {
    return `${JUDGE_SYSTEM_PROMPT}

## TEMPLATE A ANALISAR:
Header: ${header || '(sem header)'}
Body: ${body}

Analise o template acima e retorne:
1. approved: true se passa como UTILITY sem mudanças, false se precisa correção
2. predictedCategory: "UTILITY" ou "MARKETING"
3. confidence: sua confiança de 0 a 1
4. issues: lista de palavras que ativam MARKETING
5. fixedBody: versão corrigida COM VARIÁVEIS no lugar das palavras problemáticas
6. fixedHeader: versão corrigida do header (se necessário)

⚠️ IMPORTANTE: No fix, SUBSTITUA palavras por variáveis, NÃO remova informação!`
}

export interface JudgeOptions {
    apiKey: string
    model?: string
}

/**
 * Analisa um template usando IA para prever se será aprovado como UTILITY
 */
export async function judgeTemplate(
    template: { name?: string; header: string | null; body: string },
    options: JudgeOptions
): Promise<Judgment> {
    const google = createGoogleGenerativeAI({ apiKey: options.apiKey })
    const model = google(options.model || 'gemini-2.5-flash')

    const prompt = buildJudgePrompt(template.header, template.body)
    const templateName = template.name || 'unknown'

    console.log(`[AI_JUDGE] Analyzing: ${templateName}`)

    const { object: judgment } = await generateObject({
        model,
        schema: JudgmentSchema,
        prompt
    })

    const status = judgment.approved ? '✅ APPROVED' : '❌ REJECTED'
    console.log(`[AI_JUDGE] ${templateName}: ${status} as ${judgment.predictedCategory} (${Math.round(judgment.confidence * 100)}%)`)

    if (judgment.issues.length > 0) {
        console.log(`[AI_JUDGE] ${templateName} issues: ${judgment.issues.map(i => i.word).join(', ')}`)
    }

    if (judgment.fixedBody) {
        console.log(`[AI_JUDGE] ${templateName}: Fixed body provided`)
    }

    return judgment
}

/**
 * Analisa múltiplos templates em paralelo
 */
export async function judgeTemplates(
    templates: Array<{ name?: string; header: string | null; body: string }>,
    options: JudgeOptions
): Promise<Judgment[]> {
    console.log(`[AI_JUDGE] Analyzing ${templates.length} templates...`)

    const judgments = await Promise.all(
        templates.map(t => judgeTemplate(t, options))
    )

    const approved = judgments.filter(j => j.approved).length
    const fixed = judgments.filter(j => j.fixedBody).length
    const rejected = judgments.filter(j => !j.approved && !j.fixedBody).length

    console.log(`[AI_JUDGE] Summary: ${approved} approved, ${fixed} fixed, ${rejected} rejected (total: ${templates.length})`)

    return judgments
}
