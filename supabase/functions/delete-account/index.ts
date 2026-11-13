import { handleDeletion } from '../_shared/deletion.ts'
Deno.serve(req=>handleDeletion(req,'account'))
