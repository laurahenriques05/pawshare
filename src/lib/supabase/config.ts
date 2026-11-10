// Messaging apps can insert invisible formatting into copied environment values.
export function cleanEnvironmentValue(value: string | undefined) {
 return (value || '').replace(/[\u200B-\u200D\u2060\uFEFF]/g, '').trim()
}
export function readSupabaseConfig(rawUrl: string | undefined, rawKey: string | undefined) {
 const url = cleanEnvironmentValue(rawUrl).replace(/\/+$/, '')
 const key = cleanEnvironmentValue(rawKey)
 const help = 'Check .env.local in the PawShare project folder, then restart npm run dev.'
 let error: string | null = null
 try {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash || url.includes('YOUR_PROJECT')) throw new Error('invalid URL')
 } catch { error = `The Supabase project URL is missing or invalid. ${help}` }
 if (!error) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
   // The connection checker verifies that this key belongs to the project.
  } else if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
   try {
    const claims = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (claims.role !== 'anon') throw new Error('not an anon key')
   } catch { error = `Use a publishable key or legacy anon key, never a secret or service-role key. ${help}` }
  } else { error = `The Supabase publishable key is missing or has a copy-and-paste error. ${help}` }
 }
 return { url, key, error }
}
