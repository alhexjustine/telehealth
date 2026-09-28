import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() appointmentId!: string;
  @ApiProperty({ description: "The sender's user ID; compare against the viewer's own ID to align the thread" })
  senderId!: string;
  @ApiProperty() body!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
}

export class MessageListResponseDto {
  @ApiProperty({ type: [MessageResponseDto] }) items!: MessageResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}
