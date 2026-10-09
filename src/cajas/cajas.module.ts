import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CajasController } from './cajas.controller.js';
import { CuentasFinancierasService } from './services/cuentas-financieras.service.js';
import { TransaccionesService } from './services/transacciones.service.js';
import { CuentaFinanciera } from './entities/cuenta-financiera.entity.js';
import { Transaccion } from './entities/transaccion.entity.js';
import { ContabilidadModule } from '../contabilidad/contabilidad.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([CuentaFinanciera, Transaccion]), ContabilidadModule],
  controllers: [CajasController],
  providers: [CuentasFinancierasService, TransaccionesService],
})
export class CajasModule {}
