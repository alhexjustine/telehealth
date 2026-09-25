export interface TrendBucket {
  date: string;
  count: number;
  isToday: boolean;
}

const WIDTH = 580;
const CHART_HEIGHT = 120;
const AXIS_HEIGHT = 16;
const BAR_GAP = 2;

/**
 * A plain, dependency-free SVG bar chart of appointments per day (design.md's
 * "no chart library"). Each bar carries an `aria-hidden` visual + a native
 * `<title>` tooltip; the numbers themselves are given to assistive tech via
 * a visually hidden table below the chart, not by parsing the SVG.
 */
export function TrendChart({ buckets }: { buckets: TrendBucket[] }) {
  const barWidth = buckets.length > 0 ? (WIDTH - BAR_GAP * (buckets.length - 1)) / buckets.length : 0;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const todayIndex = buckets.findIndex((b) => b.isToday);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${CHART_HEIGHT + AXIS_HEIGHT}`}
        role="img"
        aria-label="Appointments per day, from 14 days ago through 14 days from now"
        className="h-40 w-full"
      >
        {buckets.map((bucket, index) => {
          const barHeight = bucket.count > 0 ? Math.max((bucket.count / maxCount) * CHART_HEIGHT, 2) : 0;
          const x = index * (barWidth + BAR_GAP);
          const y = CHART_HEIGHT - barHeight;
          return (
            <rect
              key={bucket.date}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={bucket.isToday ? 'var(--color-primary)' : 'var(--color-muted-foreground)'}
              opacity={bucket.isToday ? 1 : 0.55}
            >
              <title>{`${bucket.date}${bucket.isToday ? ' (today)' : ''}: ${bucket.count} appointment${bucket.count === 1 ? '' : 's'}`}</title>
            </rect>
          );
        })}
        <line x1={0} y1={CHART_HEIGHT} x2={WIDTH} y2={CHART_HEIGHT} stroke="var(--color-border)" strokeWidth={1} />
        {todayIndex >= 0 && (
          <line
            x1={todayIndex * (barWidth + BAR_GAP) + barWidth / 2}
            y1={CHART_HEIGHT + 3}
            x2={todayIndex * (barWidth + BAR_GAP) + barWidth / 2}
            y2={CHART_HEIGHT + 11}
            stroke="var(--color-primary)"
            strokeWidth={2}
          />
        )}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
        <span>{buckets[0]?.date}</span>
        <span>Today</span>
        <span>{buckets[buckets.length - 1]?.date}</span>
      </div>
      <table className="sr-only">
        <caption>Appointments per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Appointments</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.date}>
              <td>
                {bucket.date}
                {bucket.isToday ? ' (today)' : ''}
              </td>
              <td>{bucket.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
