import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('can be imported without a browser or local configuration', async () => {
 vi.resetModules()
 vi.stubEnv('VITE_APP_URL', '')
 vi.stubEnv('VITE_SUPABASE_URL', '')
 vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
 const client = await import('../lib/supabase/client')
 expect(client.appUrl).toBe('')
 expect(client.supabase).toBeNull()
 expect(client.configurationError).toContain('URL')
})
