import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseInvitationInput, forgetInvitation, invitationDestination, pendingInvitation, rememberInvitation, validInvitationToken } from '../features/household/invitations'
const token='a'.repeat(64)
beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)})})
afterEach(()=>vi.unstubAllGlobals())
describe('invitation continuation',()=>{
 it('accepts opaque tokens only, never arbitrary redirect URLs',()=>{expect(validInvitationToken(token)).toBe(true);expect(validInvitationToken('https://evil.test')).toBe(false);expect(invitationDestination('?invite=https://evil.test')).toBe('/')})
 it('preserves the invitation across signup and the email confirmation callback',()=>{rememberInvitation(token);expect(pendingInvitation()).toBe(token);expect(invitationDestination()).toBe(`/invite/${token}`)})
 it('lets an explicit new invitation replace a stored continuation',()=>{rememberInvitation(token);expect(pendingInvitation(`?invite=${'b'.repeat(64)}`)).toBe('b'.repeat(64))})
 it('clears continuation after acceptance or cancellation',()=>{rememberInvitation(token);forgetInvitation();expect(invitationDestination()).toBe('/')})
 it('handles disabled browser storage',()=>{vi.stubGlobal('localStorage',{getItem(){throw new Error('blocked')},setItem(){throw new Error('blocked')},removeItem(){throw new Error('blocked')}});expect(()=>rememberInvitation(token)).not.toThrow();expect(invitationDestination(`?invite=${token}`)).toBe(`/invite/${token}`)})
})

describe('pasted invitations', () => {
 it('accepts copied links, old localhost links and raw codes without external redirects', () => {
  expect(parseInvitationInput(` https://pawshare.example/invite/${token} `)).toBe(token)
  expect(parseInvitationInput(`http://localhost:5173/invite/${token}`)).toBe(token)
  expect(parseInvitationInput(token)).toBe(token)
 })
 it('rejects unrelated pages, malformed codes and executable URLs', () => {
  expect(parseInvitationInput(`https://example.com/profile/${token}`)).toBeNull()
  expect(parseInvitationInput(`javascript:alert(1)`)).toBeNull()
  expect(parseInvitationInput('Cookie family')).toBeNull()
  expect(parseInvitationInput(`https://example.com/invite/${token}/extra`)).toBeNull()
 })
})

it('accepts grouped invitation codes regardless of case', () => {
 expect(parseInvitationInput('ABCDEF12-34567890-ABCDEF12-34567890')).toBe('abcdef1234567890abcdef1234567890')
 expect(parseInvitationInput('abcdef12 34567890 abcdef12 34567890')).toBe('abcdef1234567890abcdef1234567890')
})
