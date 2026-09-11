'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import Image from 'next/image'

export function LandingHeader() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string>('#home')

  const navLinks = [
    { href: '#home', label: 'Home' },
    { href: '#features', label: 'Features' },
    { href: '#about', label: 'About' },
    { href: '#cta', label: 'Get Started' },
  ]

  // Track active section on scroll using IntersectionObserver
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      setActiveSection(window.location.hash)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(`#${entry.target.id}`)
          }
        })
      },
      {
        rootMargin: '-20% 0px -50% 0px',
        threshold: 0.1,
      }
    )

    const sectionIds = ['home', 'features', 'about', 'cta']
    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/25 backdrop-blur-md supports-[backdrop-filter]:bg-background/20 transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 lg:px-8">
        
        {/* Left: Logo + Navigation grouped together */}
        <div className="flex items-center gap-8 lg:gap-10">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-bold text-foreground hover:opacity-90 transition-opacity"
          >
            <Image
              src="/web_logo.png"
              alt="FinanceFlow Logo"
              width={28}
              height={28}
              className="rounded-md"
            />
            <span className="tracking-tight text-base font-semibold">FinanceFlow</span>
          </Link>

          {/* Desktop Navigation with Animated Left-to-Right Underline */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-8">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href

              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setActiveSection(link.href)}
                  className={`group relative py-1 text-sm font-medium transition-colors cursor-pointer ${
                    isActive ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {link.label}
                  {/* Left-to-right animated underline */}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-[2px] rounded-full bg-primary transition-transform duration-300 ease-out origin-left ${
                      isActive
                        ? 'w-full scale-x-100'
                        : 'w-full scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </a>
              )
            })}
          </nav>
        </div>

        {/* Right: Auth Buttons */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            href="/login"
            className="group relative py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Login
            {/* Left-to-right animated hover underline */}
            <span className="absolute -bottom-0.5 left-0 h-[2px] w-full scale-x-0 rounded-full bg-primary transition-transform duration-300 ease-out origin-left group-hover:scale-x-100" />
          </Link>

          <Link
            href="/signup"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-sm"
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden text-foreground hover:text-primary transition-colors p-1"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {isOpen && (
        <div className="md:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl px-6 py-5">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href

              return (
                <a
                  key={link.label}
                  href={link.href}
                  className={`flex items-center justify-between text-sm font-medium transition-colors py-1.5 ${
                    isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => {
                    setActiveSection(link.href)
                    setIsOpen(false)
                  }}
                >
                  <span>{link.label}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                </a>
              )
            })}

            <div className="flex flex-col gap-3 pt-4 border-t border-white/10 mt-2">
              <Link
                href="/login"
                className="text-center py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-white py-2.5 text-center text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Sign Up
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
