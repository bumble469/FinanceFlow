"use client";

import { useCountUp } from "../hooks/use-count-up";

export function HealthGauge({ score }: { score: number }) {
  const animatedScore = useCountUp(score, 1000);

  const size = 200;
  const cx = size / 2;
  const cy = size / 2 + 20;
  const R = 80;
  const strokeW = 14;

  const toXY = (angle: number) => ({
    x: cx + R * Math.cos(angle),
    y: cy - R * Math.sin(angle),
  });

  const arcPath = (from: number, to: number) => {
    const s = toXY(from);
    const e = toXY(to);
    return `M ${s.x} ${s.y} A ${R} ${R} 0 0 1 ${e.x} ${e.y}`;
  };

  const progressEnd = Math.PI - (animatedScore / 100) * Math.PI;

  const isHealthy = score >= 75;
  const isWarning = score >= 50 && score < 75;
  const label = isHealthy ? "Excellent" : isWarning ? "Moderate" : "At Risk";

  const gradId = "hg-grad";
  const glowColor = isHealthy ? "rgba(52,211,153,0.15)" : isWarning ? "rgba(251,191,36,0.15)" : "rgba(248,113,113,0.15)";
  const arcColor = isHealthy ? "url(#hg-grad)" : isWarning ? "#fbbf24" : "#f87171";
  const scoreColor = isHealthy ? "#34d399" : isWarning ? "#fbbf24" : "#f87171";

  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);

  return (
    <div className="relative flex flex-col items-center w-full">
      <div
        className="pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 120, height: 80, top: "30%", left: "50%", transform: "translateX(-50%)", background: glowColor }}
      />

      <svg width={size} height={size / 2 + 36} viewBox={`0 0 ${size} ${size / 2 + 36}`} overflow="visible">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>

        <path d={arcPath(Math.PI, 0)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} strokeLinecap="round" />

        {ticks.map((t) => {
          const angle = Math.PI - (t / 100) * Math.PI;
          const inner = { x: cx + (R - strokeW / 2 - 2) * Math.cos(angle), y: cy - (R - strokeW / 2 - 2) * Math.sin(angle) };
          const outer = { x: cx + (R + strokeW / 2 + 2) * Math.cos(angle), y: cy - (R + strokeW / 2 + 2) * Math.sin(angle) };
          return (
            <line key={t} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.12)" strokeWidth={t % 50 === 0 ? 2 : 1} />
          );
        })}

        {animatedScore > 0 && (
          <path
            d={arcPath(Math.PI, progressEnd)}
            fill="none" stroke={arcColor} strokeWidth={strokeW} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${scoreColor}66)` }}
          />
        )}

        {animatedScore > 0 && (() => {
          const tip = toXY(progressEnd);
          return <circle cx={tip.x} cy={tip.y} r={5} fill={scoreColor} style={{ filter: `drop-shadow(0 0 4px ${scoreColor})` }} />;
        })()}

        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="28" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill={scoreColor}>
          {Math.round(animatedScore)}
        </text>
        <text x={cx} y={cy + 25} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.45)" fontFamily="var(--font-sans, sans-serif)">
          {label}
        </text>
      </svg>

      <div className="flex w-full justify-between px-4 mt-3" style={{ maxWidth: size }}>
        <span className="text-[10px] text-muted-foreground">0</span>
        <span className="text-[10px] text-muted-foreground font-medium" style={{ color: scoreColor }}>Health Score</span>
        <span className="text-[10px] text-muted-foreground">100</span>
      </div>
    </div>
  );
}
