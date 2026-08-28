// Satori JSX — no React DOM. Inline styles only.

interface BomOgCardProps {
  title: string
  sub?: string
  desc?: string
  artUrl?: string
}

export function BomOgCard({ title, sub, desc, artUrl }: BomOgCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        width: 1200,
        height: 630,
        background: '#32394d',
        fontFamily: 'RobotoCondensed',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gold accent frame — top-right corner */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 340,
          height: 340,
          border: '6px solid #fbc658',
          borderRadius: 4,
          transform: 'translate(80px, -80px) rotate(15deg)',
        }}
      />

      {/* Art image area */}
      {artUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artUrl}
          alt=""
          width={260}
          height={260}
          style={{
            position: 'absolute',
            right: 30,
            top: 30,
            width: 260,
            height: 260,
            objectFit: 'cover',
            borderRadius: 4,
          }}
        />
      )}

      {/* White semi-transparent content card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'absolute',
          left: 40,
          bottom: 40,
          right: artUrl ? 320 : 60,
          top: 40,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 8,
          padding: '32px 40px',
        }}
      >
        {sub && (
          <div
            style={{
              fontSize: 22,
              color: '#fbc658',
              fontWeight: 700,
              marginBottom: 12,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {sub}
          </div>
        )}

        <div
          style={{
            fontSize: title.length > 40 ? 44 : 56,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: desc ? 20 : 0,
          }}
        >
          {title}
        </div>

        {desc && (
          <div
            style={{
              fontSize: 24,
              color: 'rgba(255,255,255,0.80)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {desc}
          </div>
        )}

        {/* Wordmark */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 32,
            fontSize: 16,
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: 2,
          }}
        >
          BOOKOFMORMON.ONLINE
        </div>
      </div>
    </div>
  )
}
