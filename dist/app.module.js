var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule as AppConfigModule } from './config/config.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ContabilidadModule } from './contabilidad/contabilidad.module.js';
import { CajasModule } from './cajas/cajas.module.js';
import { TipoCambioModule } from './tipo-cambio/tipo-cambio.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { User } from './auth/entities/user.entity.js';
import { PlanDeCuenta } from './contabilidad/entities/plan-de-cuenta.entity.js';
import { AsientoContable } from './contabilidad/entities/asiento-contable.entity.js';
import { DetalleAsiento } from './contabilidad/entities/detalle-asiento.entity.js';
import { CuentaFinanciera } from './cajas/entities/cuenta-financiera.entity.js';
import { Transaccion } from './cajas/entities/transaccion.entity.js';
import { TipoCambio } from './tipo-cambio/entities/tipo-cambio.entity.js';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [
            AppConfigModule,
            TypeOrmModule.forRootAsync({
                imports: [ConfigModule],
                useFactory: (configService) => ({
                    type: 'postgres',
                    host: configService.get('database.host'),
                    port: configService.get('database.port'),
                    username: configService.get('database.username'),
                    password: configService.get('database.password'),
                    database: configService.get('database.name'),
                    entities: [User, PlanDeCuenta, AsientoContable, DetalleAsiento, CuentaFinanciera, Transaccion, TipoCambio],
                    synchronize: configService.get('database.synchronize'),
                    logging: configService.get('database.logging'),
                    ssl: configService.get('database.host') !== 'localhost' ? { rejectUnauthorized: false } : false,
                }),
                inject: [ConfigService],
            }),
            ScheduleModule.forRoot(),
            AuthModule,
            ContabilidadModule,
            CajasModule,
            TipoCambioModule,
        ],
        controllers: [AppController],
        providers: [AppService],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map