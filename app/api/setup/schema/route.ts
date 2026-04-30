import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
    try {
        // Use lib/migrations as the source of truth (consistent with auto-migrate)
        const migrationsDir = path.join(process.cwd(), 'lib/migrations')

        // Read specific migration files in order
        // 0001 now contains EVERYTHING (consolidated)
        const files = [
            '0001_initial_schema.sql'
        ]

        let fullSql = ''

        for (const file of files) {
            const filePath = path.join(migrationsDir, file)
            try {
                const content = await fs.readFile(filePath, 'utf-8')
                fullSql += `-- File: ${file}\n${content}\n\n`
            } catch (err) {
                console.error(`Error reading ${file}:`, err)
                fullSql += `-- Error reading ${file}\n\n`
            }
        }

        return NextResponse.json({ sql: fullSql })
    } catch (error) {
        console.error('Error serving schema:', error)
        return NextResponse.json(
            { error: 'Erro ao ler arquivos de migração' },
            { status: 500 }
        )
    }
}
