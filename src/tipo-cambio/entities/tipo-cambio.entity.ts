import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('tipos_cambio')
@Index('IDX_tipos_cambio_fecha', ['fecha'], { unique: true })
export class TipoCambio {
  @ApiProperty({ description: 'Identificador único del registro de tipo de cambio', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Fecha a la que rige la tasa (YYYY-MM-DD)', example: '2026-10-09' })
  @Column({ type: 'date', name: 'fecha' })
  fecha: string;

  @ApiProperty({ description: 'Moneda origen (ISO 4217)', example: 'USD' })
  @Column({ type: 'varchar', length: 3, default: 'USD', name: 'moneda_origen' })
  monedaOrigen: string;

  @ApiProperty({ description: 'Moneda destino (ISO 4217)', example: 'BOB' })
  @Column({ type: 'varchar', length: 3, default: 'BOB', name: 'moneda_destino' })
  monedaDestino: string;

  @ApiProperty({ description: 'Tasa oficial del BCB: 1 USD = tasa BOB', example: 11.85 })
  @Column({ type: 'decimal', precision: 10, scale: 4, name: 'tasa' })
  tasa: string;
}
