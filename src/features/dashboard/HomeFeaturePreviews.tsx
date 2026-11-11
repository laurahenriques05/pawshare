import { GraduationCap, ListChecks, HeartPulse } from 'lucide-react'

// Replace each preview with its real household summary as the feature ships.
const features = [
 { key: 'academy', title: 'Academy', icon: GraduationCap, description: 'Your next lesson, shared XP, and little wins together.' },
 { key: 'tasks', title: 'Family tasks', icon: ListChecks, description: 'Upcoming care tasks and who’s taking care of what.' },
 { key: 'health', title: 'Health', icon: HeartPulse, description: 'Vet visits, vaccinations, and health reminders in one place.' },
]

export function HomeFeaturePreviews() {
 return <section className="home-feature-previews" aria-labelledby="home-features-title"><div className="home-section-heading"><div><p className="eyebrow">A LITTLE MORE ON THE WAY</p><h2 id="home-features-title">More ways to care</h2></div></div><div className="home-feature-grid">{features.map(({ key, title, icon: Icon, description }) => <article key={key} className={`card home-feature-preview home-feature-${key}`}><div className="home-feature-top"><span className="home-feature-icon"><Icon size={20} aria-hidden="true"/></span><span className="home-feature-soon">Coming soon</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
}
