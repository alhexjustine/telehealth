import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeSocket } from '@/lib/realtime/realtime-provider';
import { appendMessage, type MessageDto } from './use-messages';

const RETRY_DELAY_MS = 250;
const MAX_SUBSCRIBE_ATTEMPTS = 20; // ~5s, well past a slow lookup — see use-consultation-socket.ts

/**
 * Subscribes to `message:new` for one appointment over the shared realtime
 * socket, appending each arrival directly onto the cached thread (no
 * refetch). Reuses `consultation:subscribe`'s appointment room rather than a
 * dedicated event — see design.md's "Delivery: reuse consultation:subscribe's
 * existing appointment room, add one new event". Only ever call this while
 * the message thread is actually shown (the appointment is `BOOKED` or
 * `COMPLETED`); a cancelled/not-held appointment has no thread to subscribe.
 */
export function useLiveMessages(appointmentId: string | undefined): void {
  const socket = useRealtimeSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !appointmentId) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleMessage = (payload: MessageDto) => appendMessage(queryClient, appointmentId, payload);
    socket.on('message:new', handleMessage);

    async function subscribeWithRetry() {
      for (let attempt = 0; attempt < MAX_SUBSCRIBE_ATTEMPTS; attempt++) {
        if (cancelled) return;
        const ack = (await socket!.emitWithAck('consultation:subscribe', { appointmentId })) as { ok: boolean };
        if (ack?.ok || cancelled) return;
        await new Promise((resolve) => {
          retryTimer = setTimeout(resolve, RETRY_DELAY_MS);
        });
      }
    }
    void subscribeWithRetry();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.off('message:new', handleMessage);
      socket.emit('consultation:unsubscribe', { appointmentId });
    };
  }, [socket, appointmentId, queryClient]);
}
