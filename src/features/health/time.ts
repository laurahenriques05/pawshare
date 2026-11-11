export function localTime(instant: string, zone: string) {
 const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(instant))
 const get = (key: string) => parts.find(p => p.type === key)!.value
 return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
// Enumerate possible UTC offsets: reject missing and repeated local times at DST changes.
export function toInstant(local: string, zone: string) {
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Choose a valid date and time.')
 const base = Date.parse(local + 'Z')
 const matches: string[] = []
 for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
  const candidate = new Date(base + offset * 60000).toISOString()
  if (localTime(candidate, zone) === local) matches.push(candidate)
 }
 if (matches.length !== 1) throw new Error('This time is missing or repeated due to daylight saving. Choose another time.')
 return matches[0]
}
