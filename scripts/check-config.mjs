import { loadEnv } from 'vite'
const env = loadEnv('development', process.cwd(), 'VITE_')
const clean = value => (value || '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim()
const url = clean(env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const key = clean(env.VITE_SUPABASE_PUBLISHABLE_KEY)
try {
 const parsed = new URL(url)
 if (!['https:', 'http:'].includes(parsed.protocol) || !key || key.startsWith('sb_secret_')) throw new Error('Use the project URL and publishable key from .env.example.')
 if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
  let role
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role } catch { /* Invalid key handled below. */ }
  if (role !== 'anon') throw new Error('Use a publishable or legacy anon key. Never use a service-role key.')
 }
 console.log(`Checking Supabase connection to ${parsed.hostname}…`)
 const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) })
 if (!response.ok) throw new Error(`Supabase rejected the configuration (HTTP ${response.status}). Copy .env.example to .env.local and retry. Also check for VITE_ variables set in your terminal or editor that override the file.`)
 console.log('Connection OK. This project accepts your API key. Restart npm run dev after changing .env.local.')
} catch (error) {
 console.error(`Configuration check failed: ${error.message}`)
 process.exitCode = 1
}
