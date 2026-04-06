import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #3b82f6 0%, #f97316 100%)',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <div style={{ width: 20, height: 90, background: 'rgba(255,255,255,0.75)', borderRadius: 10 }} />
        <div style={{ width: 20, height: 90, background: 'rgba(255,255,255,1)', borderRadius: 10 }} />
        <div style={{ width: 20, height: 90, background: 'rgba(255,255,255,0.75)', borderRadius: 10 }} />
      </div>
    ),
    { ...size }
  )
}
