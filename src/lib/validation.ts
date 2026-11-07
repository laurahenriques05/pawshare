import { z } from 'zod'
export const dogSchema = z.object({
 name: z.string().trim().min(1, 'Please enter your dog’s name.').max(80),
 breed: z.string().trim().max(100).nullable(),
 date_of_birth: z.string().date().nullable().refine(value => !value || value <= new Date().toISOString().slice(0,10), 'Date of birth must be today or earlier.'),
 weight_kg: z.number().positive().max(200).nullable(),
 sex: z.enum(['male', 'female', 'unknown']),
 neutered: z.boolean().nullable(),
 activity_level: z.enum(['low', 'moderate', 'high'])
})
export function dogFromForm(form: FormData) { return dogSchema.parse({ name: form.get('name'), breed: String(form.get('breed') || '').trim() || null, date_of_birth: form.get('date_of_birth') || null, weight_kg: form.get('weight_kg') ? Number(form.get('weight_kg')) : null, sex: form.get('sex'), neutered: form.get('neutered') === 'unknown' ? null : form.get('neutered') === 'yes', activity_level: form.get('activity_level') }) }
