import type { TaskOccurrence, TaskSeries } from '../../lib/supabase/database.types'
import { localTime } from '../health/time'

export type TaskStatus = 'completed' | 'overdue' | 'upcoming'
export function taskStatus(occurrence: Pick<TaskOccurrence, 'due_at'|'completed_at'>, now = Date.now()): TaskStatus {
 if (occurrence.completed_at) return 'completed'
 return Date.parse(occurrence.due_at) < now ? 'overdue' : 'upcoming'
}
export function recurrenceLabel(series: Pick<TaskSeries, 'recurrence'|'recurrence_every'>) {
 if (series.recurrence === 'none') return 'One-time'
 const unit = series.recurrence === 'daily' ? 'day' : series.recurrence === 'weekly' ? 'week' : 'month'
 return `Every ${series.recurrence_every === 1 ? '' : `${series.recurrence_every} `}${unit}${series.recurrence_every === 1 ? '' : 's'}`
}
export type CalendarSource = 'task'|'feeding'|'health'
export type CalendarEvent = { id:string; source:CalendarSource; sourceRecordId:string; title:string; occursAt:string; remindAt:string|null; assignedTo:string|null; href:string; completed?:boolean; allDay?:boolean }
export function eventOnDate(event: CalendarEvent, date: string, zone: string) { return localTime(event.occursAt, zone).slice(0, 10) === date }
export function monthRange(month: string) {
 const [year, number] = month.split('-').map(Number)
 const start = new Date(Date.UTC(year, number - 1, 1) - 14 * 60 * 60 * 1000)
 const end = new Date(Date.UTC(year, number, 1) + 14 * 60 * 60 * 1000)
 return { from:start.toISOString(), until:end.toISOString() }
}
export function shiftMonth(month: string, step: number) {
 const [year, number] = month.split('-').map(Number)
 return new Date(Date.UTC(year, number - 1 + step, 1)).toISOString().slice(0, 7)
}
