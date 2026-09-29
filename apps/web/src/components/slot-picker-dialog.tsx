import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDoctorSlots } from '@/lib/availability/use-availability';
import { formatSlotTimeOnly, groupSlotsByLocalDate } from '@/lib/discovery/slot-grouping';

/**
 * A dialog listing a doctor's open slots over the next `horizonDays`, grouped by
 * day, that calls `onPick` with the chosen slot start. Used for the doctor's
 * "Reschedule" and "Book again" actions; the caller owns the mutation.
 */
export function SlotPickerDialog({
  open,
  doctorId,
  title,
  description,
  horizonDays = 14,
  pending = false,
  onPick,
  onClose,
}: {
  open: boolean;
  doctorId: string | undefined;
  title: string;
  description: string;
  horizonDays?: number;
  pending?: boolean;
  onPick: (start: string) => void;
  onClose: () => void;
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const range = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [horizonDays]);
  const slots = useDoctorSlots(open ? doctorId : undefined, range.from, range.to);
  const dayGroups = useMemo(
    () => groupSlotsByLocalDate(slots.data ?? [], timezone),
    [slots.data, timezone],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {slots.isPending && <p className="text-muted-foreground">Loading…</p>}
          {slots.data && dayGroups.length === 0 && (
            <p className="text-muted-foreground">
              No times are available in the next {horizonDays} days.
            </p>
          )}
          {dayGroups.map((group) => (
            <div key={group.dateKey}>
              <p className="mb-1 text-sm font-medium text-muted-foreground">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.slots.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => onPick(slot.start)}
                  >
                    {formatSlotTimeOnly(slot.start, timezone)}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
