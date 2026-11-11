export function vaccinationDates(given: string, due: string, today: string) {
 const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value+'T12:00Z').toISOString().slice(0,10)===value
 if(!valid(given)||given>today)throw new Error('Enter a valid vaccination date, today or earlier.')
 if(due&&(!valid(due)||due<=given))throw new Error('The next due date must be after the vaccination date.')
}
export function vaccinationStatus(due:string|null,today:string){return !due?'No next date recorded':due<today?'Overdue':due===today?'Due today':'Upcoming'}
