import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'
import { promises as fs } from 'fs'
import path from 'path'

export async function POST(request: NextRequest) {
    let client: Client | null = null

    try {
        const { connectionString, action } = await request.json()

        if (!connectionString) {
            return NextResponse.json(
                { error: 'Connection string is required' },
                { status: 400 }
            )
        }

        // Connect to database
        client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false } // Required for Supabase (and most cloud PGs)
        })

        await client.connect()

        // Handle Nuclear Reset if requested
        if (action === 'reset') {
            console.log('☢️ NUCLEAR RESET TRIGGERED ☢️')
            await client.query(`
                DROP SCHEMA public CASCADE;
                CREATE SCHEMA public;
                GRANT ALL ON SCHEMA public TO postgres;
                GRANT ALL ON SCHEMA public TO public;
            `)
        }

        // Handle Check logic
        if (action === 'check') {
            const res = await client.query(`
                SELECT count(*) FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
            `)
            const count = parseInt(res.rows[0].count)
            return NextResponse.json({
                success: true,
                exists: count > 0,
                count
            })
        }

        // Read SQL files (default 'migrate' action)
        const migrationsDir = path.join(process.cwd(), 'lib/migrations')
        const files = [
            '0001_initial_schema.sql'
        ]

        let fullSql = ''

        for (const file of files) {
            const filePath = path.join(migrationsDir, file)
            const content = await fs.readFile(filePath, 'utf-8')
            fullSql += content + '\n\n'
        }

        // Split statements simply by semicolon to execute individually or as big block?
        // Postgres driver can often handle multiple statements, but let's try one big block or split?
        // 'pg' allows multiple statements in one query call usually.

        // Execute SQL
        await client.query(fullSql)

        return NextResponse.json({ success: true, message: 'Migrações aplicadas com sucesso!' })

    } catch (error: any) {
        console.error('Migration error:', error)

        let errorMessage = error.message

        // Help user debug connection issues
        if (error.code === 'ENOTFOUND' && error.hostname?.includes('supabase.co')) {
            errorMessage = `Não foi possível conectar ao banco de dados (${error.hostname}). 
            Se você estiver usando a conexão direta (porta 5432), ela pode ser apenas IPv6. 
            Tente usar a Connection String do "Connection Pooler" (porta 6543, domínio *.pooler.supabase.com).`
        }

        return NextResponse.json(
            { error: `Erro na migração: ${errorMessage}` },
            { status: 500 }
        )
    } finally {
        if (client) {
            await client.end().catch(console.error)
        }
    }
}
