import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import {
  Transaccion,
  TipoTransaccion,
} from '../entities/transaccion.entity.js';
import { CuentaFinanciera } from '../entities/cuenta-financiera.entity.js';
import { AsientosService } from '../../contabilidad/services/asientos.service.js';
import { PlanCuentasService } from '../../contabilidad/services/plan-cuentas.service.js';
import {
  RegistrarMovimientoDto,
  TransferenciaDto,
} from '../dto/cajas.dto.js';

@Injectable()
export class TransaccionesService {
  constructor(
    @InjectRepository(Transaccion)
    private readonly transaccionesRepo: Repository<Transaccion>,
    private readonly dataSource: DataSource,
    private readonly asientosService: AsientosService,
    private readonly planCuentasService: PlanCuentasService,
  ) {}

  async registrarIngreso(dto: RegistrarMovimientoDto): Promise<Transaccion> {
    await this.validarCuentaContableTransaccional(dto.cuentaContableId);

    return this.dataSource.transaction(async (manager) => {
      const cuenta = await this.bloquearCuenta(manager, dto.cuentaFinancieraId);
      const monto = this.redondear(dto.monto);

      await this.actualizarSaldo(manager, cuenta, monto);

      const transaccion = await manager.save(
        manager.create(Transaccion, {
          cuentaFinancieraId: cuenta.id,
          tipo: TipoTransaccion.INGRESO,
          monto: monto.toFixed(2),
          descripcion: dto.descripcion ?? null,
          referencia: dto.referencia ?? null,
          cuentaDestinoId: null,
        }),
      );

      await this.asientosService.crearAsiento(manager, {
        glosa: dto.descripcion ?? `Ingreso en ${cuenta.nombre}`,
        referencia: dto.referencia,
        detalles: [
          // Debe: la caja/banco (activo) aumenta
          { cuentaId: cuenta.cuentaContableId, debe: monto, haber: 0 },
          // Haber: cuenta de ingreso (cuenta contra)
          { cuentaId: dto.cuentaContableId, debe: 0, haber: monto },
        ],
      });

      return transaccion;
    });
  }

  async registrarEgreso(dto: RegistrarMovimientoDto): Promise<Transaccion> {
    await this.validarCuentaContableTransaccional(dto.cuentaContableId);

    return this.dataSource.transaction(async (manager) => {
      const cuenta = await this.bloquearCuenta(manager, dto.cuentaFinancieraId);
      const monto = this.redondear(dto.monto);

      if (this.redondear(Number(cuenta.saldo)) < monto) {
        throw new BadRequestException(
          `Saldo insuficiente en "${cuenta.nombre}": disponible ${Number(cuenta.saldo).toFixed(2)}, requerido ${monto.toFixed(2)}`,
        );
      }

      await this.actualizarSaldo(manager, cuenta, -monto);

      const transaccion = await manager.save(
        manager.create(Transaccion, {
          cuentaFinancieraId: cuenta.id,
          tipo: TipoTransaccion.EGRESO,
          monto: monto.toFixed(2),
          descripcion: dto.descripcion ?? null,
          referencia: dto.referencia ?? null,
          cuentaDestinoId: null,
        }),
      );

      await this.asientosService.crearAsiento(manager, {
        glosa: dto.descripcion ?? `Egreso en ${cuenta.nombre}`,
        referencia: dto.referencia,
        detalles: [
          // Debe: cuenta de gasto (cuenta contra)
          { cuentaId: dto.cuentaContableId, debe: monto, haber: 0 },
          // Haber: la caja/banco (activo) disminuye
          { cuentaId: cuenta.cuentaContableId, debe: 0, haber: monto },
        ],
      });

      return transaccion;
    });
  }

  async realizarTransferencia(dto: TransferenciaDto): Promise<Transaccion> {
    if (dto.cuentaOrigenId === dto.cuentaDestinoId) {
      throw new BadRequestException('La cuenta origen y destino no pueden ser la misma');
    }

    return this.dataSource.transaction(async (manager) => {
      // Bloqueo en orden de id para evitar interbloqueos
      const [primeraId, segundaId] = [dto.cuentaOrigenId, dto.cuentaDestinoId].sort();
      const primera = await this.bloquearCuenta(manager, primeraId);
      const segunda = await this.bloquearCuenta(manager, segundaId);

      const origen = primera.id === dto.cuentaOrigenId ? primera : segunda;
      const destino = primera.id === dto.cuentaDestinoId ? primera : segunda;
      const monto = this.redondear(dto.monto);

      if (this.redondear(Number(origen.saldo)) < monto) {
        throw new BadRequestException(
          `Saldo insuficiente en "${origen.nombre}": disponible ${Number(origen.saldo).toFixed(2)}, requerido ${monto.toFixed(2)}`,
        );
      }

      await this.actualizarSaldo(manager, origen, -monto);
      await this.actualizarSaldo(manager, destino, monto);

      const transaccion = await manager.save(
        manager.create(Transaccion, {
          cuentaFinancieraId: origen.id,
          tipo: TipoTransaccion.TRANSFERENCIA,
          monto: monto.toFixed(2),
          descripcion: dto.descripcion ?? null,
          referencia: dto.referencia ?? null,
          cuentaDestinoId: destino.id,
        }),
      );

      await this.asientosService.crearAsiento(manager, {
        glosa: dto.descripcion ?? `Transferencia de ${origen.nombre} a ${destino.nombre}`,
        referencia: dto.referencia,
        detalles: [
          // Debe: cuenta contable del destino
          { cuentaId: destino.cuentaContableId, debe: monto, haber: 0 },
          // Haber: cuenta contable del origen
          { cuentaId: origen.cuentaContableId, debe: 0, haber: monto },
        ],
      });

      return transaccion;
    });
  }

  async listarTransacciones(filtros: { cuentaId?: string; tipo?: TipoTransaccion }): Promise<Transaccion[]> {
    return this.transaccionesRepo.find({
      where: {
        ...(filtros.cuentaId ? { cuentaFinancieraId: filtros.cuentaId } : {}),
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      },
      relations: { cuentaFinanciera: true, cuentaDestino: true },
      order: { fechaCreacion: 'DESC' },
      take: 100,
    });
  }

  private async bloquearCuenta(manager: EntityManager, id: string): Promise<CuentaFinanciera> {
    const cuenta = await manager.findOne(CuentaFinanciera, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!cuenta) {
      throw new NotFoundException(`Cuenta financiera ${id} no encontrada`);
    }
    if (!cuenta.activo) {
      throw new BadRequestException(`La cuenta financiera "${cuenta.nombre}" está inactiva`);
    }
    return cuenta;
  }

  private async actualizarSaldo(
    manager: EntityManager,
    cuenta: CuentaFinanciera,
    delta: number,
  ): Promise<void> {
    const nuevoSaldo = this.redondear(Number(cuenta.saldo) + delta);
    await manager.update(CuentaFinanciera, cuenta.id, { saldo: nuevoSaldo.toFixed(2) });
    cuenta.saldo = nuevoSaldo.toFixed(2);
  }

  private async validarCuentaContableTransaccional(cuentaContableId: string): Promise<void> {
    const cuenta = await this.planCuentasService.obtenerCuentaPorId(cuentaContableId);
    if (!cuenta.esTransaccional) {
      throw new BadRequestException(
        `La cuenta contable "${cuenta.codigo}" no es transaccional; usa una cuenta que acepte movimientos`,
      );
    }
  }

  private redondear(valor: number): number {
    return Math.round(valor * 100) / 100;
  }
}
