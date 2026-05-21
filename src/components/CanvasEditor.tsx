import { Tldraw } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'

export function CanvasEditor({ pageId }: { pageId: string }) {
  return (
    <div className="w-full h-full">
      <Tldraw />
    </div>
  )
}
