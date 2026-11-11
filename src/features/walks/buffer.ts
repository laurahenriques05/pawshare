import type { Point } from './gps'
export type WalkBuffer = { walk: string; points: Point[]; ending: { at: string; reason: 'manual'|'stationary' } | null }
export function parseBuffer(raw:string|null,walk:string):WalkBuffer|null {
 try {
  const value=JSON.parse(raw||'null')
  if(value?.walk!==walk||!Array.isArray(value.points)||!value.points.every((p:Point)=>Number.isInteger(p.seq)&&p.seq>=0&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=90&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&Number.isFinite(p.accuracy)&&p.accuracy>=0&&p.accuracy<=50&&Number.isFinite(Date.parse(p.recorded_at))))return null
  if(value.ending!==null&&(!value.ending||!Number.isFinite(Date.parse(value.ending.at))||!['manual','stationary'].includes(value.ending.reason)))return null
  return value
 }catch{return null}
}
export function mergeBuffer(current:WalkBuffer,saved:WalkBuffer|null):WalkBuffer {
 if(!saved||saved.walk!==current.walk)return current
 const points=new Map(saved.points.map(p=>[p.seq,p]))
 for(const p of current.points)points.set(p.seq,p)
 return {...current,points:[...points.values()].sort((a,b)=>a.seq-b.seq),ending:current.ending||saved.ending}
}
