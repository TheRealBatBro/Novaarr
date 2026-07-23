import { useState } from 'react';

export type SparklinePoint = { t: number; v: number };

const WIDTH = 300;

export function Sparkline({
  data,
  color,
  height = 56,
  formatValue,
}: {
  data: SparklinePoint[];
  color: string;
  height?: number;
  formatValue: (v: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">
        Collecting data…
      </div>
    );
  }

  const maxV = Math.max(...data.map((d) => d.v), 1);
  const pad = 4;
  const xFor = (i: number) => (i / (data.length - 1)) * WIDTH;
  const yFor = (v: number) => height - pad - (v / maxV) * (height - pad * 2);

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d.v)}`).join(' ');
  const areaPath = `${linePath} L ${WIDTH} ${height} L 0 ${height} Z`;
  const last = data[data.length - 1];

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const i = Math.round((relX / WIDTH) * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, i)));
  }

  const hover = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <path d={areaPath} fill={color} opacity={0.15} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover && (
          <line x1={xFor(hoverIndex!)} x2={xFor(hoverIndex!)} y1={0} y2={height} stroke={color} strokeOpacity={0.25} strokeWidth={1} />
        )}
        <circle cx={xFor(data.length - 1)} cy={yFor(last.v)} r={3} fill={color} />
        {hover && <circle cx={xFor(hoverIndex!)} cy={yFor(hover.v)} r={3} fill={color} />}
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md"
          style={{ left: `${(xFor(hoverIndex!) / WIDTH) * 100}%`, top: 0 }}
        >
          {formatValue(hover.v)}
        </div>
      )}
    </div>
  );
}
