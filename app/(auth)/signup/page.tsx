'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AccountTypeToggle } from '@/components/auth/account-type-toggle'
import { RiveRobot } from '@/components/auth/rive-robot'

interface SignupFormValues {
  accountType: 'individual' | 'company'
  companyName: string
  name: string
  email: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  accountType?: string
  companyName?: string
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export default function SignupPage() {
  const [formData, setFormData] = useState<SignupFormValues>({
    accountType: 'individual',
    companyName: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)

  // Robot animation triggers
  const [triggerFail, setTriggerFail] = useState(0)
  const [triggerSuccess, setTriggerSuccess] = useState(0)

  const [loading, setLoading] = useState(false)
  const [isSuccessState, setIsSuccessState] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<keyof SignupFormValues, boolean>>>({})

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (formData.accountType === 'company' && !formData.companyName.trim()) {
      newErrors.companyName = 'Company name is required'
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      setTriggerFail((prev) => prev + 1)
      return false
    }
    return true
  }

  const validateField = (name: keyof SignupFormValues, value: string) => {
    const newErrors = { ...errors }

    switch (name) {
      case 'companyName':
        if (formData.accountType === 'company' && !value.trim()) {
          newErrors.companyName = 'Company name is required'
        } else {
          delete newErrors.companyName
        }
        break
      case 'name':
        if (!value.trim()) {
          newErrors.name = 'Name is required'
        } else if (value.trim().length < 2) {
          newErrors.name = 'Name must be at least 2 characters'
        } else {
          delete newErrors.name
        }
        break
      case 'email':
        if (!value.trim()) {
          newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Please enter a valid email'
        } else {
          delete newErrors.email
        }
        break
      case 'password':
        if (!value) {
          newErrors.password = 'Password is required'
        } else if (value.length < 8) {
          newErrors.password = 'Password must be at least 8 characters'
        } else {
          delete newErrors.password
        }
        if (touched.confirmPassword) {
          if (formData.confirmPassword && value !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match'
          } else {
            delete newErrors.confirmPassword
          }
        }
        break
      case 'confirmPassword':
        if (!value) {
          newErrors.confirmPassword = 'Please confirm your password'
        } else if (formData.password !== value) {
          newErrors.confirmPassword = 'Passwords do not match'
        } else {
          delete newErrors.confirmPassword
        }
        break
    }

    setErrors(newErrors)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      setLoading(true)

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          name: formData.name,
          accountType: formData.accountType,
          accountName: formData.accountType === 'company' ? formData.companyName : undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        if (json.errors) {
          setErrors(json.errors)
        } else {
          setErrors({ email: json.error || 'Signup failed' })
        }
        setTriggerFail((prev) => prev + 1)
        return
      }

      setTriggerSuccess((prev) => prev + 1)
      setIsSuccessState(true)

      document.cookie = `access_token=${json.data.accessToken}; path=/; max-age=${15 * 60}; samesite=lax`

      // 1.5s delay to show success animation
      setTimeout(() => {
        window.location.href = '/onboarding/plan'
      }, 1500)
    } catch (err) {
      console.error('Signup failed:', err)
      setErrors({ email: 'Something went wrong. Please try again.' })
      setTriggerFail((prev) => prev + 1)
    } finally {
      setLoading(false)
    }
  }

  const handleAccountTypeChange = (value: 'individual' | 'company') => {
    setFormData({ ...formData, accountType: value, companyName: '' })
    if (errors.accountType || errors.companyName) {
      setErrors({ ...errors, accountType: undefined, companyName: undefined })
    }
  }

  const handleGoogleSignup = () => {
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
            New account? Bold move. Let's hope you remember the password. 🤖
          </p>
        </div>
      </div>

      {/* RIGHT COLUMN: Signup Form with responsive text & internal scrolling */}
      <div className="lg:col-span-7 xl:col-span-6 h-full flex flex-col justify-between p-[clamp(1rem,2vw+1vh,2.5rem)] z-10 overflow-hidden">

        {/* Top bar with back button */}
        <div className="flex items-center justify-between shrink-0 mb-1.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[clamp(0.7rem,0.6vw+0.3vh,0.875rem)] text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            <span>Back to home</span>
          </Link>
        </div>

        {/* Center Section: Fixed Header + Internal Scrollable Form Area */}
        <div className="mx-auto w-full max-w-sm sm:max-w-md flex flex-col flex-1 min-h-0 my-auto py-4">

          {/* Header Text (Fluid typography) */}
          <div className="flex items-start justify-between gap-3 shrink-0 mb-2 sm:mb-2.5">
            <div>
              <h1 className="text-[clamp(1.3rem,1.8vw+1vh,1.875rem)] font-bold text-foreground tracking-tight leading-tight">
                Create an Account
              </h1>

              <p className="text-[clamp(0.72rem,0.7vw+0.3vh,0.875rem)] text-muted-foreground mt-0.5">
                Join FinanceFlow to manage your projects and finances.
              </p>
            </div>

            <div className="lg:hidden shrink-0 w-16 h-16 pointer-events-none">
              <RiveRobot
                isHandsUp={isPasswordFocused}
                triggerFail={triggerFail}
                triggerSuccess={triggerSuccess}
              />
            </div>
          </div>

          {/* Internal Form Scroll Container */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 py-0.5">
            <form onSubmit={handleSubmit} className="space-y-[clamp(0.55rem,1.2vh,0.85rem)]">
              {isSuccessState && (
                <div className="p-2 rounded-xl bg-success/15 border border-success/30 text-success text-[clamp(0.7rem,0.6vw+0.3vh,0.8125rem)] text-center font-medium animate-pulse">
                  Account created successfully! Preparing your workspace...
                </div>
              )}

              {/* Account Type Toggle */}
              <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/50 text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)]">
                <AccountTypeToggle
                  value={formData.accountType}
                  onChange={handleAccountTypeChange}
                />
              </div>

              {/* Company Name (Conditional) */}
              {formData.accountType === 'company' && (
                <div className="space-y-0.5">
                  <Label htmlFor="companyName" className="text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] font-semibold text-foreground">
                    Company Name
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Your Company Inc."
                    value={formData.companyName}
                    disabled={loading || isSuccessState}
                    onChange={(e) => {
                      setFormData({ ...formData, companyName: e.target.value })
                      if (errors.companyName) setErrors({ ...errors, companyName: undefined })
                    }}
                    className="bg-secondary/40 border-border/50 rounded-xl px-3.5 h-[clamp(2.1rem,3.4vh,2.5rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                  />
                  {errors.companyName && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{errors.companyName}</p>
                  )}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-0.5">
                <Label htmlFor="name" className="text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] font-semibold text-foreground">
                  Full Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  disabled={loading || isSuccessState}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (errors.name) setErrors({ ...errors, name: undefined })
                  }}
                  onBlur={(e) => {
                    setTouched({ ...touched, name: true })
                    validateField('name', e.target.value)
                  }}
                  className="bg-secondary/40 border-border/50 rounded-xl px-3.5 h-[clamp(2.1rem,3.4vh,2.5rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                />
                {errors.name && (
                  <p className="text-[11px] text-destructive font-medium mt-0.5">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-0.5">
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
                  onBlur={(e) => {
                    setTouched({ ...touched, email: true })
                    validateField('email', e.target.value)
                  }}
                  className="bg-secondary/40 border-border/50 rounded-xl px-3.5 h-[clamp(2.1rem,3.4vh,2.5rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                />
                {errors.email && (
                  <p className="text-[11px] text-destructive font-medium mt-0.5">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-0.5">
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
                    onBlur={(e) => {
                      setIsPasswordFocused(false)
                      setTouched({ ...touched, password: true })
                      validateField('password', e.target.value)
                    }}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value })
                      if (errors.password) setErrors({ ...errors, password: undefined })
                    }}
                    className="bg-secondary/40 border-border/50 rounded-xl px-3.5 pr-10 h-[clamp(2.1rem,3.4vh,2.5rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
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

              {/* Confirm Password */}
              <div className="space-y-0.5">
                <Label htmlFor="confirmPassword" className="text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] font-semibold text-foreground">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={formData.confirmPassword}
                    disabled={loading || isSuccessState}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={(e) => {
                      setIsPasswordFocused(false)
                      setTouched({ ...touched, confirmPassword: true })
                      validateField('confirmPassword', e.target.value)
                    }}
                    onChange={(e) => {
                      setFormData({ ...formData, confirmPassword: e.target.value })
                      if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined })
                    }}
                    className="bg-secondary/40 border-border/50 rounded-xl px-3.5 pr-10 h-[clamp(2.1rem,3.4vh,2.5rem)] text-[clamp(0.75rem,0.7vw+0.3vh,0.875rem)] text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[11px] text-destructive font-medium mt-0.5">{errors.confirmPassword}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || isSuccessState}
                className="w-full h-[clamp(2.25rem,3.8vh,2.75rem)] text-[clamp(0.75rem,0.8vw+0.3vh,0.9375rem)] rounded-xl bg-foreground text-background font-semibold hover:opacity-90 active:scale-[0.99] transition-all shadow-md cursor-pointer mt-1"
              >
                {loading ? 'Creating Account...' : isSuccessState ? 'Created!' : 'Create Account'}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-[clamp(0.4rem,1.2vh,0.85rem)] flex items-center gap-3">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-[clamp(0.65rem,0.6vw+0.3vh,0.75rem)] font-semibold tracking-wider text-muted-foreground uppercase">
                OR
              </span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            {/* Google Signup Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignup}
              disabled={loading || isSuccessState}
              className="w-full h-[clamp(2.25rem,3.8vh,2.75rem)] text-[clamp(0.72rem,0.7vw+0.3vh,0.875rem)] rounded-xl border border-border/60 bg-secondary/20 hover:bg-secondary/50 text-foreground font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm"
            >
              <FcGoogle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>With Google</span>
            </Button>

            {/* Footer */}
            <div className="mt-3 pb-2 text-center text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)] text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline font-semibold ml-1">
                Sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="text-[clamp(0.65rem,0.6vw+0.2vh,0.75rem)] text-muted-foreground/60 text-center lg:text-left shrink-0 pt-1">
          © {new Date().getFullYear()} FinanceFlow Inc. All rights reserved.
        </div>
      </div>

    </div>
  )
}
