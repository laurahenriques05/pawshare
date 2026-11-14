export type AcademySection = { heading:string; text:string }
export type AcademyModule = {
 id:string; courseId:string; courseTitle:string; position:number; title:string; estimatedMinutes:number
 objective:string; sections:AcademySection[]; checklist:string[]; question:string; answer:string; feedback:string
}

// Reward and unlock settings stay here so Maria can tune the demonstration rules.
export const ACADEMY_RULES = { xpPerModule:10, xpPerLevel:50, badgeModuleCounts:[1,5,20] }

export const academyModules: AcademyModule[] = [
 {
  id:'daily-care-check-in', courseId:'everyday-care', courseTitle:'Everyday care', position:1,
  title:'A kind daily check-in', estimatedMinutes:3,
  objective:'Notice what your dog needs today and share one small care routine.',
  sections:[
   {heading:'Notice your dog first',text:'Take a moment to notice your dog’s usual energy, comfort and interest in their surroundings. Small changes are useful context to share with your household.'},
   {heading:'Choose one steady routine',text:'Pick one simple care moment your family can make predictable, such as preparing for a walk or settling down after play. Keep it calm and suited to your dog.'},
   {heading:'Keep notes useful',text:'Record what you observed in plain language. If you have a health concern or a sudden change, contact your veterinarian; this lesson is not medical advice.'},
  ],
  checklist:['Notice one thing your dog enjoys today','Choose one small routine to share','Write down a question for your vet or trainer if you have one'],
  question:'If your dog has a sudden health or appetite change, should this lesson replace veterinary advice?',
  answer:'No. Contact your veterinarian about health concerns.',
  feedback:'Everyday-care lessons can help with routines, but a veterinarian is the right person for health concerns.',
 },
 {
  id:'walking-basics', courseId:'everyday-care', courseTitle:'Everyday care', position:2,
  title:'A happier walk, together', estimatedMinutes:2,
  objective:'Prepare a comfortable walk and recognize that GPS statistics are estimates.',
  sections:[
   {heading:'Before you step outside',text:'Check the lead and harness fit securely, bring poo bags and water, and choose a route suitable for the weather. In hot weather, pick cooler hours and avoid hot surfaces.'},
   {heading:'Let your dog explore',text:'Allow safe sniffing breaks. Keep a comfortable distance from things your dog finds overwhelming, and reward calm attention. Follow local lead rules and ask before approaching another dog.'},
   {heading:'Know when to head home',text:'Slow down or stop if your dog appears uncomfortable or tired. GPS distance is an estimate and is not a care target. Ask your vet about suitable exercise if you are unsure.'},
  ],
  checklist:['Check the lead and harness','Choose a comfortable route','Find one quiet place for a sniffing break'],
  question:'Does missing GPS mean your dog has stopped moving?',
  answer:'No. A locked screen, poor signal or an interrupted browser can stop positions arriving.',
  feedback:'Check your dog and the walk yourself. Missing positions cannot prove that your dog is stationary.',
 },
]

export function isModuleUnlocked(module:AcademyModule, completedIds:ReadonlySet<string>) {
 const previous=academyModules.find(item=>item.courseId===module.courseId&&item.position===module.position-1)
 return !previous||completedIds.has(previous.id)
}
