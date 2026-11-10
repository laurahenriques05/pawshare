import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from '../lib/supabase/config'
const url = 'https://example.supabase.co'
const key = 'sb_publishable_test_key'
describe('Supabase client configuration', () => {
 it('accepts a formatted project URL and publishable key', () => expect(readSupabaseConfig(url, key).error).toBeNull())
 it('removes invisible messaging-app formatting and outside whitespace', () => {
  const config = readSupabaseConfig(`\u2060 ${url}/ \u200B`, `\uFEFF${key}\u2060`)
  expect(config.url).toBe(url);expect(config.key).toBe(key);expect(config.error).toBeNull()
 })
 it('rejects missing values, placeholders, and dashboard URLs', () => {
  for (const value of [undefined, '', 'https://YOUR_PROJECT.supabase.co', 'https://supabase.com/dashboard/project/example']) expect(readSupabaseConfig(value, key).error).not.toBeNull()
  expect(readSupabaseConfig(url, 'YOUR_PUBLISHABLE_KEY').error).not.toBeNull()
 })
 it('blocks secret keys and service-role JWTs', () => {
  const payload = Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')
  expect(readSupabaseConfig(url, 'sb_secret_test').error).not.toBeNull()
  expect(readSupabaseConfig(url, `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`).error).not.toBeNull()
 })
 it('retains compatibility with legacy anon keys', () => {
  const payload = Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')
  expect(readSupabaseConfig(url, `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`).error).toBeNull()
 })
})
