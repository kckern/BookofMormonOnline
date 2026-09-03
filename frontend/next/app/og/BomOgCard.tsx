// Satori JSX — no React DOM, inline styles only. Matches the legacy PHP GD card
// (render.php): gold plates logo + wordmark header on a blue field, a light
// content card holding a centered title / blue subtitle / gold rule / grey
// description, and a gold-framed square thumbnail on the right.

interface BomOgCardProps {
  /** Pre-fitted title line(s) — one line if it fits, else two balanced lines. */
  titleLines: string[]
  /** Font size chosen by the fitter (lib/ogCard) for the title. */
  titleFontSize: number
  sub?: string
  desc?: string
  artUrl?: string
  /** data: URI of the gold stacked-plates mark. */
  logoUrl: string
  /** Localized wordmark, e.g. "Book of Mormon Online". */
  siteTitle: string
  /** Registered font family to render in (RobotoCondensed, or IBMPlexSansKR for ko). */
  fontFamily: string
}

const BLUE = '#323b4d'
const GOLD = '#fbc658'
const CARD = '#d6d8db'
const GREY = '#3f3f3f'

export function BomOgCard({ titleLines, titleFontSize, sub, desc, artUrl, logoUrl, siteTitle, fontFamily }: BomOgCardProps) {
  const colWidth = artUrl ? 720 : 1000
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        position: 'relative',
        backgroundColor: BLUE,
        fontFamily,
      }}
    >
      {/* Header: gold plates mark + wordmark */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} width={132} height={132} alt="" style={{ position: 'absolute', left: 60, top: 34 }} />
      <div style={{ position: 'absolute', left: 208, top: 46, fontSize: 66, fontWeight: 700, color: '#ffffff' }}>
        {siteTitle}
      </div>

      {/* Light content card */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 205,
          width: 1080,
          height: 345,
          backgroundColor: CARD,
          display: 'flex',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: colWidth,
            height: 345,
            paddingTop: 24,
            paddingBottom: 24,
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: colWidth - 40,
            }}
          >
            {titleLines.map((ln, i) => (
              <div
                key={i}
                style={{
                  fontSize: titleFontSize,
                  fontWeight: 700,
                  color: '#000000',
                  textAlign: 'center',
                  lineHeight: 1.12,
                }}
              >
                {ln}
              </div>
            ))}
          </div>

          {sub && (
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: BLUE,
                textAlign: 'center',
                lineHeight: 1.2,
                marginTop: 8,
                maxWidth: colWidth - 60,
              }}
            >
              {sub}
            </div>
          )}

          <div style={{ width: Math.min(680, colWidth - 40), height: 5, backgroundColor: GOLD, marginTop: 16 }} />

          {desc && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 300,
                lineHeight: 1.5,
                color: GREY,
                textAlign: 'center',
                marginTop: 16,
                maxWidth: colWidth - 60,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {desc}
            </div>
          )}
        </div>
      </div>

      {/* Gold-framed square thumbnail */}
      {artUrl && (
        <div
          style={{
            position: 'absolute',
            left: 820,
            top: 225,
            width: 305,
            height: 300,
            backgroundColor: GOLD,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={artUrl} width={281} height={280} alt="" style={{ objectFit: 'cover' }} />
        </div>
      )}
    </div>
  )
}
