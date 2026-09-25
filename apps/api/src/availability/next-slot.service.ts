import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateSlots, type Slot } from './slot-generator.js';

const DEFAULT_HORIZON_DAYS = 14;

export interface DoctorSlotInput {
  userId: string;
  timezone: string;
  consultationMinutes: number;
}

/**
 * Batches slot computation across many doctors: two queries total (rules,
 * exceptions) regardless of how many doctors are candidates, then runs the
 * pure `generateSlots` per doctor. Used by search's "next available slot"
 * column and availability filter, and by matching's doctor ranking — see
 * design.md's "Next available slot".
 */
@Injectable()
export class NextSlotService {
  constructor(private readonly prisma: PrismaService) {}

  /** All slots for each doctor in `[from, to)`. */
  async slotsFor(
    doctors: DoctorSlotInput[],
    from: Date,
    to: Date,
    now: Date,
  ): Promise<Map<string, Slot[]>> {
    const result = new Map<string, Slot[]>();
    if (doctors.length === 0) return result;

    const doctorIds = doctors.map((doctor) => doctor.userId);
    const [rules, exceptions] = await Promise.all([
      this.prisma.availabilityRule.findMany({ where: { doctorId: { in: doctorIds } } }),
      this.prisma.availabilityException.findMany({
        where: { doctorId: { in: doctorIds }, startsAt: { lt: to }, endsAt: { gt: from } },
      }),
    ]);

    const rulesByDoctor = groupBy(rules, (rule) => rule.doctorId);
    const exceptionsByDoctor = groupBy(exceptions, (exception) => exception.doctorId);

    for (const doctor of doctors) {
      const slots = generateSlots({
        timezone: doctor.timezone,
        consultationMinutes: doctor.consultationMinutes,
        rules: rulesByDoctor.get(doctor.userId) ?? [],
        exceptions: exceptionsByDoctor.get(doctor.userId) ?? [],
        from,
        to,
        now,
      });
      result.set(doctor.userId, slots);
    }
    return result;
  }

  /** Each doctor's soonest slot within `horizonDays` of `now`, or `null` when they have none. */
  async nextSlotFor(
    doctors: DoctorSlotInput[],
    now: Date,
    horizonDays = DEFAULT_HORIZON_DAYS,
  ): Promise<Map<string, Date | null>> {
    const to = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const slotsByDoctor = await this.slotsFor(doctors, now, to, now);

    const result = new Map<string, Date | null>();
    for (const doctor of doctors) {
      const slots = slotsByDoctor.get(doctor.userId) ?? [];
      result.set(doctor.userId, slots[0]?.start ?? null);
    }
    return result;
  }
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
