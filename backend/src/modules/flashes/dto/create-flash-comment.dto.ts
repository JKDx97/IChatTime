import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateFlashCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}
