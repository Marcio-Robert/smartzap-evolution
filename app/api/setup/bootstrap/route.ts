/**
 * Setup Bootstrap API
 * 
 * POST: Validate Vercel token and find project
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateToken, findProjectByDomain } from '@/lib/vercel-api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, domain } = body

    if (!token) {
      return NextResponse.json(
        { error: 'Token é obrigatório' },
        { status: 400 }
      )
    }

    // Validate token
    const tokenResult = await validateToken(token)
    if (!tokenResult.success) {
      return NextResponse.json(
        { error: tokenResult.error },
        { status: 401 }
      )
    }

    // Find project by domain
    const hostname = domain || request.headers.get('host') || ''
    const projectResult = await findProjectByDomain(token, hostname)
    
    if (!projectResult.success || !projectResult.data) {
      return NextResponse.json(
        { error: projectResult.error || 'Projeto não encontrado' },
        { status: 404 }
      )
    }

    // Get the primary URL - prefer first production alias, fallback to project-name.vercel.app
    const productionAliases = projectResult.data.targets?.production?.alias || []
    const projectAliases = projectResult.data.alias?.map(a => a.domain) || []
    const allAliases = [...productionAliases, ...projectAliases]
    
    // Find the first .vercel.app domain as the primary URL
    const primaryUrl = allAliases.find(a => a.endsWith('.vercel.app')) || 
                       `${projectResult.data.name}.vercel.app`

    return NextResponse.json({
      success: true,
      project: {
        id: projectResult.data.id,
        name: projectResult.data.name,
        teamId: projectResult.data.accountId,
        url: primaryUrl,
      }
    })

  } catch (error) {
    console.error('Bootstrap error:', error)
    return NextResponse.json(
      { error: 'Erro ao validar configuração' },
      { status: 500 }
    )
  }
}
