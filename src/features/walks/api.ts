import { db } from '../../lib/supabase/client'
import type { WalkPoint } from '../../lib/supabase/database.types'
export async function getPoints(id:string) {
 const points:WalkPoint[]=[]
 for(let offset=0;;offset+=1000) {
  const result=await db().from('walk_points').select('*').eq('walk_id',id).order('seq').range(offset,offset+999)
  if(result.error) throw result.error
  points.push(...result.data)
  if(result.data.length<1000) return points
 }
}
export async function getWalks(household:string) {
 const walks=[]
 for(let offset=0;;offset+=1000) {
  const result=await db().from('walks').select('*').eq('household_id',household).order('started_at',{ascending:false}).order('id').range(offset,offset+999)
  if(result.error) throw result.error
  walks.push(...result.data)
  if(result.data.length<1000) return walks
 }
}
