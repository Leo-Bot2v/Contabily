import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { ConfigModule as AppConfigModule } from './config/config.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EmpresaModule } from './empresa/empresa.module.js';
import { ProductoModule } from './producto/producto.module.js';
import { ContabilidadModule } from './contabilidad/contabilidad.module.js';
import { CajasModule } from './cajas/cajas.module.js';
import { TipoCambioModule } from './tipo-cambio/tipo-cambio.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { User } from './auth/entities/user.entity.js';
import { Empresa } from './empresa/entities/empresa.entity.js';
import { Producto } from './producto/entities/producto.entity.js';
import { ProductoVariante } from './producto/entities/producto-variante.entity.js';
import { Categoria } from './producto/entities/categoria.entity.js';
import { Coleccion } from './producto/entities/coleccion.entity.js';
import { MovimientoInventario } from './producto/entities/movimiento-inventario.entity.js';
import { PlanDeCuenta } from './contabilidad/entities/plan-de-cuenta.entity.js';
import { AsientoContable } from './contabilidad/entities/asiento-contable.entity.js';
import { DetalleAsiento } from './contabilidad/entities/detalle-asiento.entity.js';
import { CuentaFinanciera } from './cajas/entities/cuenta-financiera.entity.js';
import { Transaccion } from './cajas/entities/transaccion.entity.js';
import { TipoCambio } from './tipo-cambio/entities/tipo-cambio.entity.js';

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
        entities: [
          User,
          Empresa,
          Producto,
          ProductoVariante,
          Categoria,
          Coleccion,
          MovimientoInventario,
          PlanDeCuenta,
          AsientoContable,
          DetalleAsiento,
          CuentaFinanciera,
          Transaccion,
          TipoCambio,
        ],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging'),
        ssl: configService.get<string>('database.host') !== 'localhost' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),

    // Programación de tareas (cron de tipo de cambio)
    ScheduleModule.forRoot(),

    // Módulos de la aplicación
    AuthModule,
    EmpresaModule,
    ProductoModule,
    ContabilidadModule,
    CajasModule,
    TipoCambioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
