import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { readSupabaseConfig } from './config'
const config = readSupabaseConfig(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
export const configurationError = config.error
export const supabase = configurationError ? null : createClient<Database>(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
export const appUrl = (import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '')
export function db() { if (!supabase) throw new Error(configurationError!); return supabase }
