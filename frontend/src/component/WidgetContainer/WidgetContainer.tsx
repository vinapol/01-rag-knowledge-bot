import { useChatbot } from '../../hooks/useChatbot'
import './WidgetContainer.css'
import Inputs from '../Inputs/Inputs'
import MessageView from '../MessageView/MessageView'
import closeIcon from '../../assets/icons/close.svg'

type Props = {
  onClose?: () => void
}

export default function WidgetContainer({ onClose }: Props) {
  const {
    message,
    setMessage,
    files,
    loading,
    messages,
    error,
    handleFileSelect,
    handleRemoveFile,
    handleSend,
  } = useChatbot()

  return (
    <div className="widget-container">
      <div className="widget-container-header">
        <h1>Wilson</h1>
        {onClose ? (
          <button
            type="button"
            className="widget-close"
            onClick={onClose}
            aria-label="Fermer Wilson"
          >
            <img src={closeIcon} alt="" width={18} height={18} />
          </button>
        ) : null}
      </div>
      <MessageView messages={messages} />
      {error && <p className="widget-error">{error}</p>}
      {loading && <p className="widget-loading">Réflexion en cours…</p>}
      <Inputs
        value={message}
        onChange={setMessage}
        onSend={() => {
          handleSend()
        }}
        files={files}
        onRemoveFile={(id) => handleRemoveFile(id)}
        onFileSelect={(file) => {
          if (!file) return
          handleFileSelect(file)
        }}
        disabled={loading}
      />
    </div>
  )
}
