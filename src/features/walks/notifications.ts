// Maria can register the shared notification implementation here without changing GPS logic.
export type WalkNotificationAdapter = { show: (id:string,onOpen:()=>void)=>void; cancel:(id:string)=>void }
let registered:WalkNotificationAdapter|null=null
export function registerWalkNotifications(adapter:WalkNotificationAdapter) { registered=adapter;return()=>{if(registered===adapter)registered=null} }
const open=new Map<string,Notification>()
export const walkNotifications:WalkNotificationAdapter={
 show(id,onOpen){
  if(registered){registered.show(id,onOpen);return}
  if(typeof Notification==='undefined'||Notification.permission!=='granted')return
  try {
   const notification=new Notification('Still walking?',{body:'Open PawShare and choose Keep walking. This walk will end in two minutes if GPS remains available.',tag:`walk-${id}`})
   notification.onclick=()=>{window.focus();onOpen();notification.close()};open.set(id,notification)
  }catch{/* Many mobile browsers require a shared service-worker notification adapter. In-app warning remains visible. */}
 },
 cancel(id){registered?.cancel(id);open.get(id)?.close();open.delete(id)},
}
