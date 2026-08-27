const CHART_HEIGHT = 56;
const CHART_PADDING_Y = 6;
const POINT_GAP = 22;

// Shared by step-gauge.tsx and health-metric-card.tsx — same hand-rolled
// polyline technique as exercise-trend-chart.tsx, just generic over
// whatever daily values are passed in rather than exercise weight.
export function HealthTrendLine({ points }: { points: { date: string; value: number }[] }) {
  if (points.length === 0) {
    return <p className="text-sm text-card-light-muted">Not enough data yet.</p>;
  }
  if (points.length === 1) {
    return <p className="text-sm text-card-light-muted">Only one day logged so far — check back once there&apos;s more to trend.</p>;
  }

  const width = (points.length - 1) * POINT_GAP;
  const maxValue = Math.max(...points.map((p) => p.value));
  const minValue = Math.min(...points.map((p) => p.value));
  const range = maxValue - minValue || 1;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const y = (value: number) => CHART_PADDING_Y + plotHeight - ((value - minValue) / range) * plotHeight;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * POINT_GAP} ${y(p.value)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="w-full" style={{ height: CHART_HEIGHT }}>
      <path d={pathD} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="stroke-card-light-foreground" />
      {points.map((p, i) => (
        <circle key={p.date} cx={i * POINT_GAP} cy={y(p.value)} r={i === 0 || i === points.length - 1 ? 3.5 : 2} className="fill-card-light-foreground" />
      ))}
    </svg>
  );
}
