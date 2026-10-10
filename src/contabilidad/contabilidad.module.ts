import { Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
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
export class ContabilidadModule implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContabilidadModule.name);

  constructor(private readonly planCuentasService: PlanCuentasService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const clases = await this.planCuentasService.sembrarClasesSiVacio();
      if (clases.length > 0) {
        this.logger.log(`Plan de cuentas vacío: sembradas ${clases.length} clases base (1-6)`);
      }
    } catch (error) {
      this.logger.error(`No se pudieron sembrar las clases base: ${(error as Error).message}`);
    }
  }
}
