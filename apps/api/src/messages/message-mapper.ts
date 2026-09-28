import type { Message } from '../generated/prisma/client.js';
import type { MessageResponseDto } from './dto/message-response.dto.js';

export function toMessageResponseDto(message: Message): MessageResponseDto {
  return {
    id: message.id,
    appointmentId: message.appointmentId,
    senderId: message.senderId,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}
