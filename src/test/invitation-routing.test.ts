import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetInvitation, invitationDestination, pendingInvitation, rememberInvitation, validInvitationToken } from '../features/household/invitations'
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
