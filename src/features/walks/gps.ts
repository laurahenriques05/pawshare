import type { Walk, WalkPoint } from '../../lib/supabase/database.types'
export type Point = Omit<WalkPoint, 'walk_id'>
export const GPS_POLICY = { accuracy: 50, maxGap: 60_000, maxSpeed: 5, minInterval: 5000, stationaryRadius: 30, stationaryMs: 600_000, warningMs: 120_000 }
const rad = (n: number) => n * Math.PI / 180
export function distance(a: Pick<Point, 'latitude' | 'longitude'>, b: Pick<Point, 'latitude' | 'longitude'>) {
 const h = Math.sin(rad(b.latitude-a.latitude)/2)**2 + Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2
 return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)))
}
export function segment(a: Point, b: Point) {
 const dt = Date.parse(b.recorded_at)-Date.parse(a.recorded_at)
 const meters = distance(a,b)
 return dt>0 && dt<=GPS_POLICY.maxGap && meters>Math.max(3,(a.accuracy+b.accuracy)/2) && meters/(dt/1000)<=GPS_POLICY.maxSpeed ? meters : 0
}
export function routeDistance(points: Point[]) { return points.reduce((total,p,i)=>total+(i ? segment(points[i-1],p) : 0),0) }
export function acceptable(point: Point, previous?: Point, now=Date.now()) {
 if (![point.latitude,point.longitude,point.accuracy,Date.parse(point.recorded_at)].every(Number.isFinite) || Math.abs(point.latitude)>90 || Math.abs(point.longitude)>180 || point.accuracy<0 || point.accuracy>GPS_POLICY.accuracy || Math.abs(now-Date.parse(point.recorded_at))>30_000) return false
 if (!previous) return true
 const dt=Date.parse(point.recorded_at)-Date.parse(previous.recorded_at)
 return dt>=GPS_POLICY.minInterval && (dt>GPS_POLICY.maxGap || distance(previous,point)/(dt/1000)<=GPS_POLICY.maxSpeed)
}
// Only continuous, fresh, reasonably accurate fixes can establish stationarity.
export type Stationary = { anchor: Point; since: number; last: number; warnedAt: number | null }
export function stationaryFix(state: Stationary | null, point: Point): Stationary | null {
 if(point.accuracy>25)return null
 const time=Date.parse(point.recorded_at)
 if (!state || time-state.last>GPS_POLICY.maxGap || time<=state.last || distance(state.anchor,point)>GPS_POLICY.stationaryRadius) return {anchor:point,since:time,last:time,warnedAt:null}
 return {...state,last:time}
}
export function stationaryTick(state:Stationary|null,now:number,enabled:boolean,visible:boolean,recording:boolean):{state:Stationary|null;action:'none'|'warn'|'end'} {
 if(!enabled||!visible||!recording||!state||now-state.last>15000)return {state:null,action:'none'}
 if(state.warnedAt===null&&now-state.since>=GPS_POLICY.stationaryMs)return {state:{...state,warnedAt:now},action:'warn'}
 if(state.warnedAt!==null&&now-state.warnedAt>=GPS_POLICY.warningMs)return {state,action:'end'}
 return {state,action:'none'}
}
export function duration(walk: Pick<Walk,'started_at'|'ended_at'>,now=Date.now()) { return Math.max(0,((walk.ended_at ? Date.parse(walk.ended_at) : now)-Date.parse(walk.started_at))/1000) }
export function timeLabel(seconds: number) { const mins=Math.floor(seconds/60); return `${Math.floor(mins/60)}h ${mins%60}m` }
export function paceLabel(meters: number, seconds: number) { if(meters<10 || seconds<=0) return '—'; const pace=Math.round(seconds/(meters/1000)); return `${Math.floor(pace/60)}:${String(pace%60).padStart(2,'0')} min/km` }
export function localDay(iso: string,timezone: string) { return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso)) }
export function periodStart(period:'day'|'week'|'month',timezone:string,now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
 const value=(key:string)=>Number(parts.find(p=>p.type===key)!.value)
 const date=new Date(Date.UTC(value('year'),value('month')-1,value('day')))
 if(period==='week') date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7))
 if(period==='month') date.setUTCDate(1)
 return date.toISOString().slice(0,10)
}
export function summarize(walks:Walk[],period:'day'|'week'|'month',timezone:string,now=new Date()) {
 const start=periodStart(period,timezone,now),today=localDay(now.toISOString(),timezone)
 const selected=walks.filter(w=>w.ended_at&&!w.deleted_at&&localDay(w.started_at,timezone)>=start&&localDay(w.started_at,timezone)<=today)
 return {count:selected.length,meters:selected.reduce((s,w)=>s+w.distance_m,0),seconds:selected.reduce((s,w)=>s+duration(w),0)}
}
