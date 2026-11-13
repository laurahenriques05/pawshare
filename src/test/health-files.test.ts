import { expect,it } from 'vitest'
import { validateHealthFile } from '../features/health/DocumentsPage'
it('checks file size and matching magic bytes before private upload',async()=>{
 await expect(validateHealthFile(new File(['%PDF-1.7 content'],'a.pdf',{type:'application/pdf'}))).resolves.toBeUndefined()
 await expect(validateHealthFile(new File(['not pdf'],'a.pdf',{type:'application/pdf'}))).rejects.toThrow('contents')
 await expect(validateHealthFile(new File(['<script>'],'a.html',{type:'text/html'}))).rejects.toThrow()
 await expect(validateHealthFile(new File([],'a.pdf',{type:'application/pdf'}))).rejects.toThrow('non-empty')
 await expect(validateHealthFile(new File([new Uint8Array(10485761)],'a.pdf',{type:'application/pdf'}))).rejects.toThrow('10 MB')
})
