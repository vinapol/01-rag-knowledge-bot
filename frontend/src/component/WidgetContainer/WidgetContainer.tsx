import { useState } from 'react'
import { useChatbot } from '../../hooks/useChatbot'
import './WidgetContainer.css'
import Inputs from '../Inputs/Inputs'
import MessageView from '../MessageView/MessageView'
import ConversationList from '../ConversationList/ConversationList'
import closeIcon from '../../assets/icons/close.svg'
import chevronLeft from '../../assets/icons/chevron-left.svg'

type Props = {
  onClose?: () => void
}

type WidgetView = 'chat' | 'conversations'

export default function WidgetContainer({ onClose }: Props) {
  const [view, setView] = useState<WidgetView>('chat')
  const {
    message,
    setMessage,
    files,
    loading,
    messages,
    error,
    conversations,
    activeConversationId,
    handleFileSelect,
    handleRemoveFile,
    handleSend,
    handleSelectConversation,
    handleNewConversation,
    handleDeleteConversation,
  } = useChatbot()

  const activeTitle =
    conversations.find((c) => c.id === activeConversationId)?.title ?? 'Wilson'

  const openConversation = async (id: string) => {
    await handleSelectConversation(id)
    setView('chat')
  }

  const createConversation = async () => {
    await handleNewConversation()
    setView('chat')
  }

  return (
    <div className="widget-container">
      <div className="widget-container-header">
        {view === 'conversations' ? (
          <button
            type="button"
            className="widget-header-btn widget-back"
            onClick={() => setView('chat')}
            aria-label="Retour au chat"
          >
            <img src={chevronLeft} alt="" width={18} height={18} />
          </button>
        ) : (
          <button
            type="button"
            className="widget-header-btn widget-history"
            onClick={() => setView('conversations')}
            aria-label="Voir les conversations"
          >
            ☰
          </button>
        )}

        <h1>{view === 'conversations' ? 'Conversations' : activeTitle}</h1>

        {onClose ? (
          <button
            type="button"
            className="widget-header-btn widget-close"
            onClick={onClose}
            aria-label="Fermer Wilson"
          >
            <img src={closeIcon} alt="" width={18} height={18} />
          </button>
        ) : (
          <span className="widget-header-spacer" />
        )}
      </div>

      {view === 'conversations' ? (
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          disabled={loading}
          onSelect={openConversation}
          onCreate={createConversation}
          onDelete={handleDeleteConversation}
        />
      ) : (
        <div className="widget-main">
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
            disabled={loading || !activeConversationId}
          />
        </div>
      )}
    </div>
  )
}
