const key='pawshare.pending-walk-start'
export function rememberWalkStart(){try{sessionStorage.setItem(key,String(Date.now()))}catch{/* Reopen the NFC link after sign-in if storage is disabled. */}}
export function pendingWalkStart(now=Date.now()){try{const value=Number(sessionStorage.getItem(key));return value>0&&now>=value&&now-value<30*60_000}catch{return false}}
export function clearWalkStart(){try{sessionStorage.removeItem(key)}catch{/* Confirmation is still explicit. */}}
