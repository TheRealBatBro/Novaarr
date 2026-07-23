import { useState } from 'react';

export type ChartSeries = { name: string; color: string; data: number[] };

const WIDTH = 600;
const HEIGHT = 220;
const PAD_LEFT = 28;
const PAD_BOTTOM = 20;
const PAD_TOP = 10;

function Legend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {series.map((s) => (
        <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  );
}

export function TautulliAreaChart({ categories, series }: { categories: string[]; series: ChartSeries[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const n = categories.length;
  const plotW = WIDTH - PAD_LEFT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxV = Math.max(1, ...series.flatMap((s) => s.data));
  const xFor = (i: number) => PAD_LEFT + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const yFor = (v: number) => PAD_TOP + plotH - (v / maxV) * plotH;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round(((relX - PAD_LEFT) / plotW) * (n - 1));
    setHoverIndex(Math.min(n - 1, Math.max(0, i)));
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-auto w-full cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {gridLines.map((g) => (
          <line
            key={g}
            x1={PAD_LEFT}
            x2={WIDTH}
            y1={PAD_TOP + plotH * (1 - g)}
            y2={PAD_TOP + plotH * (1 - g)}
            stroke="currentColor"
            className="text-border"
            strokeWidth={1}
          />
        ))}
        {gridLines.map((g) => (
          <text key={g} x={0} y={PAD_TOP + plotH * (1 - g) + 3} className="fill-muted-foreground text-[9px]">
            {Math.round(maxV * g)}
          </text>
        ))}
        {categories.map(
          (c, i) =>
            i % labelStep === 0 && (
              <text key={i} x={xFor(i)} y={HEIGHT - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {c.slice(5)}
              </text>
            ),
        )}
        {series.map((s) => {
          const line = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`).join(' ');
          const area = `${line} L ${xFor(n - 1)} ${PAD_TOP + plotH} L ${xFor(0)} ${PAD_TOP + plotH} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={s.color} opacity={0.12} stroke="none" />
              <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
        {hoverIndex !== null && (
          <line x1={xFor(hoverIndex)} x2={xFor(hoverIndex)} y1={PAD_TOP} y2={PAD_TOP + plotH} stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.4} strokeWidth={1} />
        )}
        {hoverIndex !== null &&
          series.map((s) => <circle key={s.name} cx={xFor(hoverIndex)} cy={yFor(s.data[hoverIndex])} r={3} fill={s.color} />)}
      </svg>
      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%`, top: 0 }}
        >
          <p className="mb-0.5 font-medium">{categories[hoverIndex]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}: {s.data[hoverIndex]}
            </p>
          ))}
        </div>
      )}
      <Legend series={series} />
    </div>
  );
}

export function TautulliStackedBarChart({ categories, series }: { categories: string[]; series: ChartSeries[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const n = categories.length;
  const plotW = WIDTH - PAD_LEFT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.data[i] || 0), 0));
  const maxV = Math.max(1, ...totals);
  const bandW = plotW / n;
  const barW = Math.min(28, bandW * 0.6);
  const xFor = (i: number) => PAD_LEFT + i * bandW + bandW / 2;
  const yScale = (v: number) => (v / maxV) * plotH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];
  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-auto w-full cursor-crosshair" onMouseLeave={() => setHoverIndex(null)}>
        {gridLines.map((g) => (
          <line key={g} x1={PAD_LEFT} x2={WIDTH} y1={PAD_TOP + plotH * (1 - g)} y2={PAD_TOP + plotH * (1 - g)} stroke="currentColor" className="text-border" strokeWidth={1} />
        ))}
        {gridLines.map((g) => (
          <text key={g} x={0} y={PAD_TOP + plotH * (1 - g) + 3} className="fill-muted-foreground text-[9px]">
            {Math.round(maxV * g)}
          </text>
        ))}
        {categories.map(
          (c, i) =>
            i % labelStep === 0 && (
              <text key={i} x={xFor(i)} y={HEIGHT - 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
                {c.length > 6 ? c.slice(0, 3) : c}
              </text>
            ),
        )}
        {categories.map((_, i) => {
          let yCursor = PAD_TOP + plotH;
          return (
            <g key={i} onMouseEnter={() => setHoverIndex(i)}>
              <rect x={xFor(i) - barW / 2 - 3} y={PAD_TOP} width={barW + 6} height={plotH} fill="transparent" />
              {series.map((s) => {
                const h = yScale(s.data[i] || 0);
                yCursor -= h;
                return <rect key={s.name} x={xFor(i) - barW / 2} y={yCursor} width={barW} height={h} fill={s.color} rx={2} />;
              })}
            </g>
          );
        })}
      </svg>
      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          style={{ left: `${(xFor(hoverIndex) / WIDTH) * 100}%`, top: 0 }}
        >
          <p className="mb-0.5 font-medium">{categories[hoverIndex]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}: {s.data[hoverIndex]}
            </p>
          ))}
        </div>
      )}
      <Legend series={series} />
    </div>
  );
}
