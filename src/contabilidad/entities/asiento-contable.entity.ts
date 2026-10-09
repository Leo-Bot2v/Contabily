import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { DetalleAsiento } from './detalle-asiento.entity.js';
import { DetalleAsiento as DetalleAsientoClass } from './detalle-asiento.entity.js';

@Entity('asientos_contables')
export class AsientoContable {
  @ApiProperty({ description: 'Identificador único del asiento', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Fecha del asiento contable' })
  @Column({ type: 'timestamptz', name: 'fecha' })
  fecha: Date;

  @ApiProperty({ description: 'Concepto o explicación del asiento', example: 'Ingreso por venta de contado' })
  @Column({ type: 'text', name: 'glosa' })
  glosa: string;

  @ApiPropertyOptional({ description: 'Referencia externa (recibo, voucher, factura)' })
  @Column({ type: 'varchar', length: 100, nullable: true, name: 'referencia' })
  referencia: string | null;

  @OneToMany(() => DetalleAsientoClass, (detalle) => detalle.asiento, { cascade: true })
  detalles: DetalleAsiento[];

  @ApiProperty({ description: 'Fecha de creación del registro' })
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' })
  creadoEn: Date;
}
