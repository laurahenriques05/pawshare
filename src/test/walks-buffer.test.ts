import {it,expect} from 'vitest'
import {mergeBuffer,parseBuffer,type WalkBuffer} from '../features/walks/buffer'
const point=(seq:number)=>({seq,recorded_at:new Date(1700000000000+seq*5000).toISOString(),latitude:38,longitude:-9,accuracy:5})
it('recovers only a valid buffer for the intended walk',()=>{
 const buffer:WalkBuffer={walk:'a',points:[point(0)],ending:null}
 expect(parseBuffer(JSON.stringify(buffer),'a')).toEqual(buffer)
 expect(parseBuffer(JSON.stringify(buffer),'b')).toBe(null)
 expect(parseBuffer('{broken','a')).toBe(null)
 expect(parseBuffer(JSON.stringify({...buffer,points:[{...point(0),latitude:91}]}),'a')).toBe(null)
 expect(parseBuffer(JSON.stringify({...buffer,ending:{at:'invalid',reason:'manual'}}),'a')).toBe(null)
})
it('merges another tab’s buffer without dropping in-memory GPS or a pending finish after storage failure',()=>{
 const ending={at:new Date(1700001000000).toISOString(),reason:'manual' as const}
 const current:WalkBuffer={walk:'a',points:[point(1),point(2)],ending}
 const saved:WalkBuffer={walk:'a',points:[point(0),point(1)],ending:null}
 const merged=mergeBuffer(current,saved)
 expect(merged.points.map(p=>p.seq)).toEqual([0,1,2])
 expect(merged.ending).toEqual(ending)
 expect(mergeBuffer(current,{...saved,walk:'b'})).toBe(current)
})
