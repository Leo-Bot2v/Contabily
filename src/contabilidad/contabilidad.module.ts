import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ContabilidadController } from './contabilidad.controller.js';
import { PlanCuentasService } from './services/plan-cuentas.service.js';
import { AsientosService } from './services/asientos.service.js';
import { PlanDeCuenta } from './entities/plan-de-cuenta.entity.js';
import { AsientoContable } from './entities/asiento-contable.entity.js';
import { DetalleAsiento } from './entities/detalle-asiento.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([PlanDeCuenta, AsientoContable, DetalleAsiento])],
  controllers: [ContabilidadController],
  providers: [PlanCuentasService, AsientosService],
  exports: [PlanCuentasService, AsientosService],
})
export class ContabilidadModule {}
