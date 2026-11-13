import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { WeightMeasurement } from '../../lib/supabase/database.types'
import { localTime } from './time'
export type WeightPeriod='Day'|'Week'|'Month'|'6 Months'|'Year'
export function weightWindow(anchor:string,period:WeightPeriod){
 const date=new Date(anchor+'T12:00:00Z');const start=new Date(date);let end:Date
 if(period==='Day'){end=new Date(start);end.setUTCDate(end.getUTCDate()+1)}
 else if(period==='Week'){start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);end=new Date(start);end.setUTCDate(end.getUTCDate()+7)}
 else{start.setUTCDate(1);if(period==='Year')start.setUTCMonth(0);if(period==='6 Months')start.setUTCMonth(Math.floor(start.getUTCMonth()/6)*6);end=new Date(start);end.setUTCMonth(end.getUTCMonth()+(period==='Year'?12:period==='6 Months'?6:1))}
 return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)}
}
export function WeightTrend({measurements,zone}:{measurements:WeightMeasurement[];zone:string}){
 const today=localTime(new Date().toISOString(),zone).slice(0,10)
 const [period,setPeriod]=useState<WeightPeriod>('Month'),[anchor,setAnchor]=useState(today),[selected,setSelected]=useState<string|null>(null)
 const {start,end}=weightWindow(anchor,period)
 const rows=measurements.filter(row=>{const day=localTime(row.measured_at,zone).slice(0,10);return day>=start&&day<end}).sort((a,b)=>a.measured_at.localeCompare(b.measured_at))
 const active=rows.find(row=>row.id===selected)
 const average=rows.length?rows.reduce((sum,row)=>sum+Number(row.weight_kg),0)/rows.length:null
 const numbers=rows.map(row=>Number(row.weight_kg));const low=rows.length?Math.min(...numbers):0,high=rows.length?Math.max(...numbers):1
 const padding=Math.max((high-low)*.25,.5);const min=Math.max(0,Math.floor((low-padding)*2)/2),max=Math.ceil((high+padding)*2)/2
 const from=Date.parse(start+'T00:00Z'),until=Date.parse(end+'T00:00Z')
 // Household wall-clock coordinates keep calendar-day boundaries independent of device timezone.
 const x=(row:WeightMeasurement)=>24+(Date.parse(localTime(row.measured_at,zone)+'Z')-from)/(until-from)*516
 const y=(row:WeightMeasurement)=>205-(Number(row.weight_kg)-min)/(max-min)*180
 const dateLabel=(date:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00Z'))
 const last=new Date(end+'T12:00Z');last.setUTCDate(last.getUTCDate()-1)
 function move(direction:number){const d=new Date(start+'T12:00Z');if(period==='Day'||period==='Week')d.setUTCDate(d.getUTCDate()+direction*(period==='Day'?1:7));else d.setUTCMonth(d.getUTCMonth()+direction*(period==='Month'?1:period==='6 Months'?6:12));setAnchor(d.toISOString().slice(0,10));setSelected(null)}
 return <section className="card weight-trend" aria-label="Weight trend"><h2>Weight trend</h2><div className="weight-periods" role="group" aria-label="Chart period">{(['Day','Week','Month','6 Months','Year'] as WeightPeriod[]).map(value=><button type="button" key={value} aria-pressed={value===period} onClick={()=>{setPeriod(value);setSelected(null)}}>{value}</button>)}</div>
 <div className="weight-chart-summary" aria-live="polite"><p className="eyebrow">{active?'MEASUREMENT':'AVERAGE'}</p><p className="weight-chart-value">{active?Number(active.weight_kg).toFixed(2):average!==null?average.toFixed(2):'—'} <span>kg</span></p><p className="muted">{active?localTime(active.measured_at,zone).replace('T',' · '):`${dateLabel(start)} – ${dateLabel(last.toISOString().slice(0,10))}`}</p></div>
 <div className="weight-range"><button type="button" aria-label="Previous period" onClick={()=>move(-1)}><ChevronLeft size={20}/></button><button type="button" onClick={()=>{setAnchor(today);setSelected(null)}}>Today</button><button type="button" aria-label="Next period" onClick={()=>move(1)}><ChevronRight size={20}/></button></div>
 {rows.length===0?<p className="weight-chart-empty">No measurements in this period. Choose another period or add a record.</p>:<><svg className="weight-chart" viewBox="0 0 600 250" aria-label={`Weight in kilograms, ${rows.length} measurements. Select a point for details.`}>
 {Array.from({length:5},(_,i)=>{const yy=25+i*45;return <g key={i}><line x1="24" x2="540" y1={yy} y2={yy} className="weight-grid"/><text x="552" y={yy+4}>{(max-i*(max-min)/4).toFixed(1)}</text></g>})}
 {Array.from({length:5},(_,i)=>{const xx=24+i*129;const stamp=from+(until-from-1)*i/4;return <g key={i}><line x1={xx} x2={xx} y1="25" y2="205" className="weight-grid weight-grid-vertical"/><text x={xx} y="235" textAnchor={i===0?'start':i===4?'end':'middle'}>{new Intl.DateTimeFormat('en-GB',period==='Day'?{hour:'2-digit',hourCycle:'h23',timeZone:'UTC'}:{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(stamp))}</text></g>})}
 <polyline className="weight-line" points={rows.map(row=>`${x(row)},${y(row)}`).join(' ')}/>
 {active&&<line x1={x(active)} x2={x(active)} y1="25" y2="205" className="weight-selection"/>}
 {rows.map(row=><g key={row.id} role="button" tabIndex={0} aria-label={`${localTime(row.measured_at,zone).replace('T',' ')}, ${row.weight_kg} kilograms`} aria-pressed={selected===row.id} onClick={()=>setSelected(row.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(row.id)}}}><title>{row.weight_kg} kg · {localTime(row.measured_at,zone)}</title><circle cx={x(row)} cy={y(row)} r="14" fill="transparent"/><circle cx={x(row)} cy={y(row)} r={selected===row.id?5:3.5} className="weight-point"/></g>)}
 </svg><p className="weight-chart-caption">{rows.length} measurement{rows.length===1?'':'s'} · Tap a point to see details · {zone}</p></>}
 </section>
}
