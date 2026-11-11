import { useCallback, useEffect, useState } from 'react'
import { db } from '../../lib/supabase/client'
import { errorMessage } from '../../components/ui'
import type { FamilyMember } from '../../lib/supabase/database.types'
import type { FeedingEntry, FoodProduct, PlannedMeal } from './types'
export function useFeeding(householdId: string) {
 const [products, setProducts] = useState<FoodProduct[]>([])
 const [entries, setEntries] = useState<FeedingEntry[]>([])
 const [members, setMembers] = useState<FamilyMember[]>([])
 const [plan,setPlan]=useState<PlannedMeal[]>([])
 const [warningHours,setWarning]=useState<number|null>(null)
 const [mealsPerDay, setMeals] = useState(2)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [revision, setRevision] = useState(0)
 const refresh = useCallback(() => setRevision(n => n+1), [])
 useEffect(() => {
  let active = true
  setLoading(true); setError(''); setProducts([]); setEntries([]); setMembers([])
  async function load() {
   try {
    // Page the ledger: silently using PostgREST's default row limit corrupts stock.
    const ledger: FeedingEntry[] = []
    for (let offset = 0; ; offset += 500) {
     const page = await db().from('feeding_entries').select('*').eq('household_id', householdId).order('id').range(offset, offset+499)
     if (page.error) throw page.error
     ledger.push(...page.data)
     if (page.data.length < 500) break
     if (!active) return
    }
    const [p, s, m] = await Promise.all([
     db().from('food_products').select('*').eq('household_id', householdId).order('created_at'),
     db().from('feeding_settings').select('*').eq('household_id', householdId).maybeSingle(),
     db().rpc('get_household_members', { p_household: householdId }),
    ])
    if (p.error) throw p.error; if (s.error) throw s.error; if (m.error) throw m.error
    if (active) { const plan=s.data?.meal_plan||[];setPlan(plan);setWarning(s.data?.warning_hours??null);
     const effective=p.data.map(product=>{const quantities=plan.flatMap(meal=>meal.items).filter(item=>item.product_id===product.id);return quantities.length?{...product,daily_grams:quantities.reduce((sum,item)=>sum+Number(item.quantity_grams),0)}:product});setProducts(effective); setEntries(ledger); setMembers(m.data || []); setMeals(s.data?.meals_per_day || 2) }
   } catch (error) { if (active) setError(errorMessage(error)) }
   finally { if (active) setLoading(false) }
  }
  void load()
  const focus = () => refresh()
  window.addEventListener('focus', focus)
  return () => { active = false; window.removeEventListener('focus', focus) }
 }, [householdId, revision, refresh])
 return { plan, warningHours, products, entries, members, mealsPerDay, loading, error, refresh }
}
