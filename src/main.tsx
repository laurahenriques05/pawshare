import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Router } from './app/router'
import './styles/index.css'
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
 state = { failed: false }
 static getDerivedStateFromError() { return { failed: true } }
 render() { return this.state.failed ? <main className="setup"><h1>We couldn’t open PawShare.</h1><p>Please refresh and try again.</p><button className="button" onClick={() => window.location.reload()}>Reload</button></main> : this.props.children }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><Router/></ErrorBoundary></StrictMode>)
