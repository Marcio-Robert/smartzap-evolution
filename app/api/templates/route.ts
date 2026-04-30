import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS'
  format?: string
  text?: string
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>
}

interface MetaTemplate {
  name: string
  status: string
  language: string
  category: string
  components: MetaTemplateComponent[]
  last_updated_time: string
}

// Helper to fetch ALL templates from Meta API (with pagination)
async function fetchTemplatesFromMeta(businessAccountId: string, accessToken: string) {
  const allTemplates: MetaTemplate[] = []
  let nextUrl: string | null = `https://graph.facebook.com/v24.0/${businessAccountId}/message_templates?fields=name,status,language,category,components,last_updated_time&limit=100`
  
  // Paginate through all results
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error?.message || 'Failed to fetch templates')
    }

    const data = await res.json()
    allTemplates.push(...(data.data || []))
    
    // Check for next page
    nextUrl = data.paging?.next || null
  }

  // Transform Meta format to our App format
  return allTemplates.map((t: MetaTemplate) => {
    const bodyComponent = t.components.find((c: MetaTemplateComponent) => c.type === 'BODY')
    return {
      id: t.name,
      name: t.name,
      category: t.category,
      language: t.language,
      status: t.status,
      content: bodyComponent?.text || 'No content',
      preview: bodyComponent?.text || '',
      lastUpdated: t.last_updated_time,
      components: t.components
    }
  })
}

// GET /api/templates - Fetch templates using Redis credentials
export async function GET() {
  try {
    const credentials = await getWhatsAppCredentials()
    
    if (!credentials?.businessAccountId || !credentials?.accessToken) {
      return NextResponse.json(
        { error: 'Credenciais não configuradas. Configure em Configurações.' }, 
        { status: 401 }
      )
    }

    const templates = await fetchTemplatesFromMeta(
      credentials.businessAccountId, 
      credentials.accessToken
    )
    
    return NextResponse.json(templates, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('Meta API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' }, 
      { status: 500 }
    )
  }
}

// POST /api/templates - Fetch templates (with optional body credentials, fallback to Redis)
export async function POST(request: NextRequest) {
  let businessAccountId: string | undefined
  let accessToken: string | undefined

  // Try to get from request body first
  try {
    const body = await request.json()
    // Only use if they look like real credentials (not masked)
    if (body.businessAccountId && body.accessToken && !body.accessToken.includes('***')) {
      businessAccountId = body.businessAccountId
      accessToken = body.accessToken
    }
  } catch {
    // Empty body, will use Redis
  }

  // Fallback to Redis credentials
  if (!businessAccountId || !accessToken) {
    const credentials = await getWhatsAppCredentials()
    if (credentials) {
      businessAccountId = credentials.businessAccountId
      accessToken = credentials.accessToken
    }
  }

  if (!businessAccountId || !accessToken) {
    return NextResponse.json(
      { error: 'Credenciais não configuradas. Configure em Configurações.' }, 
      { status: 401 }
    )
  }

  try {
    const templates = await fetchTemplatesFromMeta(businessAccountId, accessToken)
    return NextResponse.json(templates)
  } catch (error) {
    console.error('Meta API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' }, 
      { status: 500 }
    )
  }
}
