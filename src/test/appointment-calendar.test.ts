import { expect, it } from 'vitest'
import { monthDays, shiftMonth } from '../features/health/AppointmentCalendar'
it('lays out leap years and Monday-first month boundaries',()=>{
 expect(monthDays('2024-02')).toEqual({count:29,padding:3})
 expect(monthDays('2026-02')).toEqual({count:28,padding:6})
 expect(monthDays('2026-06')).toEqual({count:30,padding:0})
})
it('navigates across years in both directions',()=>{
 expect(shiftMonth('2026-12',1)).toBe('2027-01')
 expect(shiftMonth('2026-01',-1)).toBe('2025-12')
})
