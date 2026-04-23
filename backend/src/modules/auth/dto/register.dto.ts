import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'username: letras, números y _' })
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 72)
  password: string;

  @IsString()
  @Length(1, 60)
  displayName: string;
}
