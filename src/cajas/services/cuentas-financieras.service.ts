import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CuentaFinanciera } from '../entities/cuenta-financiera.entity.js';
import { PlanCuentasService } from '../../contabilidad/services/plan-cuentas.service.js';
import { CrearCuentaFinancieraDto } from '../dto/cajas.dto.js';

@Injectable()
export class CuentasFinancierasService {
  constructor(
    @InjectRepository(CuentaFinanciera)
    private readonly cuentasRepo: Repository<CuentaFinanciera>,
    private readonly planCuentasService: PlanCuentasService,
  ) {}

  async crearCuentaFinanciera(dto: CrearCuentaFinancieraDto): Promise<CuentaFinanciera> {
    const cuentaContable = await this.planCuentasService.obtenerCuentaPorId(dto.cuentaContableId);
    if (!cuentaContable.esTransaccional) {
      throw new BadRequestException(
        `La cuenta contable "${cuentaContable.codigo}" no es transaccional; vincula una cuenta que acepte movimientos`,
      );
    }

    const cuenta = this.cuentasRepo.create({
      nombre: dto.nombre,
      tipo: dto.tipo,
      moneda: dto.moneda ?? 'BOB',
      activo: dto.activo ?? true,
      saldo: (dto.saldoInicial ?? 0).toFixed(2),
      cuentaContableId: dto.cuentaContableId,
    });

    return this.cuentasRepo.save(cuenta);
  }

  async listarCuentasFinancieras(): Promise<CuentaFinanciera[]> {
    return this.cuentasRepo.find({
      relations: { cuentaContable: true },
      order: { nombre: 'ASC' },
    });
  }

  async obtenerSaldoActual(id: string): Promise<{ id: string; nombre: string; moneda: string; saldo: number }> {
    const cuenta = await this.cuentasRepo.findOne({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException(`Cuenta financiera ${id} no encontrada`);
    }
    return {
      id: cuenta.id,
      nombre: cuenta.nombre,
      moneda: cuenta.moneda,
      saldo: Number(cuenta.saldo),
    };
  }

  async obtenerCuentaPorId(id: string): Promise<CuentaFinanciera> {
    const cuenta = await this.cuentasRepo.findOne({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException(`Cuenta financiera ${id} no encontrada`);
    }
    return cuenta;
  }
}
