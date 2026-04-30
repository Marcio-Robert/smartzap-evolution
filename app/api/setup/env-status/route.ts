/**
 * API Route: Get Environment Variable Status
 * 
 * Returns which env vars are already configured (without exposing values)
 * Used by the wizard to skip already-configured steps
 */

import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET() {
    // Check which env vars exist (return boolean, not values for security)
    const status = {
        // Password
        masterPassword: !!process.env.MASTER_PASSWORD,

        // Supabase
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,

        // Redis/Upstash
        redisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        redisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
        qstashToken: !!process.env.QSTASH_TOKEN,

        // WhatsApp
        whatsappToken: !!process.env.WHATSAPP_TOKEN,
        whatsappPhoneId: !!process.env.WHATSAPP_PHONE_ID,
        whatsappBusinessId: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    }

    // Calculate which steps are complete
    const steps = {
        password: status.masterPassword,
        database: status.supabaseUrl && status.supabaseAnonKey && status.supabaseServiceKey,
        redis: status.redisUrl && status.redisToken && status.qstashToken,
        whatsapp: status.whatsappToken && status.whatsappPhoneId && status.whatsappBusinessId,
    }

    // All infra is configured, only company info might be missing
    const allConfigured = steps.password && steps.database && steps.redis && steps.whatsapp

    // Check if we can use server-side Vercel token for resume operations
    const hasVercelToken = !!process.env.VERCEL_TOKEN

    return NextResponse.json({
        status,
        steps,
        allConfigured,
        hasVercelToken,
        // If all infra is configured, user only needs to complete company info
        nextStep: allConfigured ? 5 :
            !steps.password ? 1 :
                !steps.database ? 2 :
                    !steps.redis ? 3 :
                        !steps.whatsapp ? 4 : 5
    })
}
