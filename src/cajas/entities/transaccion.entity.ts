import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { CuentaFinanciera } from './cuenta-financiera.entity.js';
import { CuentaFinanciera as CuentaFinancieraClass } from './cuenta-financiera.entity.js';

export enum TipoTransaccion {
  INGRESO = 'INGRESO',
  EGRESO = 'EGRESO',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

@Entity('transacciones')
@Index(['cuentaFinancieraId', 'fechaCreacion'])
export class Transaccion {
  @ApiProperty({ description: 'Identificador único de la transacción', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Caja o banco que ejecutó el movimiento' })
  @Column({ type: 'uuid', name: 'cuenta_financiera_id' })
  cuentaFinancieraId: string;

  @ManyToOne(() => CuentaFinancieraClass, (cuenta) => cuenta.transacciones, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cuenta_financiera_id' })
  cuentaFinanciera: CuentaFinanciera;

  @ApiProperty({ description: 'Tipo de movimiento', enum: TipoTransaccion })
  @Column({ type: 'enum', enum: TipoTransaccion, name: 'tipo' })
  tipo: TipoTransaccion;

  @ApiProperty({ description: 'Monto del movimiento', example: 1500.0 })
  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'monto' })
  monto: string;

  @ApiPropertyOptional({ description: 'Descripción del movimiento', example: 'Venta de contado' })
  @Column({ type: 'text', nullable: true, name: 'descripcion' })
  descripcion: string | null;

  @ApiPropertyOptional({ description: 'Número de recibo/voucher', example: 'REC-001' })
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'referencia' })
  referencia: string | null;

  @ApiPropertyOptional({ description: 'Cuenta destino (solo para TRANSFERENCIA)' })
  @Column({ type: 'uuid', nullable: true, name: 'cuenta_destino_id' })
  cuentaDestinoId: string | null;

  @ManyToOne(() => CuentaFinancieraClass, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cuenta_destino_id' })
  cuentaDestino: CuentaFinanciera | null;

  @ApiProperty({ description: 'Fecha automática del movimiento' })
  @CreateDateColumn({ type: 'timestamptz', name: 'fecha_creacion' })
  fechaCreacion: Date;
}
