import { BrowserRouter, Navigate, Route, Routes, Link, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { HouseholdProvider, useHousehold } from '../features/household/HouseholdProvider'
import { AuthPage } from '../features/auth/AuthPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { DashboardPage, DogProfilePage, MorePage } from '../features/dashboard/DashboardPage'
import { configurationError } from '../lib/supabase/client'
import { Brand, Button, Loading, Notice } from '../components/ui'
import { AppShell } from './AppShell'
function PrivateRoutes() {
 const auth = useAuth(); const data = useHousehold(); const location = useLocation()
 if (auth.loading) return <Loading/>
 if (auth.error) return <div className="setup"><Notice error>{auth.error}</Notice><Button onClick={() => window.location.reload()}>Retry</Button></div>
 if (!auth.session) return <Navigate to="/sign-in" replace/>
 if (data.loading) return <Loading/>
 if (data.error) return <div className="setup"><Notice error>{data.error}</Notice><Button onClick={data.reload}>Try again</Button></div>
 const onboard = location.pathname.startsWith('/onboarding')
 if (!data.household || !data.dog) return onboard ? <Outlet/> : <Navigate to={data.household ? '/onboarding/dog' : '/onboarding/household'} replace/>
 return onboard ? <Navigate to="/" replace/> : <Outlet/>
}
function Callback() { const { session, loading } = useAuth(); if (loading) return <Loading/>; const params = new URLSearchParams(window.location.hash.slice(1)); const error = params.get('error_description') || new URLSearchParams(window.location.search).get('error_description'); return session ? <Navigate to="/" replace/> : <div className="setup"><Brand/><Notice error={!!error}>{error || 'Your email link has been processed. Sign in to continue. If the link expired, request a new one from the sign-in page.'}</Notice><Link to="/sign-in">Continue to sign in</Link></div> }
function AccountData({ children }: { children: React.ReactNode }) { const { session } = useAuth(); return <HouseholdProvider key={session?.user.id || 'signed-out'}>{children}</HouseholdProvider> }
function PublicAuth() { const { loading } = useAuth(); const { pathname } = useLocation(); return loading ? <Loading/> : <AuthPage key={pathname}/> }
export function Router() {
 if (configurationError) return <div className="setup"><Brand/><h1>Your pack starts here.</h1><Notice>{configurationError}</Notice><p>See README.md for the migration and authentication configuration steps. No demo data or simulated authentication is enabled.</p></div>
 return <BrowserRouter><a className="skip-link" href="#main-content">Skip to content</a><AuthProvider><AccountData><Routes><Route path="/sign-up" element={<PublicAuth/>}/><Route path="/sign-in" element={<PublicAuth/>}/><Route path="/forgot-password" element={<PublicAuth/>}/><Route path="/reset-password" element={<PublicAuth/>}/><Route path="/auth/callback" element={<Callback/>}/><Route element={<PrivateRoutes/>}><Route path="/onboarding/household" element={<OnboardingPage/>}/><Route path="/onboarding/dog" element={<OnboardingPage/>}/><Route element={<AppShell/>}><Route index element={<DashboardPage/>}/><Route path="/more" element={<MorePage/>}/><Route path="/more/dog" element={<DogProfilePage/>}/></Route></Route><Route path="*" element={<div className="setup"><h1>This trail ends here.</h1><Link to="/">Back home</Link></div>}/></Routes></AccountData></AuthProvider></BrowserRouter>
}
