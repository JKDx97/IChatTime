import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  displayName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9._]+$/, {
    message: 'El usuario solo puede contener letras, números, puntos y guiones bajos',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @Length(0, 300)
  bio?: string;
}
