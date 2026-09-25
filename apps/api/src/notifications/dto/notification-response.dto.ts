import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '../../generated/prisma/enums.js';

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: NotificationType }) type!: NotificationType;
  @ApiProperty() title!: string;
  @ApiProperty() body!: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Structured event data (startsAt, previousStartsAt, counterpartName, reason) for the viewer to format.',
  })
  data!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: String, description: "A link to the appointment in the recipient's role area" })
  link!: string | null;
  @ApiProperty({ nullable: true, type: String }) appointmentId!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) readAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] }) items!: NotificationResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() unreadCount!: number;
}

export class UnreadCountResponseDto {
  @ApiProperty() unreadCount!: number;
}
