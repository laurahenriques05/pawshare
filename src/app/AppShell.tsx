import { NavLink, Outlet } from 'react-router-dom'
import { Home, Utensils, Footprints, GraduationCap, Ellipsis, LogOut, HeartPulse } from 'lucide-react'
import { Brand, Button, Notice } from '../components/ui'
import { db } from '../lib/supabase/client'
import { useHousehold } from '../features/household/HouseholdProvider'
import { useState } from 'react'
export function AppShell() {
 const { household, households, select } = useHousehold(); const [error, setError] = useState('')
 async function signOut() { const { error } = await db().auth.signOut(); if (error) setError(error.message) }
 return (
  <div className="app-layout">
    <aside className="sidebar">
      <Brand/>
      <p className="nav-label">YOUR EVERYDAY</p>
      <nav aria-label="Main navigation">
        <NavLink to="/" end><Home size={20}/>Home</NavLink>
        <NavLink to="/feed"><Utensils size={20}/>Feed</NavLink>
        <NavLink to="/walks"><Footprints size={20}/>Walks</NavLink>
        <span aria-disabled="true"><GraduationCap size={20}/>Academy<small>Soon</small></span>
        <span aria-disabled="true"><HeartPulse size={20}/>Health<small>Soon</small></span>
        <NavLink to="/more"><Ellipsis size={20}/>More</NavLink>
      </nav>
      <div className="sidebar-bottom">
        <div className="private-note">A little care.<br/><strong>A happier everyday.</strong></div>
        <Button className="secondary" onClick={signOut}><LogOut size={16}/>Sign out</Button>
      </div>
    </aside>
    <div className="app-content">
      <header className="topbar">
        <div className="mobile-brand"><Brand/></div>
        <span className="desktop-label">One dog. One family. All connected.</span>
        <div className="household-label"><span className="status-dot"/>{households.length > 1 ? <select aria-label="Active household" value={household?.id} onChange={event => select(event.target.value)}>{households.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select> : household?.name}<span className="avatar">{household?.name.charAt(0).toUpperCase()}</span></div>
      </header>
      <main id="main-content" className="main-content">{error && <Notice error>{error}</Notice>}<Outlet/></main>
    </div>
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <NavLink to="/" end><Home/><span>Home</span></NavLink>
      <NavLink to="/feed"><Utensils/><span>Feed</span></NavLink>
      <NavLink to="/walks"><Footprints/><span>Walks</span></NavLink>
      <span aria-disabled="true"><GraduationCap/><span>Academy</span></span>
      <NavLink to="/more"><Ellipsis/><span>More</span></NavLink>
    </nav>
  </div>
)
}
