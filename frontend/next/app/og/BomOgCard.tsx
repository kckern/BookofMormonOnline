// Satori JSX — no React DOM, inline styles only. Matches the legacy PHP GD card
// (render.php): gold plates logo + wordmark header on a blue field, a light
// content card holding a centered title / blue subtitle / gold rule / grey
// description, and a gold-framed square thumbnail on the right.
//
// /read cards vary this: the description is a scripture excerpt in the reader's
// Scripture face, and the right column is the speaker's circular portrait with a
// brown-gold voice pill — the same lockup as the reader's block gutter.

interface BomOgCardProps {
  /** Pre-fitted title line(s) — one line if it fits, else two balanced lines. */
  titleLines: string[]
  /** Font size chosen by the fitter (lib/ogCard) for the title. */
  titleFontSize: number
  sub?: string
  desc?: string
  /** Font family override for the description (e.g. 'Scripture' for Latin /read excerpts). */
  descFont?: string
  /** Apply the fuller scripture-excerpt layout (bigger, denser, left-aligned, more lines). */
  scriptureStyle?: boolean
  artUrl?: string
  /** Reader-style speaker lockup for /read cards. */
  speaker?: { voice: string; avatarUrl?: string }
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
const VOICE = '#92785d' // reader's brown-gold voice pill (Read.scss)

export function BomOgCard({ titleLines, titleFontSize, sub, desc, descFont, scriptureStyle, artUrl, speaker, logoUrl, siteTitle, fontFamily }: BomOgCardProps) {
  const avatarUrl = speaker?.avatarUrl
  const hasRightCol = Boolean(artUrl || avatarUrl)
  const colWidth = hasRightCol ? 720 : 1000
  const isScripture = Boolean(scriptureStyle)
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
                // Scripture excerpts read as a fuller block: bigger, denser, darker,
                // more lines, left-aligned like the reader; teaser descriptions stay
                // small/centered.
                fontSize: isScripture ? 25 : 20,
                fontWeight: isScripture ? 400 : 300,
                // Only override the family when set; a literal `fontFamily: undefined`
                // makes satori call .split on undefined (crashes the whole render).
                ...(descFont ? { fontFamily: descFont } : {}),
                lineHeight: isScripture ? 1.34 : 1.5,
                color: isScripture ? '#2b2b2b' : GREY,
                textAlign: isScripture ? 'left' : 'center',
                marginTop: 16,
                maxWidth: colWidth - 48,
                display: '-webkit-box',
                WebkitLineClamp: isScripture ? 6 : 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {desc}
            </div>
          )}
        </div>
      </div>

      {/* Right column: reader-style speaker portrait + voice pill, OR gold-framed art */}
      {avatarUrl ? (
        <div
          style={{
            position: 'absolute',
            left: 800,
            top: 205,
            width: 340,
            height: 345,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            width={210}
            height={210}
            alt=""
            style={{ width: 210, height: 210, borderRadius: 210, border: `4px solid ${VOICE}`, objectFit: 'cover' }}
          />
          {speaker?.voice && (
            <div
              style={{
                display: 'flex',
                marginTop: -22,
                paddingTop: 6,
                paddingBottom: 6,
                paddingLeft: 18,
                paddingRight: 18,
                backgroundColor: VOICE,
                color: '#ffffff',
                fontSize: 24,
                fontWeight: 700,
                borderRadius: 8,
                border: '1px solid #444',
              }}
            >
              {speaker.voice}
            </div>
          )}
        </div>
      ) : artUrl ? (
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
      ) : null}
    </div>
  )
}
