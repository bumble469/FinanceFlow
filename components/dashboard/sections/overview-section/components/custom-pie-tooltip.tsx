export function CustomPieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.payload.hex }} />
        <span className="text-muted-foreground">{p.name}:</span>
        <span className="font-mono font-medium text-foreground">{p.value}</span>
      </div>
    </div>
  );
}