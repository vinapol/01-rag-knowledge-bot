import './WidgetLauncher.css'

type Props = {
  onOpen: () => void
}

export default function WidgetLauncher({ onOpen }: Props) {
  return (
    <button
      type="button"
      className="widget-launcher"
      onClick={onOpen}
      aria-label="Ouvrir Wilson"
    >
      <span className="widget-launcher-dot" aria-hidden />
      Wilson
    </button>
  )
}
