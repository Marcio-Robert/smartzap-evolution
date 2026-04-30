
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { token, projectId, teamId } = await request.json()

        if (!token || !projectId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const queryFn = new URLSearchParams()
        if (teamId) queryFn.append('teamId', teamId)

        // Fetch envs from Vercel
        // We need decrypt=true to get the actual values of sensitive vars
        const res = await fetch(
            `https://api.vercel.com/v9/projects/${projectId}/env?${queryFn.toString()}&decrypt=true`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        )

        if (!res.ok) {
            const error = await res.json()
            console.error('Vercel API error:', error)
            return NextResponse.json({ error: 'Failed to fetch env vars' }, { status: res.status })
        }

        const data = await res.json()

        // Vercel returns { envs: [...] }
        return NextResponse.json({ envs: data.envs || [] })
    } catch (error: any) {
        console.error('Get env error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
