import { describe, expect, it } from 'vitest'
import { dogSchema } from '../lib/validation'
const valid = { name: '  Pippin  ', breed: null, date_of_birth: null, weight_kg: null, sex: 'unknown', neutered: null, activity_level: 'moderate' }
describe('dog onboarding validation', () => {
 it('supports minimal onboarding with optional details omitted', () => expect(dogSchema.parse(valid).name).toBe('Pippin'))
 it('rejects blank names', () => expect(dogSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false))
 it('rejects negative or invalid weights', () => { for (const weight_kg of [-1, 0, 201, NaN]) expect(dogSchema.safeParse({ ...valid, weight_kg }).success).toBe(false) })
 it('rejects future birthdays', () => expect(dogSchema.safeParse({ ...valid, date_of_birth: '2999-01-01' }).success).toBe(false))
 it('rejects impossible dates', () => expect(dogSchema.safeParse({ ...valid, date_of_birth: '2020-02-31' }).success).toBe(false))
 it('rejects unsupported enum values', () => expect(dogSchema.safeParse({ ...valid, activity_level: 'extreme' }).success).toBe(false))
})
