import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { PawPrint } from 'lucide-react'
export function Brand() { return <span className="brand"><span className="brand-mark"><PawPrint size={22}/></span>PawShare<span className="brand-dot">.</span></span> }
export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`button ${className}`} {...props}/> }
export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) { const id = useId(); return <div className="field"><label htmlFor={id}>{label}</label><input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props}/>{hint && <small id={`${id}-hint`}>{hint}</small>}</div> }
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) { return <div className={`notice ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> }
export function Loading() { return <main className="loading" role="status"><PawPrint className="animate-pulse"/><p>Getting everything ready…</p></main> }
export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <header className="page-title"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <p className="muted">{children}</p>}</header> }
export function errorMessage(error: unknown) { return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Something went wrong. Please try again.' }
