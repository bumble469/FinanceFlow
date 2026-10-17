'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Lightfall from './Lightfall'

// Hoisted so Lightfall's effect doesn't rebuild the WebGL renderer on every render
const STREAK_COLORS = ['#10b981', '#34d399', '#6ee7b7']

export function VantaBackground() {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // next-themes can't know the theme on the server; wait to avoid a wrong-color flash
  if (!mounted) return null

  const isLight = resolvedTheme === 'light' // Light and System-light
  // Dark keeps the navy; System-dark uses the charcoal from system-theme.css
  const darkBg = theme === 'system' ? '#2a2a2c' : '#090d16'

  return (
    <>
      {/* Animation layer. In light themes it multiplies onto the page background. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
        style={isLight ? { mixBlendMode: 'multiply' } : undefined}
      >
        <Lightfall
          key={isLight ? 'light' : 'dark'}
          lightMode={isLight}
          colors={STREAK_COLORS}
          backgroundColor={darkBg}
          speed={0.5}
          streakCount={2}
          streakWidth={1}
          streakLength={1}
          glow={0.6}
          density={0.6}
          twinkle={1}
          zoom={3}
          backgroundGlow={0.25}
          opacity={isLight ? 0.6 : 0.45}
          mouseInteraction
          mouseStrength={0.5}
          mouseRadius={1}
        />
      </div>

      {/* Edge fade into the current theme's background (sibling, so it isn't multiplied) */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 50% 25%, transparent 15%, var(--background) 95%)',
          opacity: 0.55,
        }}
      />
    </>
  )
}