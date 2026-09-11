'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    THREE?: any
    VANTA?: any
  }
}

interface VantaBackgroundProps {
  color?: number
  backgroundColor?: number
  points?: number
  maxDistance?: number
  spacing?: number
  showDots?: boolean
  opacity?: number
  className?: string
}

export function VantaBackground({
  color = 0x10b981, // Emerald green matching the FinanceFlow branding
  backgroundColor = 0x090d16, // Dark slate background matching the theme
  points = 9.0, // Reduced density for cleaner, unobtrusive aesthetic
  maxDistance = 20.0,
  spacing = 18.0,
  showDots = true,
  opacity = 0.35, // Soft ambient opacity so it never outshines content
  className = '',
}: VantaBackgroundProps) {
  const vantaRef = useRef<HTMLDivElement>(null)
  const effectRef = useRef<any>(null)

  useEffect(() => {
    let timer: any = null

    const initVanta = () => {
      if (!vantaRef.current) return false
      if (typeof window === 'undefined') return false
      if (!window.VANTA?.NET || !window.THREE) return false

      if (effectRef.current) {
        try {
          effectRef.current.destroy()
        } catch {
          // ignore
        }
        effectRef.current = null
      }

      try {
        effectRef.current = window.VANTA.NET({
          el: vantaRef.current,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          color,
          backgroundColor,
          points,
          maxDistance,
          spacing,
          showDots,
        })
        return true
      } catch (err) {
        console.warn('[Vanta] Init error:', err)
        return false
      }
    }

    // Try immediately
    if (!initVanta()) {
      let attempts = 0
      timer = setInterval(() => {
        attempts++
        if (initVanta() || attempts > 60) {
          clearInterval(timer)
        }
      }, 100)
    }

    const handleResize = () => {
      if (effectRef.current && typeof effectRef.current.resize === 'function') {
        effectRef.current.resize()
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      if (timer) clearInterval(timer)
      window.removeEventListener('resize', handleResize)
      if (effectRef.current) {
        try {
          effectRef.current.destroy()
        } catch {
          // ignore
        }
        effectRef.current = null
      }
    }
  }, [color, backgroundColor, points, maxDistance, spacing, showDots])

  return (
    <div
      className={`fixed inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Vanta Canvas target with calibrated soft opacity */}
      <div
        ref={vantaRef}
        className="absolute inset-0 h-full w-full transition-opacity duration-1000"
        style={{ opacity }}
      />

      {/* Gentle ambient vignette overlay so foreground text has pristine contrast */}
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
