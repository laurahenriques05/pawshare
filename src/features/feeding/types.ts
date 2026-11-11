export type FoodCategory = 'dry' | 'wet' | 'treat'
export type FoodProduct = { id: string; household_id: string; name: string; category: FoodCategory; portion_grams: number; daily_grams: number; opening_grams: number; reminder_days: number; created_at: string }
export type FeedingEntry = { event_id?:string|null; id: string; household_id: string; product_id: string; kind: 'meal' | 'purchase'; quantity_grams: number; package_grams: number | null; packages: number | null; occurred_at: string; created_by: string; source: 'app' | 'nfc'; deleted_at: string | null; created_at: string; updated_at: string }
export type PlannedMeal = { id:string; name:string; time:string; notes:string; items:{product_id:string; quantity_grams:number}[] }
export type FeedingSettings = { household_id: string; meals_per_day: number; meal_plan:PlannedMeal[]; warning_hours:number|null }
export type FeedingAudit = { id: number; household_id: string; actor_id: string; entity_id: string; entity_type: string; before_value: unknown; after_value: unknown; changed_at: string }
