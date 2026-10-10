import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ConfigModule as AppConfigModule } from './config/config.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EmpresaModule } from './empresa/empresa.module.js';
import { ProductoModule } from './producto/producto.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { User } from './auth/entities/user.entity.js';
import { Empresa } from './empresa/entities/empresa.entity.js';
import { Producto } from './producto/entities/producto.entity.js';
import { ProductoVariante } from './producto/entities/producto-variante.entity.js';
import { Categoria } from './producto/entities/categoria.entity.js';
import { Coleccion } from './producto/entities/coleccion.entity.js';
import { MovimientoInventario } from './producto/entities/movimiento-inventario.entity.js';

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
        ],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging'),
        ssl: configService.get<string>('database.host') !== 'localhost' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),

    // Módulos de la aplicación
    AuthModule,
    EmpresaModule,
    ProductoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}