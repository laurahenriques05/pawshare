const key = 'pawshare.pending-invitation'
export function validInvitationToken(value: string | null | undefined): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) }
export function pendingInvitation(search = ''): string | null {
 const explicit = new URLSearchParams(search).get('invite')
 if (validInvitationToken(explicit)) return explicit
 try { const saved = localStorage.getItem(key); return validInvitationToken(saved) ? saved : null } catch { return null }
}
export function rememberInvitation(token: string) { if (validInvitationToken(token)) { try { localStorage.setItem(key, token) } catch { /* URL still carries the token. */ } } }
export function forgetInvitation() { try { localStorage.removeItem(key) } catch { /* Storage may be disabled. */ } }
export function invitationDestination(search = '') { const token = pendingInvitation(search); return token ? `/invite/${token}` : '/' }
