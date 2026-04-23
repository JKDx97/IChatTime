import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFlashDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
