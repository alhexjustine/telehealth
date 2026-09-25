import {
  Building2,
  CalendarDays,
  ClipboardList,
  EyeOff,
  FileCheck2,
  FileText,
  Lock,
  Search,
  Server,
  ShieldCheck,
  UserPlus,
  Users,
  Wand2,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react';
import type { LandingIcon } from '@/content/landing';

const ICONS: Record<LandingIcon, LucideIcon> = {
  search: Search,
  match: Wand2,
  calendar: CalendarDays,
  workspace: MonitorSmartphone,
  records: FileText,
  'user-plus': UserPlus,
  shield: ShieldCheck,
  clipboard: ClipboardList,
  lock: Lock,
  server: Server,
  users: Users,
  'eye-off': EyeOff,
  'file-check': FileCheck2,
  building: Building2,
};

/** Resolves a `LandingIcon` content key to its `lucide-react` component. */
export function LandingIconGlyph({
  icon,
  className,
}: {
  icon: LandingIcon;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden="true" />;
}
