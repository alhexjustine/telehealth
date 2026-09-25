import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';

export interface StatTileProps {
  label: string;
  value: number | string;
  sublabel?: string;
  /** When set, the tile is a link to a filtered work-queue page. */
  href?: string;
}

/** A dashboard stat tile; renders as a link when `href` is given (e.g. pending reviews, invalid bookings). */
export function StatTile({ label, value, sublabel, href }: StatTileProps) {
  const content = (
    <CardContent className="flex flex-col gap-1 pt-6">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
      {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
    </CardContent>
  );

  if (href) {
    return (
      <Link to={href} aria-label={`${label}: ${value}`}>
        <Card className="transition-colors hover:bg-accent/50">{content}</Card>
      </Link>
    );
  }

  return <Card>{content}</Card>;
}
