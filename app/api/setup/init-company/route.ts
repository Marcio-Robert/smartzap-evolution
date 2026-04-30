import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'

export async function GET() {
    try {
        // STEP 1: Auto-migrate if database is empty
        const { data: tables, error: checkError } = await supabase
            .from('settings')
            .select('key')
            .limit(1)

        if (checkError && checkError.message.includes('relation "settings" does not exist')) {
            console.log('🔄 Database empty, running auto-migration...')

            const { Client } = await import('pg')
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

            if (!supabaseUrl || !supabaseServiceKey) {
                throw new Error('Supabase not configured')
            }

            const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1]
            // Use direct connection format: postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
            const connectionString = `postgresql://postgres:${encodeURIComponent(supabaseServiceKey)}@db.${projectRef}.supabase.co:5432/postgres`

            const client = new Client({
                connectionString,
                ssl: { rejectUnauthorized: false }
            })

            await client.connect()

            const sqlPath = path.join(process.cwd(), 'lib', 'migrations', '0001_initial_schema.sql')
            const sql = await fs.readFile(sqlPath, 'utf-8')

            await client.query(sql)
            await client.end()

            console.log('✅ Database migrated successfully')
        }

        // STEP 2: Init company
        // Check if we have company info in env vars (set during wizard)
        const companyName = process.env.SETUP_COMPANY_NAME
        const companyEmail = process.env.SETUP_COMPANY_EMAIL
        const companyPhone = process.env.SETUP_COMPANY_PHONE

        if (!companyName || !companyEmail || !companyPhone) {
            return NextResponse.json({
                success: false,
                message: 'No company info in environment'
            })
        }

        // Try to save to database
        const now = new Date().toISOString()
        const companyId = crypto.randomUUID()

        // Check if company already exists
        const { data: existingCompany } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'company_name')
            .single()

        if (existingCompany?.value) {
            return NextResponse.json({
                success: true,
                message: 'Company already initialized'
            })
        }

        // Save company info
        await Promise.all([
            supabase.from('settings').upsert({ key: 'company_id', value: companyId, updated_at: now }, { onConflict: 'key' }),
            supabase.from('settings').upsert({ key: 'company_name', value: companyName, updated_at: now }, { onConflict: 'key' }),
            supabase.from('settings').upsert({ key: 'company_email', value: companyEmail.toLowerCase(), updated_at: now }, { onConflict: 'key' }),
            supabase.from('settings').upsert({ key: 'company_phone', value: companyPhone.replace(/\D/g, ''), updated_at: now }, { onConflict: 'key' }),
            supabase.from('settings').upsert({ key: 'company_created_at', value: now, updated_at: now }, { onConflict: 'key' }),
        ])

        return NextResponse.json({
            success: true,
            message: 'Company initialized successfully',
            company: {
                id: companyId,
                name: companyName,
                email: companyEmail,
                phone: companyPhone
            }
        })

    } catch (error) {
        console.error('Init company error:', error)
        return NextResponse.json({
            success: false,
            error: 'Failed to initialize company'
        }, { status: 500 })
    }
}
