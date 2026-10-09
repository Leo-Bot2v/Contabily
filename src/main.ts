import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Configuración global
  const port = configService.get('app.port') ?? 3000;
  const apiPrefix = configService.get('app.apiPrefix') ?? 'api/v1';
  const frontendUrl = configService.get('app.frontendUrl') ?? 'http://localhost:5173';
  const nodeEnv = configService.get('app.nodeEnv') ?? 'development';

  // Prefijo global para todas las rutas (sin versión)
  app.setGlobalPrefix('api');

  // Versioning de API
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // CORS
  app.enableCors({
    origin: frontendUrl,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: nodeEnv === 'production',
    }),
  );

  // Manejo de shutdown graceful
  const signals = ['SIGTERM', 'SIGINT'];
  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n${signal} recibido. Cerrando aplicación...`);
      await app.close();
      process.exit(0);
    });
  }

  await app.listen(port);
  console.log(`\n🚀 Servidor corriendo en:`);
  console.log(`   Local:   http://localhost:${port}/${apiPrefix}`);
  console.log(`   Modo:    ${nodeEnv}`);
  console.log(`   Auth:    ${configService.get('supabase.url') ? 'Supabase' : 'Local (PostgreSQL)'}`);
  console.log(`   DB:      ${configService.get('database.host')}:${configService.get('database.port')}/${configService.get('database.name')}\n`);
}

bootstrap();