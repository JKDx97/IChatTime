import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const databaseUrl = config.get<string>('DATABASE_URL');
  const sslEnabled = (config.get<string>('DB_SSL') ?? (isProd ? 'true' : 'false')) === 'true';

  return {
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: config.get<string>('DB_HOST'),
          port: parseInt(config.get<string>('DB_PORT') ?? '5432', 10),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASS'),
          database: config.get<string>('DB_NAME'),
        }),
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    autoLoadEntities: true,
    synchronize: !isProd,
    migrations: isProd ? ['dist/migrations/*.js'] : [],
    migrationsRun: isProd,
  };
};
