import { expect,it } from 'vitest'
import { errorMessage,isSchemaUnavailable } from '../components/ui'

it('turns missing Supabase schema errors into actionable setup guidance',()=>{
 const missingRpc={code:'PGRST202',message:'Could not find the function public.generate_task_occurrences in the schema cache'}
 expect(isSchemaUnavailable(missingRpc)).toBe(true)
 expect(errorMessage(missingRpc)).toContain('migration may not be applied')
 expect(errorMessage(missingRpc)).toContain('do not reset or rerun existing migrations')
 expect(isSchemaUnavailable({code:'PGRST205',message:'Could not find table'})).toBe(true)
 expect(isSchemaUnavailable({code:'42501',message:'permission denied'})).toBe(false)
 expect(errorMessage({message:'The connection timed out'})).toBe('The connection timed out')
})
