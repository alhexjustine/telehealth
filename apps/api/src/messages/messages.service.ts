import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationType } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { withNotifications } from '../notifications/with-notifications.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { appointmentRoom } from '../realtime/rooms.js';
import { MessageAccessPolicy, type MessagingActor } from './message-access-policy.js';
import { toMessageResponseDto } from './message-mapper.js';
import type { MessageListResponseDto, MessageResponseDto } from './dto/message-response.dto.js';

const WITH_PARTICIPANTS = {
  patient: true,
  doctor: true,
} satisfies Prisma.AppointmentInclude;

type AppointmentWithParticipants = Prisma.AppointmentGetPayload<{ include: typeof WITH_PARTICIPANTS }>;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async send(actor: MessagingActor, appointmentId: string, body: string): Promise<MessageResponseDto> {
    const appointment = await this.loadAppointment(appointmentId);
    MessageAccessPolicy.assertCanSend(actor, appointment);

    const isPatientSender = actor.id === appointment.patientId;
    const recipientId = isPatientSender ? appointment.doctorId : appointment.patientId;
    const senderDisplayName = isPatientSender
      ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
      : `Dr. ${appointment.doctor.firstName} ${appointment.doctor.lastName}`;
    // The recipient is whichever role the sender is not.
    const recipientLink = isPatientSender
      ? `/doctor/appointments/${appointmentId}`
      : `/patient/appointments/${appointmentId}`;

    const { result: message, notifications } = await withNotifications(
      this.prisma,
      this.notificationsService,
      async (tx, notify) => {
        const created = await tx.message.create({
          data: { appointmentId, senderId: actor.id, body },
        });
        await notify([
          {
            userId: recipientId,
            type: NotificationType.NEW_MESSAGE,
            title: 'New message',
            body: `New message from ${senderDisplayName}`,
            link: recipientLink,
            appointmentId,
          },
        ]);
        return created;
      },
    );

    await this.notificationsService.publish(notifications);
    const dto = toMessageResponseDto(message);
    this.realtimeGateway.emitToRoom(appointmentRoom(appointmentId), 'message:new', dto);
    return dto;
  }

  async list(
    actor: MessagingActor,
    appointmentId: string,
    page: number,
    pageSize: number,
  ): Promise<MessageListResponseDto> {
    const appointment = await this.loadAppointment(appointmentId);
    MessageAccessPolicy.assertCanRead(actor, appointment);

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { appointmentId },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.message.count({ where: { appointmentId } }),
    ]);

    return { items: items.map(toMessageResponseDto), total, page, pageSize };
  }

  private async loadAppointment(appointmentId: string): Promise<AppointmentWithParticipants> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: WITH_PARTICIPANTS,
    });
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }
}
