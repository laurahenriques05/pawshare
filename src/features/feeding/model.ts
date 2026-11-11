import type { FeedingEntry, FoodProduct } from './types'
export const categories = { dry: 'Dry food', wet: 'Wet food', treat: 'Treats' }
export function stockGrams(product: FoodProduct, entries: FeedingEntry[]) {
 return Math.round((Number(product.opening_grams) + entries.filter(e => e.product_id === product.id && !e.deleted_at).reduce((sum, e) => sum + Number(e.quantity_grams) * (e.kind === 'purchase' ? 1 : -1), 0)) * 100) / 100
}
export function stockForecast(product: FoodProduct, entries: FeedingEntry[], now = new Date()) {
 const remaining = stockGrams(product, entries)
 const days = Number(product.daily_grams) > 0 ? remaining / Number(product.daily_grams) : null
 const runsOut = days === null ? null : new Date(now.getTime() + days * 86400000)
 const buyBy = days === null ? null : new Date(now.getTime() + Math.max(0, days - product.reminder_days) * 86400000)
 return { remaining, days, runsOut, buyBy, low: days !== null && days <= product.reminder_days }
}
export function dayKey(value: string | Date, timezone: string) {
 return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}
export function localDateTime(value = new Date()) {
 return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function formatGrams(value: number) { return value >= 1000 ? `${Number((value / 1000).toFixed(2))} kg` : `${Number(value.toFixed(2))} g` }
export function regularMeals(entries: FeedingEntry[], products: FoodProduct[]) {
 const regularIds = new Set(products.filter(p => p.category !== 'treat').map(p => p.id))
 return entries.filter(e => e.kind === 'meal' && !e.deleted_at && regularIds.has(e.product_id)).sort((a,b) => b.occurred_at.localeCompare(a.occurred_at))
}

export function countMealEvents(entries:FeedingEntry[]) { return new Set(entries.map(e=>e.event_id||e.id)).size }
