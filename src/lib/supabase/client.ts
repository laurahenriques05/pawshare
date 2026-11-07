import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const configurationError = !url || !key || !/^https?:\/\//.test(url) || url.includes('YOUR_PROJECT') || key.includes('YOUR_')
 ? 'Add your Supabase URL and publishable key to .env.local, then restart the dev server.' : null
export const supabase = configurationError ? null : createClient<Database>(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
export const appUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')
export function db() { if (!supabase) throw new Error(configurationError!); return supabase }
