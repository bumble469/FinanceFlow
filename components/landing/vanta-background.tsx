'use client'

import Lightfall from './Lightfall'

export function VantaBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <Lightfall
        colors={['#10b981', '#34d399', '#6ee7b7']}
        backgroundColor="#090d16"
        speed={0.5}
        streakCount={2}
        streakWidth={1}
        streakLength={1}
        glow={0.6}
        density={0.6}
        twinkle={1}
        zoom={3}
        backgroundGlow={0.25}
        opacity={0.45}
        mouseInteraction
        mouseStrength={0.5}
        mouseRadius={1}
      />

      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 25%, transparent 15%, var(--background) 95%)',
          opacity: 0.55,
        }}
      />
    </div>
  )
}