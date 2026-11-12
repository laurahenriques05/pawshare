import { Play, Square } from 'lucide-react'
import { Button } from '../../components/ui'
export function RouteMapControls({ playing, onReplay, onFit, disabled, status }: {
 playing: boolean; onReplay: () => void; onFit: () => void; disabled: boolean; status: string
}) {
 return <div className="walk-map-tools">
  <div className="walk-map-legend"><span><span className="walk-route-start"/> Start</span><span><span className="walk-route-finish"/> Finish</span><Button className="secondary walk-replay-button" disabled={disabled} onClick={onReplay}>{playing ? <Square size={13}/> : <Play size={14}/>} {playing ? 'Stop replay' : 'Reproduce route'}</Button></div>
  <Button className="secondary" onClick={onFit}>Fit route</Button>
  <span className="sr-only" role="status">{status}</span>
 </div>
}
