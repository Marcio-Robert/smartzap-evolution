#!/usr/bin/env node
/**
 * Script para aplicar migrations no Supabase
 * 
 * COMO USAR:
 * 1. Execute este script: npx ts-node scripts/apply-supabase-migration.ts
 * 2. OU copie o SQL de supabase/migrations/0001_initial_schema.sql
 *    e execute no Supabase Dashboard > SQL Editor
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Faltam variáveis de ambiente:')
    console.error('   NEXT_PUBLIC_SUPABASE_URL')
    console.error('   SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
    console.log('🚀 Aplicando migração no Supabase...\n')

    // Read migration file
    const migrationPath = join(__dirname, '../supabase/migrations/0001_initial_schema.sql')
    const sql = readFileSync(migrationPath, 'utf-8')

    console.log('📄 Lendo migration:', migrationPath)
    console.log('📊 Tamanho do SQL:', sql.length, 'caracteres\n')

    // Split by semicolon and filter empty statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📝 Executando ${statements.length} statements...\n`)

    let success = 0
    let errors = 0

    for (const statement of statements) {
        // Skip comments-only statements
        if (statement.split('\n').every(line => line.trim().startsWith('--') || line.trim() === '')) {
            continue
        }

        try {
            const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

            if (error) {
                // Ignore "already exists" errors
                if (error.message?.includes('already exists')) {
                    console.log(`⏭️  Já existe: ${statement.substring(0, 50)}...`)
                } else {
                    console.error(`❌ Erro: ${error.message}`)
                    console.error(`   SQL: ${statement.substring(0, 100)}...`)
                    errors++
                }
            } else {
                console.log(`✅ OK: ${statement.substring(0, 50)}...`)
                success++
            }
        } catch (err) {
            console.error(`❌ Exception:`, err)
            errors++
        }
    }

    console.log(`\n📊 Resultado: ${success} sucesso, ${errors} erros`)

    if (errors === 0) {
        console.log('\n✅ Migração aplicada com sucesso!')
    } else {
        console.log('\n⚠️  Algumas queries falharam. Verifique no Supabase Dashboard.')
    }
}

applyMigration().catch(console.error)
