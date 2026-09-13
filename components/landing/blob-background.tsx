export function BlobBackground({ variant = 'default' }: { variant?: 'default' | 'reverse' | 'subtle' }) {
  const opacity = variant === 'subtle' ? 'opacity-40' : 'opacity-70'
  return (
    <div className={`absolute inset-0 -z-10 overflow-hidden ${opacity}`}>
      <div
        className="absolute -top-1/3 left-1/2 -translate-x-1/2 h-[60rem] w-[60rem] rounded-full blur-[160px]"
        style={{
          background:
            variant === 'reverse'
              ? 'radial-gradient(circle at 30% 30%, var(--chart-2) 0%, transparent 60%)'
              : 'radial-gradient(circle at 30% 30%, var(--primary) 0%, transparent 60%)',
          opacity: 0.18,
        }}
      />
      <div
        className="absolute top-1/4 -right-1/4 h-[40rem] w-[40rem] rounded-full blur-[140px]"
        style={{
          background: 'radial-gradient(circle, var(--chart-2) 0%, transparent 65%)',
          opacity: 0.14,
        }}
      />
      <div
        className="absolute -bottom-1/4 -left-1/4 h-[36rem] w-[36rem] rounded-full blur-[140px]"
        style={{
          background: 'radial-gradient(circle, var(--chart-5) 0%, transparent 65%)',
          opacity: 0.1,
        }}
      />
    </div>
  )
}