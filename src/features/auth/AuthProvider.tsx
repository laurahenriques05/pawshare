import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
type AuthState = { session: Session | null; loading: boolean; error: string | null }
const Context = createContext<AuthState>({ session: null, loading: true, error: null })
export function AuthProvider({ children }: { children: ReactNode }) {
 const [state, setState] = useState<AuthState>({ session: null, loading: !!supabase, error: null })
 useEffect(() => {
  if (!supabase) return
  let live = true
  const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (live) setState({ session, loading: false, error: null }) })
  supabase.auth.getSession().then(({ data, error }) => { if (live) setState({ session: data.session, loading: false, error: error?.message || null }) }).catch(error => { if (live) setState({ session: null, loading: false, error: String(error) }) })
  return () => { live = false; data.subscription.unsubscribe() }
 }, [])
 return <Context.Provider value={state}>{children}</Context.Provider>
}
export const useAuth = () => useContext(Context)
