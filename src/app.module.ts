import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ConfigModule as AppConfigModule } from './config/config.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ContabilidadModule } from './contabilidad/contabilidad.module.js';
import { CajasModule } from './cajas/cajas.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { User } from './auth/entities/user.entity.js';
import { PlanDeCuenta } from './contabilidad/entities/plan-de-cuenta.entity.js';
import { AsientoContable } from './contabilidad/entities/asiento-contable.entity.js';
import { DetalleAsiento } from './contabilidad/entities/detalle-asiento.entity.js';
import { CuentaFinanciera } from './cajas/entities/cuenta-financiera.entity.js';
import { Transaccion } from './cajas/entities/transaccion.entity.js';

@Module({
  imports: [
    // Configuración global
    AppConfigModule,

    // Base de datos TypeORM con configuración asíncrona
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.name'),
        entities: [User, PlanDeCuenta, AsientoContable, DetalleAsiento, CuentaFinanciera, Transaccion],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging'),
        ssl: configService.get<string>('database.host') !== 'localhost' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),

    // Módulos de la aplicación
    AuthModule,
    ContabilidadModule,
    CajasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}