import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from '../../lib/supabase/client'
import type { Dog, Household, Member } from '../../lib/supabase/database.types'
import { useAuth } from '../auth/AuthProvider'
type Data = { households: Household[]; household: Household | null; dog: Dog | null; membership: Member | null; loading: boolean; error: string | null }
const empty: Data = { households: [], household: null, dog: null, membership: null, loading: true, error: null }
const Context = createContext<Data & { reload: () => Promise<void>; select: (id: string) => void }>({ ...empty, reload: async () => {}, select: () => {} })
export function HouseholdProvider({ children }: { children: ReactNode }) {
 const { session } = useAuth(); const userId = session?.user.id
 const [selected, select] = useState<string>('')
 const [data, setData] = useState<Data>(empty)
 const reload = useCallback(async () => {
  if (!userId) { setData({ ...empty, loading: false }); return }
  setData(previous => ({ ...previous, loading: true, error: null }))
  try {
   const client = db()
   const householdsResult = await client.from('households').select('*').order('created_at')
   if (householdsResult.error) throw householdsResult.error
   const households = householdsResult.data
   const household = households.find(h => h.id === selected) || households[0] || null
   let dog: Dog | null = null; let membership: Member | null = null
   if (household) {
    const [dogs, members] = await Promise.all([client.from('dogs').select('*').eq('household_id', household.id).maybeSingle(), client.from('household_members').select('*').eq('household_id', household.id).eq('user_id', userId).single()])
    if (dogs.error) throw dogs.error; if (members.error) throw members.error
    dog = dogs.data; membership = members.data
   }
   setData({ households, household, dog, membership, loading: false, error: null })
  } catch (error) { setData({ ...empty, loading: false, error: (error as Error).message }) }
 }, [userId, selected])
 useEffect(() => { void reload() }, [reload])
 return <Context.Provider value={{ ...data, reload, select }}>{children}</Context.Provider>
}
export const useHousehold = () => useContext(Context)
