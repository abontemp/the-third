import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: 'linear-gradient(135deg, #3b82f6 0%, #f97316 100%)',
          borderRadius: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
        }}
      >
        {/* Bar 1 */}
        <div style={{ width: 58, height: 260, background: 'rgba(255,255,255,0.75)', borderRadius: 29 }} />
        {/* Bar 2 */}
        <div style={{ width: 58, height: 260, background: 'rgba(255,255,255,1)', borderRadius: 29 }} />
        {/* Bar 3 */}
        <div style={{ width: 58, height: 260, background: 'rgba(255,255,255,0.75)', borderRadius: 29 }} />
      </div>
    ),
    { ...size }
  )
}
