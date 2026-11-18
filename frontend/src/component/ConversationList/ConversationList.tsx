import type { ConversationSummary } from '../../api/conversations'
import './ConversationList.css'

type Props = {
  conversations: ConversationSummary[]
  activeId: string | null
  disabled?: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function ConversationList({
  conversations,
  activeId,
  disabled,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  return (
    <div className="conversation-list">
      <button
        type="button"
        className="conversation-list-new"
        onClick={onCreate}
        disabled={disabled}
      >
        + Nouvelle conversation
      </button>

      {conversations.length === 0 ? (
        <p className="conversation-list-empty">Aucune conversation</p>
      ) : (
        <ul className="conversation-list-items">
          {conversations.map((c) => (
            <li key={c.id} className={c.id === activeId ? 'is-active' : undefined}>
              <button
                type="button"
                className="conversation-list-item"
                onClick={() => onSelect(c.id)}
                disabled={disabled}
              >
                <span className="conversation-list-title">{c.title}</span>
                <span className="conversation-list-meta">{formatDate(c.updated_at)}</span>
              </button>
              <button
                type="button"
                className="conversation-list-delete"
                aria-label={`Supprimer ${c.title}`}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(c.id)
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
