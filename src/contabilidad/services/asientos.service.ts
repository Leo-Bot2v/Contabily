import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { AsientoContable } from '../entities/asiento-contable.entity.js';
import { DetalleAsiento } from '../entities/detalle-asiento.entity.js';

export interface DetalleAsientoInput {
  cuentaId: string;
  debe: number;
  haber: number;
}

export interface CrearAsientoInput {
  fecha?: Date;
  glosa: string;
  referencia?: string;
  detalles: DetalleAsientoInput[];
}

@Injectable()
export class AsientosService {
  constructor(
    @InjectRepository(AsientoContable)
    private readonly asientosRepo: Repository<AsientoContable>,
  ) {}

  /**
   * Crea un asiento con sus detalles dentro de la transacción (EntityManager)
   * que le pase el llamador. Valida el principio de partida doble.
   */
  async crearAsiento(manager: EntityManager, input: CrearAsientoInput): Promise<AsientoContable> {
    if (input.detalles.length === 0) {
      throw new BadRequestException('El asiento debe tener al menos un detalle');
    }

    const totalDebe = input.detalles.reduce((suma, d) => suma + Number(d.debe ?? 0), 0);
    const totalHaber = input.detalles.reduce((suma, d) => suma + Number(d.haber ?? 0), 0);

    if (Math.abs(totalDebe - totalHaber) > 0.005) {
      throw new BadRequestException(
        `El asiento no cuadra: debe ${totalDebe.toFixed(2)} ≠ haber ${totalHaber.toFixed(2)}`,
      );
    }

    if (totalDebe <= 0) {
      throw new BadRequestException('El asiento debe tener monto mayor a 0');
    }

    const asiento = manager.create(AsientoContable, {
      fecha: input.fecha ?? new Date(),
      glosa: input.glosa,
      referencia: input.referencia ?? null,
      detalles: input.detalles.map((d) =>
        manager.create(DetalleAsiento, {
          cuentaId: d.cuentaId,
          debe: Number(d.debe ?? 0).toFixed(2),
          haber: Number(d.haber ?? 0).toFixed(2),
        }),
      ),
    });

    return manager.save(asiento);
  }

  async obtenerAsientos(): Promise<AsientoContable[]> {
    return this.asientosRepo.find({
      relations: { detalles: { cuenta: true } },
      order: { fecha: 'DESC', creadoEn: 'DESC' },
    });
  }
}
