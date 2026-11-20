import { useState } from 'react'
import { ExternalLink, Plane } from 'lucide-react'

interface AircraftImageProps {
  src: string | null | undefined
  alt: string
  caption?: string
  author?: string | null
  license?: string | null
  sourceUrl?: string | null
  sourceLabel?: string
  aspectClass?: string
  className?: string
  showAttribution?: boolean
}

export function AircraftImage({
  src,
  alt,
  caption,
  author,
  license,
  sourceUrl,
  sourceLabel,
  aspectClass = 'aspect-[16/10]',
  className = '',
  showAttribution = true,
}: AircraftImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  const hasValidSrc = Boolean(src) && !failed

  return (
    <div className={`relative overflow-hidden bg-slate-100 dark:bg-[#0B1945] ${aspectClass} ${className}`}>
      {hasValidSrc ? (
        <>
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-[#0E1E52] dark:via-[#142868] dark:to-[#0E1E52]" />
          )}
          <img
            src={src!}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full object-cover transition-opacity duration-500 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#05164D]/90 to-[#0B226B] p-4 text-center text-white/80">
          <Plane className="h-10 w-10 text-[#FFAD00]/80" strokeWidth={1.5} />
          <span className="text-xs font-medium tracking-wide text-white/75">
            {caption || alt}
          </span>
        </div>
      )}

      {showAttribution && hasValidSrc && (author || license || sourceLabel) && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2.5 py-1.5 text-[10px] text-white/90">
          <span className="truncate drop-shadow-sm">
            {author ? `Foto: ${author}` : sourceLabel ?? 'Wikimedia Commons'}
            {license ? ` · ${license}` : ''}
          </span>
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex shrink-0 items-center gap-0.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm transition hover:bg-black/65"
              title="Bildquelle & Lizenz öffnen"
            >
              Quelle <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}
