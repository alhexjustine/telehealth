import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiPaths } from 'api-client';
import { useRealtimeSocket } from '@/lib/realtime/realtime-provider';

type WorkspaceDto =
  ApiPaths['/consultations/{appointmentId}']['get']['responses'][200]['content']['application/json'];
type SessionStateDto = WorkspaceDto['session'];

export interface ConsultationPresence {
  patientPresent: boolean;
  doctorPresent: boolean;
}

const NO_PRESENCE: ConsultationPresence = { patientPresent: false, doctorPresent: false };
const RETRY_DELAY_MS = 250;
const MAX_SUBSCRIBE_ATTEMPTS = 20; // ~5s, well past a slow session lookup

function workspaceKey(appointmentId: string) {
  return ['consultations', 'workspace', appointmentId] as const;
}

/**
 * Subscribes to one appointment's consultation workspace over the shared
 * realtime socket: applies `consultation:state` pushes directly onto the
 * cached workspace query (no refetch — "without reloading", per the
 * "Patient sees the session start" requirement) and tracks
 * `consultation:presence`. Retries the subscribe on `{ok: false}` — the
 * socket can still be finishing its own async authentication when this
 * mounts (see the Gotcha in CLAUDE.md on `RealtimeGateway`'s auth race).
 */
export function useConsultationPresence(appointmentId: string | undefined): ConsultationPresence {
  const socket = useRealtimeSocket();
  const queryClient = useQueryClient();
  const [presence, setPresence] = useState<ConsultationPresence>(NO_PRESENCE);

  useEffect(() => {
    // Nothing to subscribe to yet; `presence` simply stays at its last known
    // value (initially `NO_PRESENCE`) until both are available.
    if (!socket || !appointmentId) {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const handleState = (payload: SessionStateDto) => {
      queryClient.setQueryData<WorkspaceDto>(workspaceKey(appointmentId), (old) =>
        old ? { ...old, session: payload } : old,
      );
    };
    const handlePresence = (payload: ConsultationPresence) => setPresence(payload);

    socket.on('consultation:state', handleState);
    socket.on('consultation:presence', handlePresence);

    async function subscribeWithRetry() {
      for (let attempt = 0; attempt < MAX_SUBSCRIBE_ATTEMPTS; attempt++) {
        if (cancelled) return;
        const ack = (await socket!.emitWithAck('consultation:subscribe', { appointmentId })) as {
          ok: boolean;
          presence?: ConsultationPresence;
        };
        if (ack?.ok) {
          if (ack.presence && !cancelled) setPresence(ack.presence);
          return;
        }
        await new Promise((resolve) => {
          retryTimer = setTimeout(resolve, RETRY_DELAY_MS);
        });
      }
    }
    void subscribeWithRetry();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.off('consultation:state', handleState);
      socket.off('consultation:presence', handlePresence);
      socket.emit('consultation:unsubscribe', { appointmentId });
    };
  }, [socket, appointmentId, queryClient]);

  return presence;
}
