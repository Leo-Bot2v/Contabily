import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Producto } from './producto.entity.js';

@Entity('producto_variantes')
@Unique(['productoId', 'sku'])
@Index(['productoId'])
export class ProductoVariante {
  @ApiProperty({ description: 'Identificador único', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'SKU único de la variante', example: 'CAM-001-R-M' })
  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @ApiPropertyOptional({ description: 'Código de barras específico de la variante' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  codigoBarras: string | null;

  @ApiPropertyOptional({ description: 'Nombre de la variante', example: 'Rojo / M' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  nombre: string | null;

  // Opciones de la variante (ej: Color: Rojo, Talla: M)
  @ApiProperty({ description: 'Opciones seleccionadas (JSON)', example: { color: 'Rojo', talla: 'M' } })
  @Column({ type: 'jsonb' })
  opciones: Record<string, string>;

  // Precios
  @ApiProperty({ description: 'Precio de venta', example: 29.99 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precio: number;

  @ApiPropertyOptional({ description: 'Precio de costo', example: 15.00 })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  costo: number | null;

  @ApiPropertyOptional({ description: 'Precio de comparación', example: 39.99 })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioComparacion: number | null;

  // Inventario por variante
  @ApiProperty({ description: 'Rastrear inventario', default: true })
  @Column({ type: 'boolean', default: true })
  rastrearInventario: boolean;

  @ApiProperty({ description: 'Cantidad en stock', default: 0 })
  @Column({ type: 'int', default: 0 })
  stock: number;

  @ApiPropertyOptional({ description: 'Stock mínimo para alerta', example: 3 })
  @Column({ type: 'int', nullable: true })
  stockMinimo: number | null;

  @ApiPropertyOptional({ description: 'Stock máximo', example: 500 })
  @Column({ type: 'int', nullable: true })
  stockMaximo: number | null;

  @ApiPropertyOptional({ description: 'Permitir backorder', default: false })
  @Column({ type: 'boolean', default: false })
  permitirBackorder: boolean;

  // Envío específico de variante
  @ApiPropertyOptional({ description: 'Peso en gramos', example: 180 })
  @Column({ type: 'int', nullable: true })
  peso: number | null;

  @ApiPropertyOptional({ description: 'Largo en cm' })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  largo: number | null;

  @ApiPropertyOptional({ description: 'Ancho en cm' })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ancho: number | null;

  @ApiPropertyOptional({ description: 'Alto en cm' })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  alto: number | null;

  // Imagen específica de la variante
  @ApiPropertyOptional({ description: 'URL imagen de la variante' })
  @Column({ type: 'text', nullable: true })
  imagen: string | null;

  // Identificadores
  @ApiPropertyOptional({ description: 'MPN del fabricante' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  mpn: string | null;

  @ApiPropertyOptional({ description: 'GTIN global' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  gtin: string | null;

  // Configuración
  @ApiPropertyOptional({ description: 'Configuración JSON flexible' })
  @Column({ type: 'jsonb', nullable: true })
  configuracion: Record<string, any> | null;

  @ApiProperty({ description: 'Si la variante está activa', default: true })
  @Column({ type: 'boolean', default: true })
  activo: boolean;

  // Relaciones
  @ApiProperty({ description: 'ID del producto padre' })
  @Column({ type: 'uuid' })
  productoId: string;

  @ManyToOne(() => Producto, (producto: Producto) => producto.variantes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productoId' })
  producto: Producto;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' })
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' })
  actualizadoEn: Date;

  // Métodos de conveniencia
  get tieneStock(): boolean {
    if (!this.rastrearInventario) return true;
    return this.stock > 0 || this.permitirBackorder;
  }

  get stockDisponible(): number {
    if (!this.rastrearInventario) return 0;
    return this.stock;
  }

  get nombreCompleto(): string {
    if (this.nombre) return this.nombre;
    return Object.values(this.opciones).join(' / ');
  }
}