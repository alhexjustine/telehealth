import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export const MAX_REVIEW_COMMENT_LENGTH = 1000;

export class SubmitReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: MAX_REVIEW_COMMENT_LENGTH })
  @IsOptional()
  @IsString()
  @Length(0, MAX_REVIEW_COMMENT_LENGTH)
  comment?: string;
}
