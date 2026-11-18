import type { ChatMessage } from '../../../types'
import documentIcon from '../../../assets/icons/document.svg'
import './MessageCard.css'

type Props = { message: ChatMessage }

export default function MessageCard({ message }: Props) {
  return (
    <div className={`message-card message-card--${message.role}`}>
      {message.attachments?.length ? (
        <div className="message-card-attachments">
          {message.attachments.map((file) => (
            <div key={file.id} className="message-card-attachment">
              <img src={documentIcon} alt="" width={16} height={16} />
              <span>{file.filename}</span>
            </div>
          ))}
        </div>
      ) : null}
      {message.content ? <p>{message.content}</p> : null}
      {message.role === 'assistant' && message.citations?.length ? (
        <ul>
          {message.citations.map((c) => (
            <li key={c.id}>
              [{c.id}] {c.source}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
