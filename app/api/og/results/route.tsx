import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const opponent = searchParams.get('opponent') || 'Adversaire'
  const top = searchParams.get('top') || '?'
  const topVotes = searchParams.get('topVotes') || '0'
  const flop = searchParams.get('flop') || '?'
  const flopVotes = searchParams.get('flopVotes') || '0'
  const date = searchParams.get('date') || ''
  const bestAction = searchParams.get('bestAction') || ''
  const bestActionVotes = searchParams.get('bestActionVotes') || '0'

  const formattedDate = date
    ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background decoration */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-80px',
          left: '-80px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '32px 48px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              gap: '4px',
              alignItems: 'flex-end',
            }}>
              {[16, 24, 16].map((h, i) => (
                <div key={i} style={{
                  width: '8px',
                  height: `${h}px`,
                  background: 'linear-gradient(to top, #f97316, #fb923c)',
                  borderRadius: '2px',
                  display: 'flex',
                }} />
              ))}
            </div>
            <span style={{ color: 'white', fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>
              The Third
            </span>
          </div>

          {/* Match info */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>Résultats du match</span>
            <span style={{ color: 'white', fontSize: '20px', fontWeight: 700 }}>vs {opponent}</span>
            {formattedDate && (
              <span style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>{formattedDate}</span>
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{
          flex: 1,
          display: 'flex',
          padding: '32px 48px',
          gap: '32px',
          alignItems: 'stretch',
        }}>
          {/* TOP card */}
          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)',
            border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 20px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              background: 'linear-gradient(135deg, #eab308, #ca8a04)',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              🏆
            </div>
            <span style={{ color: '#eab308', fontSize: '13px', fontWeight: 600, letterSpacing: '2px', marginTop: '16px', textTransform: 'uppercase' }}>
              TOP du match
            </span>
            <span style={{ color: 'white', fontSize: '32px', fontWeight: 800, marginTop: '12px', textAlign: 'center', lineHeight: 1.2 }}>
              {top}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '12px',
              background: 'rgba(234,179,8,0.15)',
              borderRadius: '20px',
              padding: '4px 14px',
            }}>
              <span style={{ color: '#fbbf24', fontSize: '15px', fontWeight: 600 }}>{topVotes}</span>
              <span style={{ color: '#78716c', fontSize: '13px' }}>votes</span>
            </div>
          </div>

          {/* FLOP card */}
          <div style={{
            flex: 1,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 20px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              😬
            </div>
            <span style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, letterSpacing: '2px', marginTop: '16px', textTransform: 'uppercase' }}>
              FLOP du match
            </span>
            <span style={{ color: 'white', fontSize: '32px', fontWeight: 800, marginTop: '12px', textAlign: 'center', lineHeight: 1.2 }}>
              {flop}
            </span>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '12px',
              background: 'rgba(239,68,68,0.15)',
              borderRadius: '20px',
              padding: '4px 14px',
            }}>
              <span style={{ color: '#f87171', fontSize: '15px', fontWeight: 600 }}>{flopVotes}</span>
              <span style={{ color: '#78716c', fontSize: '13px' }}>votes</span>
            </div>
          </div>

          {/* Best action card (conditional) */}
          {bestAction && (
            <div style={{
              flex: 1,
              background: 'linear-gradient(135deg, rgba(251,146,60,0.15) 0%, rgba(251,146,60,0.05) 100%)',
              border: '1px solid rgba(251,146,60,0.3)',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '28px 20px',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: '-20px',
                background: 'linear-gradient(135deg, #fb923c, #f97316)',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
              }}>
                ✨
              </div>
              <span style={{ color: '#fb923c', fontSize: '13px', fontWeight: 600, letterSpacing: '2px', marginTop: '16px', textTransform: 'uppercase' }}>
                Plus beau geste
              </span>
              <span style={{ color: 'white', fontSize: '32px', fontWeight: 800, marginTop: '12px', textAlign: 'center', lineHeight: 1.2 }}>
                {bestAction}
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '12px',
                background: 'rgba(251,146,60,0.15)',
                borderRadius: '20px',
                padding: '4px 14px',
              }}>
                <span style={{ color: '#fdba74', fontSize: '15px', fontWeight: 600 }}>{bestActionVotes}</span>
                <span style={{ color: '#78716c', fontSize: '13px' }}>votes</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 48px 28px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ color: '#475569', fontSize: '13px' }}>
            Résultats générés avec The Third — l&apos;app de vote de ton équipe
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
