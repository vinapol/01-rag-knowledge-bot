import { useEffect, useRef, useState } from 'react'
import documentIcon from '../../assets/icons/document.svg'
import closeIcon from '../../assets/icons/close.svg'
import chevronLeft from '../../assets/icons/chevron-left.svg'
import chevronRight from '../../assets/icons/chevron-right.svg'
import './PendingFile.css'

import type { PendingFileItem } from '../../types'

export const MAX_PENDING_FILES = 5

type PendingFileProps = {
    files: PendingFileItem[]
    onRemove?: (id: string) => void
}

export default function PendingFile({ files, onRemove }: PendingFileProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    const updateScrollState = () => {
        const el = trackRef.current
        if (!el) return
        const maxScroll = el.scrollWidth - el.clientWidth
        setCanScrollLeft(el.scrollLeft > 2)
        setCanScrollRight(el.scrollLeft < maxScroll - 2)
    }

    useEffect(() => {
        updateScrollState()
        const el = trackRef.current
        if (!el) return

        const onScroll = () => updateScrollState()
        el.addEventListener('scroll', onScroll, { passive: true })

        const observer = new ResizeObserver(updateScrollState)
        observer.observe(el)

        return () => {
            el.removeEventListener('scroll', onScroll)
            observer.disconnect()
        }
    }, [files])

    if (files.length === 0) return null

    const scrollByCards = (direction: -1 | 1) => {
        const el = trackRef.current
        if (!el) return
        el.scrollBy({ left: direction * 140, behavior: 'smooth' })
    }

    return (
        <div className="pending-file">
            <button
                type="button"
                className="pending-file-arrow"
                aria-label="Fichiers précédents"
                disabled={!canScrollLeft}
                onClick={() => scrollByCards(-1)}
            >
                <img src={chevronLeft} alt="" width={16} height={16} />
            </button>

            <div className="pending-file-track" ref={trackRef}>
                {files.map((file) => (
                    <div key={file.id} className="pending-file-card">
                        <img src={documentIcon} alt="" width={18} height={18} />
                        <span className="pending-file-name">{file.filename}</span>
                        {onRemove && (
                            <button
                                type="button"
                                className="pending-file-remove"
                                aria-label={`Retirer ${file.filename}`}
                                onClick={() => onRemove(file.id)}
                            >
                                <img src={closeIcon} alt="" width={14} height={14} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <button
                type="button"
                className="pending-file-arrow"
                aria-label="Fichiers suivants"
                disabled={!canScrollRight}
                onClick={() => scrollByCards(1)}
            >
                <img src={chevronRight} alt="" width={16} height={16} />
            </button>
        </div>
    )
}
