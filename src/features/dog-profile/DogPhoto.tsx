import { useEffect, useId, useState, type ChangeEvent } from 'react'
import { Camera, PawPrint } from 'lucide-react'
import { db } from '../../lib/supabase/client'
import { Notice, errorMessage } from '../../components/ui'
import { DOG_PHOTO_BUCKET, photoPath, preparePhoto } from './photo'

function useDogPhoto(householdId: string, dogId: string, version = 0) {
 const [url, setUrl] = useState<string | null>(null)
 useEffect(() => {
  let active = true
  setUrl(null)
  async function load() {
   try {
    const { data } = await db().storage.from(DOG_PHOTO_BUCKET).createSignedUrl(photoPath(householdId, dogId), 300)
    if (active) setUrl(data?.signedUrl || null)
   } catch { if (active) setUrl(null) }
  }
  void load()
  const timer = window.setInterval(() => void load(), 240000)
  return () => { active = false; window.clearInterval(timer) }
 }, [householdId, dogId, version])
 return url
}

export function DogPhoto({ householdId, dogId, name, version = 0 }: { householdId: string; dogId: string; name: string; version?: number }) {
 const url = useDogPhoto(householdId, dogId, version)
 const [failed, setFailed] = useState<string | null>(null)
 return <div className="dog-photo">{url && failed !== url ? <img src={url} alt={`${name}’s photo`} width={112} height={112} onError={() => setFailed(url)}/> : <PawPrint aria-label="No dog photo yet" size={34}/>}</div>
}

export function DogPhotoUpload({ householdId, dogId, name, onUploadingChange }: { householdId: string; dogId: string; name: string; onUploadingChange: (busy: boolean) => void }) {
 const id = useId()
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [success, setSuccess] = useState(false)
 const [version, setVersion] = useState(0)
 async function upload(event: ChangeEvent<HTMLInputElement>) {
  const file = event.currentTarget.files?.[0]
  event.currentTarget.value = ''
  if (!file) return
  setBusy(true); onUploadingChange(true); setError(''); setSuccess(false)
  try {
   const photo = await preparePhoto(file)
   const { error } = await db().storage.from(DOG_PHOTO_BUCKET).upload(photoPath(householdId, dogId), photo, { contentType: 'image/jpeg', upsert: true, cacheControl: '0' })
   if (error) throw error
   setVersion(value => value + 1); setSuccess(true)
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false); onUploadingChange(false) }
 }
 return <section className="photo-upload" aria-labelledby={`${id}-heading`} aria-busy={busy}>
  <div className="photo-upload-row"><DogPhoto householdId={householdId} dogId={dogId} name={name} version={version}/><div><h3 id={`${id}-heading`}>A face to love</h3><p className="muted">Add your dog’s photo to their profile and Home card.</p><label className={`button secondary photo-picker ${busy ? 'is-busy' : ''}`}><Camera size={17} aria-hidden="true"/>{busy ? 'Uploading…' : 'Upload or change photo'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload or change dog photo" aria-describedby={`${id}-hint`} disabled={busy} onChange={upload}/></label><p id={`${id}-hint`} className="photo-hint">JPG, PNG or WebP · up to 10 MB. Photos save immediately and stay private to your household.</p></div></div>
  {error && <Notice error>{error}</Notice>}{success && <Notice>Photo saved. You’ll see it on Home, too.</Notice>}
 </section>
}
