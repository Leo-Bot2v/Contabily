import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Usuario } from '../../auth/entities/user.entity.js';

export enum TipoNegocio {
  FISICO = 'fisico',
  DIGITAL = 'digital',
  SERVICIOS = 'servicios',
  HIBRIDO = 'hibrido',
}

export enum Moneda {
  USD = 'USD',
  EUR = 'EUR',
  MXN = 'MXN',
  COP = 'COP',
  ARS = 'ARS',
  PEN = 'PEN',
  CLP = 'CLP',
  BOB = 'BOB',
  UYU = 'UYU',
  PYG = 'PYG',
  VES = 'VES',
}

@Entity('empresas')
@Unique(['usuarioId', 'rif'])
@Index(['usuarioId'])
export class Empresa {
  @ApiProperty({ description: 'Identificador único', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Nombre comercial', example: 'Mi Tienda SA' })
  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @ApiPropertyOptional({ description: 'Razón social legal' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  razonSocial: string | null;

  @ApiProperty({ description: 'RIF / NIT / Identificación fiscal', example: 'J-12345678-9' })
  @Column({ type: 'varchar', length: 50 })
  rif: string;

  @ApiPropertyOptional({ description: 'Dirección fiscal' })
  @Column({ type: 'text', nullable: true })
  direccionFiscal: string | null;

  @ApiPropertyOptional({ description: 'Teléfono de contacto' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  telefono: string | null;

  @ApiPropertyOptional({ description: 'Email de contacto' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @ApiPropertyOptional({ description: 'Sitio web' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  sitioWeb: string | null;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @Column({ type: 'text', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ description: 'Tipo de negocio', enum: TipoNegocio })
  @Column({
    type: 'enum',
    enum: TipoNegocio,
    default: TipoNegocio.FISICO,
  })
  tipo: TipoNegocio;

  @ApiProperty({ description: 'Moneda base', enum: Moneda })
  @Column({
    type: 'enum',
    enum: Moneda,
    default: Moneda.USD,
  })
  moneda: Moneda;

  @ApiPropertyOptional({ description: 'Zona horaria', example: 'America/Caracas' })
  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  zonaHoraria: string;

  @ApiPropertyOptional({ description: 'Configuración regional (locale)', example: 'es-VE' })
  @Column({ type: 'varchar', length: 10, default: 'es' })
  locale: string;

  @ApiProperty({ description: 'Si el negocio está activo', default: true })
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @ApiPropertyOptional({ description: 'Configuración JSON flexible' })
  @Column({ type: 'jsonb', nullable: true })
  configuracion: Record<string, any> | null;

  // Relaciones
  @ApiProperty({ description: 'ID del propietario' })
  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' })
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' })
  actualizadoEn: Date;
}