import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { QueryState } from '@/components/query-state';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useAppointmentMessages, useSendMessage } from '@/lib/messages/use-messages';
import { useLiveMessages } from '@/lib/messages/use-live-messages';

type AppointmentThreadStatus = 'BOOKED' | 'CANCELLED' | 'COMPLETED' | 'NOT_HELD';

/**
 * Shared between the patient and doctor appointment-detail pages, and the
 * consultation workspace (see `add-consultation-messaging`'s "Message thread
 * in the web app"). Sending is only offered while `BOOKED`; the thread stays
 * visible read-only once `COMPLETED`, and the whole card renders nothing for
 * a cancelled or not-held appointment — mirroring the API's own access
 * window. `bare` is turned on when the surrounding UI already provides the
 * card chrome and the "Messages" label (the workspace's own tab), so this
 * renders just its content, not a second nested card.
 */
export function AppointmentMessagesCard({
  appointmentId,
  status,
  counterpartName,
  bare = false,
}: {
  appointmentId: string;
  status: AppointmentThreadStatus;
  counterpartName: string;
  bare?: boolean;
}) {
  const showThread = status === 'BOOKED' || status === 'COMPLETED';
  const canSend = status === 'BOOKED';

  const currentUser = useCurrentUser();
  const messages = useAppointmentMessages(showThread ? appointmentId : undefined);
  const sendMessage = useSendMessage(appointmentId);
  const [draft, setDraft] = useState('');
  useLiveMessages(showThread ? appointmentId : undefined);

  if (!showThread) {
    return null;
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    await sendMessage.mutateAsync({ body });
    setDraft('');
  }

  const content = (
    <div className="flex flex-col gap-3">
      <QueryState
        query={messages}
        label="messages"
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-sm text-muted-foreground">No messages yet.</p>}
      >
        {(data) => (
          <div className="flex flex-col gap-2">
            {data.items.map((message) => {
              const isMine = message.senderId === currentUser.data?.id;
              return (
                <div
                  key={message.id}
                  className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                    isMine ? 'self-end bg-primary text-primary-foreground' : 'self-start bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className={`mt-1 text-xs ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                    {isMine ? 'You' : counterpartName} ·{' '}
                    {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </QueryState>

      {canSend ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              aria-label="Write a message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSend();
              }}
            />
            <Button
              type="button"
              size="icon"
              aria-label="Send message"
              disabled={draft.trim().length === 0 || sendMessage.isPending}
              onClick={() => void handleSend()}
            >
              <Send className="size-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Messages are part of this consultation's permanent record.</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This conversation is now read-only.</p>
      )}
    </div>
  );

  if (bare) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
