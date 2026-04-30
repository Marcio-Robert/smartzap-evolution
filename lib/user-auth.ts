/**
 * User Authentication System for Single-Tenant DaaS
 * 
 * Simple auth using MASTER_PASSWORD from environment variable
 * - No password hashing needed (password stored in Vercel env)
 * - httpOnly + Secure cookies for sessions
 * - Rate limiting for brute force protection
 * 
 * MIGRATED: Now uses Supabase (PostgreSQL) instead of Turso
 */

import { cookies } from 'next/headers'
import { supabase } from './supabase'

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_COOKIE_NAME = 'smartzap_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds
const MAX_LOGIN_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 * 1000 // 15 minutes

// ============================================================================
// TYPES
// ============================================================================

export interface Company {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export interface UserAuthResult {
  success: boolean
  error?: string
  company?: Company
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Upsert a setting in the database
 */
async function upsertSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString()
  await supabase
    .from('settings')
    .upsert({ key, value, updated_at: now }, { onConflict: 'key' })
}

/**
 * Get a setting from the database
 */
async function getSetting(key: string): Promise<{ value: string; updated_at: string } | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value, updated_at')
    .eq('key', key)
    .single()

  if (error || !data) return null
  return data
}

/**
 * Delete a setting from the database
 */
async function deleteSetting(key: string): Promise<void> {
  await supabase.from('settings').delete().eq('key', key)
}

/**
 * Check if setup is completed (company exists)
 */
export async function isSetupComplete(): Promise<boolean> {
  // RADICAL FIX: Just check the env var instead of database
  // The database queries are failing and causing loops
  console.log('🔍 [isSetupComplete] SETUP_COMPLETE env:', process.env.SETUP_COMPLETE)
  return process.env.SETUP_COMPLETE === 'true'
}

/**
 * Get company info
 */
export async function getCompany(): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['company_id', 'company_name', 'company_email', 'company_phone', 'company_created_at'])

    if (error || !data || data.length === 0) return null

    const settings: Record<string, string> = {}
    data.forEach(row => {
      settings[row.key] = row.value
    })

    if (!settings.company_name) return null

    return {
      id: settings.company_id || 'default',
      name: settings.company_name,
      email: settings.company_email || '',
      phone: settings.company_phone || '',
      createdAt: settings.company_created_at || new Date().toISOString()
    }
  } catch {
    return null
  }
}

// ============================================================================
// SETUP (First-time configuration)
// ============================================================================

/**
 * Complete initial setup - create company, email, phone
 * Password is handled via MASTER_PASSWORD env var
 */
export async function completeSetup(
  companyName: string,
  email: string,
  phone: string
): Promise<UserAuthResult> {
  // Validate inputs
  if (!companyName || companyName.trim().length < 2) {
    return { success: false, error: 'Nome da empresa deve ter pelo menos 2 caracteres' }
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'E-mail inválido' }
  }

  if (!phone || phone.replace(/\D/g, '').length < 10) {
    return { success: false, error: 'Telefone inválido' }
  }

  try {
    const now = new Date().toISOString()
    // Use existing company_id if available, otherwise create new
    const existingId = await getSetting('company_id')
    const companyId = existingId?.value || crypto.randomUUID()

    // Save company info using parallel upserts
    await Promise.all([
      upsertSetting('company_id', companyId),
      upsertSetting('company_name', companyName.trim()),
      upsertSetting('company_email', email.trim().toLowerCase()),
      upsertSetting('company_phone', phone.replace(/\D/g, '')),
      upsertSetting('company_created_at', now)
    ])

    // Create session after setup
    await createSession()

    return {
      success: true,
      company: {
        id: companyId,
        name: companyName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.replace(/\D/g, ''),
        createdAt: now
      }
    }
  } catch (error) {
    console.error('Setup error:', error)
    return { success: false, error: 'Erro ao salvar configuração' }
  }
}

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================

/**
 * Attempt login with password
 * Validates against MASTER_PASSWORD env var
 */
