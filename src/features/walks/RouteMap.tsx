import { useId } from 'react'
import { distance, segment, type Point } from './gps'
export function RouteMap({points}:{points:Point[]}) {
 const title=useId()
 if(!points.length)return <p className="walk-empty">No GPS route recorded. Time-only walks are still included in summaries.</p>
 // Local equirectangular projection. No coordinates are sent to a map provider.
 const origin=points[0],cos=Math.cos(origin.latitude*Math.PI/180)
 const xy=points.map(p=>{let lng=p.longitude-origin.longitude;lng=((lng+540)%360)-180;return {x:lng*cos,y:-(p.latitude-origin.latitude)}})
 const minX=Math.min(...xy.map(p=>p.x)),maxX=Math.max(...xy.map(p=>p.x)),minY=Math.min(...xy.map(p=>p.y)),maxY=Math.max(...xy.map(p=>p.y))
 const span=Math.max(maxX-minX,maxY-minY,0.0005),scale=260/span
 const projected=xy.map(p=>({x:160+(p.x-(minX+maxX)/2)*scale,y:160+(p.y-(minY+maxY)/2)*scale}))
 const paths:string[]=[]
 projected.forEach((p,i)=>{if(!i||segment(points[i-1],points[i])===0){paths.push(`M ${p.x} ${p.y}`)}else{paths[paths.length-1]+=` L ${p.x} ${p.y}`}})
 const first=projected[0],last=projected.at(-1)!
 const scaleMeters=distance(origin,{latitude:origin.latitude,longitude:origin.longitude+span/(cos||1)})*60/260
 return <figure className="walk-map"><svg viewBox="0 0 320 320" role="img" aria-labelledby={title}><title id={title}>Recorded walking route. Green is the start, orange is the finish. Gaps are not connected.</title><rect width="320" height="320" rx="20" fill="#edf1e6"/>{[40,80,120,160,200,240,280].map(n=><g key={n} stroke="#dce4d3" strokeWidth="1"><path d={`M ${n} 0 V 320 M 0 ${n} H 320`}/></g>)}{paths.map((d,i)=><path key={i} d={d} stroke="#526d48" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round"/>)}<circle cx={first.x} cy={first.y} r="6" fill="#526d48" stroke="white" strokeWidth="2"/><circle cx={last.x} cy={last.y} r="5" fill="#b46e43" stroke="white" strokeWidth="2"/><text x="286" y="27" fill="#526d48" fontSize="13">N ↑</text><path d="M 20 286 V 292 H 80 V 286" fill="none" stroke="#526d48"/><text x="20" y="279" fill="#526d48" fontSize="10">≈ {Math.round(scaleMeters)} m</text></svg><figcaption>Route map · green start, orange finish · north up. Street tiles await the team’s map-provider choice. GPS gaps are left open.</figcaption></figure>
}
