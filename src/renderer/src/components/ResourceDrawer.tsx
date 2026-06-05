import { DetailPanel } from './DetailPanel'

/** The right-side slide-over that hosts a resource's full detail. */
export function ResourceDrawer({
  serviceId,
  id,
  onClose
}: {
  serviceId: string
  id: string
  onClose: () => void
}): JSX.Element {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] animate-fade-in" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-screen w-full max-w-3xl border-l border-border bg-bg shadow-elevated animate-fade-in">
        <DetailPanel serviceId={serviceId} id={id} onClose={onClose} />
      </div>
    </>
  )
}
