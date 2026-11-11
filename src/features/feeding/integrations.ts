import { stockForecast } from './model'
import type { FeedingEntry, FoodProduct } from './types'
/** Proposed adapter for Maria: no shared schema or push provider is created here. */
export function foodRestockingEvents(products: FoodProduct[], entries: FeedingEntry[], now = new Date()) {
 return products.flatMap(product => {
  const forecast = stockForecast(product, entries, now)
  if (!forecast.runsOut || !forecast.buyBy) return []
  return [{ id: `food-restock:${product.id}`, householdId: product.household_id, source: 'feeding' as const, sourceRecordId: product.id, title: `Buy ${product.name}`, occursAt: forecast.buyBy.toISOString(), estimatedRunOutAt: forecast.runsOut.toISOString(), remindAt: forecast.buyBy.toISOString(), assignedTo: null, href: '/feed', lowStock: forecast.low }]
 })
}
