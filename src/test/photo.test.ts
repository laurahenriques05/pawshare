import { describe, expect, it } from 'vitest'
import { photoPath, validatePhoto, MAX_PHOTO_BYTES } from '../features/dog-profile/photo'
describe('dog photo uploads', () => {
 it('uses a household- and dog-specific path', () => expect(photoPath('household','dog')).toBe('household/dog.jpg'))
 it('accepts supported photos', () => { for (const type of ['image/jpeg','image/png','image/webp']) expect(() => validatePhoto({type,size:1024})).not.toThrow() })
 it('rejects oversized and empty files', () => { for (const size of [0, MAX_PHOTO_BYTES+1]) expect(() => validatePhoto({type:'image/jpeg',size})).toThrow() })
 it('rejects SVG, documents, and unsupported formats', () => { for (const type of ['image/svg+xml','application/pdf','image/heic']) expect(() => validatePhoto({type,size:1024})).toThrow() })
})
