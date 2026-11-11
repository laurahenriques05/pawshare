import { Link } from 'react-router-dom'
import { Utensils } from 'lucide-react'
import { Notice } from '../../components/ui'
import { useFeeding } from './useFeeding'
import { countMealEvents, dayKey, regularMeals, stockForecast } from './model'
export function FeedingHomeCard({ householdId, timezone }: { householdId: string; timezone: string }) {
 const data = useFeeding(householdId)
 const meals = regularMeals(data.entries, data.products).filter(e => dayKey(e.occurred_at, timezone) === dayKey(new Date(), timezone))
 const low = data.products.filter(p => stockForecast(p,data.entries).low)
 return <section className="card feeding-home"><div className="home-card-heading"><span className="icon-tile"><Utensils size={20}/></span><div><p className="eyebrow">THE EVERYDAY ROUTINE</p><h3>Feeding & food stock</h3></div></div>{data.loading ? <p role="status">Checking the food cupboard…</p> : data.error ? <Notice error>Feeding is unavailable. Open Feeding to retry.</Notice> : <><p className="muted">{countMealEvents(meals)} / {data.mealsPerDay} regular meals recorded today.</p>{low.length>0 && <Notice>Time to restock: {low.map(p=>p.name).join(', ')}.</Notice>}{!data.products.length && <p className="muted">Add your first food product and feeding routine.</p>}</>}<Link className="text-link" to="/feed">Open Feeding →</Link></section>
}
