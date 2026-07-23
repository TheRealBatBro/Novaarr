export type DonutSegment = { label: string; value: number; percent: number; color: string };

export function TracearrDonut({ segments }: { segments: DonutSegment[] }) {
  const visible = segments.filter((s) => s.value > 0);
  const size = 140;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-muted" strokeWidth={stroke} />
        {visible.map((s, i) => {
          const dash = (s.percent / 100) * circumference;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="flex flex-col gap-2">
        {visible.length === 0 && <p className="text-sm text-muted-foreground">No playback data.</p>}
        {visible.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold leading-tight">
                {s.percent}% <span className="text-xs font-normal text-muted-foreground">({s.value})</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TracearrHorizontalBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 truncate text-muted-foreground">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
