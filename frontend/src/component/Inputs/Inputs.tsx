import './Inputs.css'
import sendIcon from '../../assets/icons/send.svg'
import attachIcon from '../../assets/icons/attach.svg'
import PendingFile from './PendingFile'
import type { PendingFileItem } from '../../types'

type InputsProps = {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onFileSelect?: (file: File | null) => void;
    files: PendingFileItem[];
    onRemoveFile: (id: string) => void;
    disabled: boolean;
}

export default function Inputs({ value, onChange, onSend, onFileSelect, files, onRemoveFile, disabled = false }: InputsProps) {
    return (
        <div className="inputs-container">
            <PendingFile files={files ?? []} onRemove={onRemoveFile} />
            <form className="inputs" onSubmit={(e) => {
                e.preventDefault();
                onSend()
            }}>
                <label
                    className="inputs-attach"
                    aria-label="Ajouter un fichier"
                    aria-disabled={disabled || files.length >= 5}
                >
                    <input
                        type="file"
                        hidden
                        accept=".pdf,.txt,.md"
                        onChange={(e) => onFileSelect?.(e.target.files?.[0] || null)}
                        disabled={disabled || files.length >= 5}
                    />
                    <img src={attachIcon} alt="" width={20} height={20} />
                </label>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                />
                <button type="submit" disabled={disabled} aria-label="Send">
                    <img src={sendIcon} alt="" width={20} height={20} />
                </button>
            </form>
        </div>
    )
}
