import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, Link, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { HouseholdProvider, useHousehold } from '../features/household/HouseholdProvider'
import { AuthPage } from '../features/auth/AuthPage'
import { OnboardingPage } from '../features/onboarding/OnboardingPage'
import { DashboardPage, DogProfilePage, MorePage } from '../features/dashboard/DashboardPage'
import { configurationError } from '../lib/supabase/client'
import { Brand, Button, Loading, Notice } from '../components/ui'
import { AppShell } from './AppShell'
import { WalksPage } from '../features/walks/WalksPage'
import { WalkDetailPage } from '../features/walks/WalkDetailPage'
import { GpsDiagnosticPage } from '../features/walks/GpsDiagnosticPage'
import { WalkProvider } from '../features/walks/WalkProvider'
import { WalkingLesson } from '../features/walks/WalkingLesson'
import { pendingWalkStart, rememberWalkStart } from '../features/walks/nfc'
import { FamilyPage } from '../features/household/FamilyPage'
import { FeedingPage } from '../features/feeding/FeedingPage'
import { InvitationPage } from '../features/household/InvitationPage'
import { invitationDestination, pendingInvitation } from '../features/household/invitations'
function PrivateRoutes() {
 const auth = useAuth(); const data = useHousehold(); const location = useLocation()
 useEffect(() => { if (location.pathname === '/walks' && new URLSearchParams(location.search).get('action') === 'start') rememberWalkStart() }, [location.pathname, location.search])
 if (auth.loading) return <Loading/>
 if (auth.error) return <div className="setup"><Notice error>{auth.error}</Notice><Button onClick={() => window.location.reload()}>Retry</Button></div>
 if (!auth.session) return <Navigate to="/sign-in" replace/>
 if (data.loading) return <Loading/>
 if (data.error) return <div className="setup"><Notice error>{data.error}</Notice><Button onClick={data.reload}>Try again</Button></div>
 const pending = pendingInvitation(location.search)
 if (pending) return <Navigate to={`/invite/${pending}`} replace/>
 const onboard = location.pathname.startsWith('/onboarding')
 if (!data.household || !data.dog) return onboard ? <Outlet/> : <Navigate to={data.household ? '/onboarding/dog' : '/onboarding/household'} replace/>
 if (pendingWalkStart() && (location.pathname === '/' || onboard)) return <Navigate to="/walks?action=start" replace/>
 return onboard ? <Navigate to="/" replace/> : <Outlet/>
}
function Callback() { const { session, loading } = useAuth(); if (loading) return <Loading/>; const params = new URLSearchParams(window.location.hash.slice(1)); const error = params.get('error_description') || new URLSearchParams(window.location.search).get('error_description'); return session ? <Navigate to={invitationDestination(window.location.search)} replace/> : <div className="setup"><Brand/><Notice error={!!error}>{error || 'Your email link has been processed. Sign in to continue. If the link expired, request a new one from the sign-in page.'}</Notice><Link to="/sign-in">Continue to sign in</Link></div> }
function AccountData({ children }: { children: React.ReactNode }) { const { session } = useAuth(); return <HouseholdProvider key={session?.user.id || 'signed-out'}>{children}</HouseholdProvider> }
function PublicAuth() { const { loading } = useAuth(); const { pathname } = useLocation(); return loading ? <Loading/> : <AuthPage key={pathname}/> }
export function Router() {
 if (configurationError) return <div className="setup"><Brand/><h1>Your pack starts here.</h1><Notice>{configurationError}</Notice><p>See README.md for the migration and authentication configuration steps. No demo data or simulated authentication is enabled.</p></div>
 return (
  <BrowserRouter>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <AuthProvider>
      <AccountData>
        <Routes>
          <Route path="/sign-up" element={<PublicAuth/>}/>
          <Route path="/sign-in" element={<PublicAuth/>}/>
          <Route path="/forgot-password" element={<PublicAuth/>}/>
          <Route path="/reset-password" element={<PublicAuth/>}/>
          <Route path="/auth/callback" element={<Callback/>}/>
          <Route path="/invite/:token" element={<InvitationPage/>}/>
          <Route element={<PrivateRoutes/>}>
            <Route path="/onboarding/household" element={<OnboardingPage/>}/>
            <Route path="/onboarding/dog" element={<OnboardingPage/>}/>
            <Route element={<WalkProvider><AppShell/></WalkProvider>}>
              <Route index element={<DashboardPage/>}/>
              <Route path="/feed" element={<FeedingPage/>}/>
              <Route path="/walks" element={<WalksPage/>}/>
              <Route path="/walks/:walkId" element={<WalkDetailPage/>}/>
              <Route path="/walks/gps-test" element={<GpsDiagnosticPage/>}/>
              <Route path="/walks/learn" element={<WalkingLesson/>}/>
              <Route path="/more" element={<MorePage/>}/>
              <Route path="/more/dog" element={<DogProfilePage/>}/>
              <Route path="/more/family" element={<FamilyPage/>}/>
            </Route>
          </Route>
          <Route path="*" element={<div className="setup"><h1>This trail ends here.</h1><Link to="/">Back home</Link></div>}/>
        </Routes>
      </AccountData>
    </AuthProvider>
  </BrowserRouter>
)
}
