import { NextResponse } from 'next/server'
import { templateProjectDb } from '@/lib/supabase-db'

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const project = await templateProjectDb.getById(id)
        return NextResponse.json(project)
    } catch (error) {
        console.error('Failed to fetch template project details:', error)
        return NextResponse.json(
            { error: 'Failed to fetch template project details' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        await templateProjectDb.delete(id)
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete template project:', error)
        return NextResponse.json(
            { error: 'Failed to delete template project' },
            { status: 500 }
        )
    }
}
