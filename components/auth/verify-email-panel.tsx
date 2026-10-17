'use client'

import { useEffect, useRef, useState } from 'react'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'

interface VerifyEmailPanelProps {
  email: string
  onSuccess: () => void 
  onFail: () => void 
  onBack: () => void
  redirectTo?: string
  aside?: React.ReactNode
}

export function VerifyEmailPanel({
  email,
  onSuccess,
  onFail,
  onBack,
  redirectTo = '/onboarding/plan',
  aside,
}: VerifyEmailPanelProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [remaining, setRemaining] = useState(3)
  const [cooldown, setCooldown] = useState(0)
  const sentOnLoad = useRef(false)
  const submitting = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const sendCode = async (initial = false) => {
    setError('')
    setNotice('')
    setResending(true)
    try {
      const res = await fetch('/api/auth/verify-email/send', { method: 'POST' })
      const result = await res.json().catch(() => ({}))
      if (res.status === 401) {
        setError(result.error || 'Your session expired. Please go back and try again.')
        return
      }
      if (res.status === 429) {
        if (typeof result.remaining === 'number') setRemaining(result.remaining)
        if (!initial || result.remaining === 0) {
          setError(result.error || 'Please wait before requesting another code.')
        }
        return
      }
      if (!res.ok) {
        setError(result.error || 'Could not send code')
        return
      }
      setNotice(`Code sent to ${email}`)
      setRemaining(result.remaining ?? 0)
      setCooldown(30)
    } catch {
      setError('Could not send code')
    } finally {
      setResending(false)
    }
  }

  useEffect(() => {
    if (sentOnLoad.current) return
    sentOnLoad.current = true
    sendCode(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (value: string) => {
    if (submitting.current || value.length !== 6) return
    submitting.current = true
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: value }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(result.error || 'Verification failed')
        setCode('')
        onFail()
        return
      }
      setVerified(true)
      onSuccess()
      setTimeout(() => {
        window.location.href = redirectTo
      }, 1500)
    } catch {
      setError('Something went wrong. Please try again.')
      onFail()
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  const busy = loading || verified

  return (
    <div className="space-y-[clamp(0.75rem,2vh,1.25rem)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.3rem,1.8vw+1vh,1.875rem)] font-bold text-foreground tracking-tight leading-tight">
            Verify your email
          </h1>
          <p className="text-[clamp(0.72rem,0.7vw+0.3vh,0.875rem)] text-muted-foreground mt-1">
            Enter the 6-digit code we sent to{' '}
            <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
          </p>
        </div>
        {aside}
      </div>

      {verified && (
        <div className="p-2 rounded-xl bg-success/15 border border-success/30 text-success text-[clamp(0.7rem,0.6vw+0.3vh,0.8125rem)] text-center font-medium animate-pulse">
          Email verified! Preparing your workspace...
        </div>
      )}
      {!verified && notice && !error && (
        <p className="text-[clamp(0.7rem,0.6vw+0.3vh,0.8125rem)] text-muted-foreground">{notice}</p>
      )}
      {error && (
        <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[clamp(0.7rem,0.6vw+0.3vh,0.8125rem)] text-center font-medium">
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(code)
        }}
        className="space-y-4"
      >
        <InputOTP
          maxLength={6}
          pattern={REGEXP_ONLY_DIGITS}
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(v) => {
            setCode(v)
            if (error) setError('')
          }}
          onComplete={submit}
          disabled={busy}
          autoFocus
          containerClassName="justify-center"
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} aria-invalid={error ? true : undefined} />
            ))}
          </InputOTPGroup>
        </InputOTP>

        <Button
          type="submit"
          disabled={busy || code.length !== 6}
          className="w-full h-[clamp(2.25rem,4vh,2.75rem)] rounded-xl bg-foreground text-background font-semibold hover:opacity-90 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
            </>
          ) : verified ? (
            'Verified!'
          ) : (
            'Verify email'
          )}
        </Button>
      </form>

      <div className="flex items-center justify-between text-[clamp(0.7rem,0.7vw+0.3vh,0.8125rem)]">
        {remaining > 0 ? (
          <span className="text-muted-foreground">
            Didn&apos;t get it?{' '}
            <button
              type="button"
              onClick={() => sendCode(false)}
              disabled={resending || cooldown > 0 || busy}
              className="text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
            >
              {resending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : `Resend (${remaining} left)`}
            </button>
          </span>
        ) : (
          <span className="text-muted-foreground">No resends left. Try again in 15 minutes.</span>
        )}
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
      </div>
    </div>
  )
}