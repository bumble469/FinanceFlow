'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RiveRobot } from '@/components/auth/rive-robot'

interface LoginFormValues {
  email: string
  password: string
}

interface LoginApiResponse {
  success: boolean
  data?: {
    accessToken: string
    user: {
      id: string
      email: string
      name: string | null
    }
  }
  error?: string
  errors?: Record<string, string>
}

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  // Robot animation triggers
  const [triggerFail, setTriggerFail] = useState(0)
  const [triggerSuccess, setTriggerSuccess] = useState(0)

  const [formData, setFormData] = useState<LoginFormValues>({
    email: '',
    password: '',
  })

  const [errors, setErrors] = useState<Partial<LoginFormValues & { general: string }>>({})
  const [loading, setLoading] = useState(false)
  const [isSuccessState, setIsSuccessState] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      setTriggerFail((prev) => prev + 1)
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrors({})

    if (!validateForm()) return

    try {
      setLoading(true)

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result: LoginApiResponse = await res.json()

      if (!res.ok || !result.success) {
        setErrors({
          general: result.errors?.general || result.error || 'Login failed',
        })
        setTriggerFail((prev) => prev + 1)
        return
      }

      setTriggerSuccess((prev) => prev + 1)
      setIsSuccessState(true)

      // 1.5s delay to show success animation
      setTimeout(() => {
        router.push('/')
      }, 1500)
    } catch (err) {
      setErrors({ general: 'Something went wrong. Please try again.' })
      setTriggerFail((prev) => prev + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="h-screen max-h-screen overflow-hidden grid lg:grid-cols-12 bg-background relative">

      {/* LEFT COLUMN: Interactive Robot Stage (Desktop only, hidden on mobile) */}
      <div className="lg:col-span-5 xl:col-span-6 relative hidden lg:flex h-full flex-col items-center justify-center p-8 bg-gradient-to-br from-secondary/25 via-background to-secondary/10 border-r border-border/30 overflow-hidden">

        {/* Soft decorative background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />

        {/* Interactive Rive Robot Canvas */}
        <div className="w-full max-w-[420px] aspect-square relative z-10 flex items-center justify-center">
          <RiveRobot
            isHandsUp={isPasswordFocused}
            triggerFail={triggerFail}
            triggerSuccess={triggerSuccess}
            className="drop-shadow-2xl"
          />
        </div>

        {/* Companion hint */}
        <div className="relative z-10 mt-4 text-center max-w-xs">
          <p className="text-[clamp(0.65rem,0.6vw+0.3vh,0.75rem)] font-medium text-muted-foreground">
            Your password is safe. I only judge your typing speed. 🤖
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Login Form (Dominant on mobile, fits 100vh) */}
      <div className="lg:col-span-7 xl:col-span-6 h-full flex flex-col justify-between p-[clamp(1rem,2vw+1vh,2.5rem)] z-10 overflow-hidden">

        {/* Top bar with back link */}
        <div className="flex items-center justify-between shrink-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[clamp(0.7rem,0.6vw+0.3vh,0.875rem)] text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to home</span>
          </Link>
        </div>

        {/* Center: Main Form Card with fluid scaling */}
        <div className="mx-auto w-full max-w-sm sm:max-w-md my-auto py-1">
          {/* Header Text */}
          <h1 className="text-[clamp(1.35rem,1.8vw+1vh,2rem)] font-bold text-foreground tracking-tight leading-tight">
            Welcome Back!
          </h1>
          <p className="text-[clamp(0.75rem,0.8vw+0.4vh,0.875rem)] text-muted-foreground mt-1 mb-[clamp(0.75rem,2vh,1.5rem)]">
            Please enter your login details.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-[clamp(0.65rem,1.5vh,1rem)]">
            {errors.general && (
              <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[clamp(0.7rem,0.6vw+0.3vh,0.8125rem)] text-center font-medium">
                {errors.general}
              </div>
            )}

            {isSuccessState && (
              <div className="p-2 rounded-xl bg-success/15 border border-success/30 text-success text-[clamp(0.7rem,0.6vw+0.3vh,0.8125rem)] text-center font-medium animate-pulse">
                Login successful! Redirecting...
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] font-semibold text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="johnwick123@gmail.com"
                value={formData.email}
                disabled={loading || isSuccessState}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value })
                  if (errors.email) setErrors({ ...errors, email: undefined })
                }}
                className="bg-secondary/40 border-border/50 rounded-xl px-3.5 h-[clamp(2.25rem,3.8vh,2.75rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
              />
              {errors.email && (
                <p className="text-[11px] text-destructive font-medium mt-0.5">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] font-semibold text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={formData.password}
                  disabled={loading || isSuccessState}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value })
                    if (errors.password) setErrors({ ...errors, password: undefined })
                  }}
                  className="bg-secondary/40 border-border/50 rounded-xl px-3.5 pr-10 h-[clamp(2.25rem,3.8vh,2.75rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-destructive font-medium mt-0.5">{errors.password}</p>
              )}
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end">
              <Link
                href="/contact"
                className="text-[clamp(0.65rem,0.6vw+0.3vh,0.75rem)] font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || isSuccessState}
              className="w-full h-[clamp(2.25rem,4vh,2.75rem)] text-[clamp(0.75rem,0.8vw+0.3vh,0.9375rem)] rounded-xl bg-foreground hover:text-gray-50 text-background font-semibold hover:opacity-90 active:scale-[0.99] transition-all shadow-md cursor-pointer"
            >
              {loading ? 'Logging in...' : isSuccessState ? 'Success!' : 'Login'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-[clamp(0.5rem,1.6vh,1.1rem)] flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[clamp(0.65rem,0.6vw+0.3vh,0.75rem)] font-semibold tracking-wider text-muted-foreground uppercase">
              OR
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Google Login Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading || isSuccessState}
            className="w-full h-[clamp(2.25rem,4vh,2.75rem)] text-[clamp(0.72rem,0.7vw+0.3vh,0.875rem)] rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 text-foreground font-medium hover:text-gray-400 flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm"
          >
            <FcGoogle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>With Google</span>
          </Button>

          {/* Footer */}
          <div className="mt-[clamp(0.75rem,2vh,1.5rem)] text-center text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-semibold ml-1">
              Sign up
            </Link>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="text-[clamp(0.65rem,0.6vw+0.2vh,0.75rem)] text-muted-foreground/60 text-center lg:text-left shrink-0">
          © {new Date().getFullYear()} FinanceFlow Inc. All rights reserved.
        </div>
      </div>

    </div>
  )
}
