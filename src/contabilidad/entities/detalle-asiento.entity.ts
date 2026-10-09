import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

import type { AsientoContable } from './asiento-contable.entity.js';
import { AsientoContable as AsientoContableClass } from './asiento-contable.entity.js';
import type { PlanDeCuenta } from './plan-de-cuenta.entity.js';
import { PlanDeCuenta as PlanDeCuentaClass } from './plan-de-cuenta.entity.js';

@Entity('detalles_asiento')
@Index(['asientoId', 'cuentaId'])
export class DetalleAsiento {
  @ApiProperty({ description: 'Identificador único del detalle', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Asiento contable al que pertenece (cabecera)' })
  @Column({ type: 'uuid', name: 'asiento_id' })
  asientoId: string;

  @ManyToOne(() => AsientoContableClass, (asiento) => asiento.detalles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asiento_id' })
  asiento: AsientoContable;

  @ApiProperty({ description: 'Cuenta contable afectada (FK al plan de cuentas)' })
  @Column({ type: 'uuid', name: 'cuenta_id' })
  cuentaId: string;

  @ManyToOne(() => PlanDeCuentaClass, (cuenta) => cuenta.detallesAsiento, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cuenta_id' })
  cuenta: PlanDeCuenta;

  @ApiProperty({ description: 'Monto del debe (partida doble)', example: 1500.0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'debe' })
  debe: string;

  @ApiProperty({ description: 'Monto del haber (partida doble)', example: 1500.0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'haber' })
  haber: string;
}
