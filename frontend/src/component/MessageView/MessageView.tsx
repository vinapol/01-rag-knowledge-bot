import type { ChatMessage } from '../../types'
import MessageCard from './MessageCard/MessageCard'
import './MessageView.css'

type Props = { messages: ChatMessage[] }

export default function MessageView({ messages }: Props) {
  return (
    <div className="message-view">
      {messages.map((m) => (
        <MessageCard key={m.id} message={m} />
      ))}
    </div>
  )
}