import type { Walk } from '../../lib/supabase/database.types'
import { demoWalks } from './demo'
import { duration, localDay, periodStart, type Point } from './gps'
export type HistoryEntry = { id: string; title: string; startedAt: string; meters: number; seconds: number; demo: boolean; points?: Point[]; location?: string }

export const presentationHistoryEnabled = () => import.meta.env.DEV
export type HistoryPeriod = 'day' | 'week' | 'month' | 'year'

/** Calendar periods use the household timezone, including its Monday-based week. */
export function filterHistory(entries: HistoryEntry[], period: HistoryPeriod, timezone: string, now = new Date()) {
 const today = localDay(now.toISOString(), timezone)
 const start = period === 'year' ? `${today.slice(0, 4)}-01-01` : periodStart(period, timezone, now)
 return entries.filter(entry => { const day = localDay(entry.startedAt, timezone); return day >= start && day <= today })
}

/** View-only demo history; never modifies household records or Home statistics. */
export function walkHistory(walks: Walk[], includeExamples: boolean, user: string): HistoryEntry[] {
 const saved: HistoryEntry[] = walks.filter(walk => walk.ended_at && !walk.deleted_at).map(walk => ({
  id: walk.id, title: `${walk.walker_id === user ? 'Your walk' : 'Family walk'}${walk.end_reason === 'stationary' ? ' · Automatically ended' : ''}`,
  startedAt: walk.started_at, meters: walk.distance_m, seconds: duration(walk), demo: false,
 }))
 const examples = includeExamples ? demoWalks.map(walk => ({ ...walk, demo: true })) : []
 return [...saved, ...examples].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id))
}
export function summarizeHistory(entries: HistoryEntry[], period: 'day' | 'week' | 'month', timezone: string, now = new Date()) {
 const selected = filterHistory(entries, period, timezone, now)
 return selected.reduce((total, entry) => ({ count: total.count + 1, meters: total.meters + entry.meters, seconds: total.seconds + entry.seconds }), { count: 0, meters: 0, seconds: 0 })
}