export async function loginUser(password: string): Promise<UserAuthResult> {
  if (!password) {
    return { success: false, error: 'Senha é obrigatória' }
  }

  // Check if MASTER_PASSWORD is configured
  const masterPassword = process.env.MASTER_PASSWORD
  if (!masterPassword) {
    return { success: false, error: 'MASTER_PASSWORD não configurada nas variáveis de ambiente' }
  }

  // Check rate limiting
  const isLocked = await checkRateLimiting()
  if (isLocked) {
    return { success: false, error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
  }

  try {
    // Simple comparison with env var
    const isValid = password === masterPassword

    if (!isValid) {
      await recordFailedAttempt()
      return { success: false, error: 'Senha incorreta' }
    }

    // Clear failed attempts on success
    await clearFailedAttempts()

    // Create session
    await createSession()

    const company = await getCompany()
    return { success: true, company: company || undefined }

  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Erro ao fazer login' }
  }
}

/**
 * Logout - destroy session
 */
export async function logoutUser(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new session
 */
async function createSession(): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = crypto.randomUUID()

  // Store session in database
  await upsertSetting('session_token', sessionToken)

  // Set cookie
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/'
  })
}

/**
 * Validate current session
 */
export async function validateSession(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!sessionToken) return false

    // Check if token matches stored session
    const setting = await getSetting('session_token')
    if (!setting) return false

    const storedToken = setting.value
    const updatedAt = new Date(setting.updated_at)

    // Check if session is expired
    const now = new Date()
    const sessionAge = (now.getTime() - updatedAt.getTime()) / 1000
    if (sessionAge > SESSION_MAX_AGE) {
      await logoutUser()
      return false
    }

    return sessionToken === storedToken
  } catch {
    return false
  }
}

/**
 * Get auth status for client
 * OPTIMIZED: Parallelized queries for better performance
 */
export async function getUserAuthStatus(): Promise<{
  isSetup: boolean
  isAuthenticated: boolean
  company: Company | null
}> {
  console.log('🔍 [getUserAuthStatus] === START ===')
  // Run in parallel instead of sequentially!
  console.log('🔍 [getUserAuthStatus] Calling isSetupComplete and validateSession...')
  const [isSetup, isAuthenticated] = await Promise.all([
    isSetupComplete(),
    validateSession()
  ])
  console.log('🔍 [getUserAuthStatus] isSetup:', isSetup)
  console.log('🔍 [getUserAuthStatus] isAuthenticated:', isAuthenticated)

  // Only fetch company if authenticated 
  console.log('🔍 [getUserAuthStatus] Fetching company...')
  const company = isAuthenticated ? await getCompany() : null
  console.log('🔍 [getUserAuthStatus] company:', company ? `Found: ${company.name}` : 'null')

  const result = { isSetup, isAuthenticated, company }
  console.log('🔍 [getUserAuthStatus] Final result:', JSON.stringify(result, null, 2))
  return result
}

// ============================================================================
// RATE LIMITING (Brute Force Protection)
// ============================================================================

async function checkRateLimiting(): Promise<boolean> {
  try {
    const setting = await getSetting('login_attempts')
    if (!setting) return false

    const attempts = parseInt(setting.value) || 0
    const lastAttempt = new Date(setting.updated_at)
    const now = new Date()

    // Reset if lockout period passed
    if (now.getTime() - lastAttempt.getTime() > LOCKOUT_DURATION) {
      await clearFailedAttempts()
      return false
    }

    return attempts >= MAX_LOGIN_ATTEMPTS
  } catch {
    return false
  }
}

async function recordFailedAttempt(): Promise<void> {
  // Get current count
  const setting = await getSetting('login_attempts')
  const currentAttempts = setting ? parseInt(setting.value) || 0 : 0

  await upsertSetting('login_attempts', (currentAttempts + 1).toString())
}

async function clearFailedAttempts(): Promise<void> {
  await deleteSetting('login_attempts')
}

// ============================================================================
// PASSWORD INFO
// ============================================================================

/**
 * Password is managed via MASTER_PASSWORD environment variable in Vercel.
 * To change the password:
 * 1. Go to Vercel Dashboard
 * 2. Project Settings > Environment Variables
 * 3. Update MASTER_PASSWORD
 * 4. Redeploy
 */
