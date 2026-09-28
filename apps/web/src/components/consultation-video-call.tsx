import { JitsiMeeting } from '@jitsi/react-sdk';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConsultationVideoCallProps {
  roomId: string;
  displayName: string;
  email: string;
}

/**
 * Embeds a live video call via Jitsi's public `meet.jit.si` server — a
 * documented exception to this project's standalone-runtime rule, made for
 * prototype purposes only (see the `consultation-session` spec's "Video"
 * requirement and the `add-consultation-video` change's proposal/design).
 */
export function ConsultationVideoCall({ roomId, displayName, email }: ConsultationVideoCallProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Video call</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[560px] overflow-hidden rounded-lg border border-input">
          <JitsiMeeting
            domain="meet.jit.si"
            roomName={roomId}
            userInfo={{ displayName, email }}
            configOverwrite={{ prejoinConfig: { enabled: false }, prejoinPageEnabled: false }}
            getIFrameRef={(iframeRef) => {
              iframeRef.style.height = '100%';
              iframeRef.style.width = '100%';
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
