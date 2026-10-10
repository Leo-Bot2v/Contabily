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
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Empresa } from '../../empresa/entities/empresa.entity.js';
import { ProductoVariante } from './producto-variante.entity.js';
import { Coleccion } from './coleccion.entity.js';
import { Categoria } from './categoria.entity.js';

export enum TipoProducto {
  FISICO = 'fisico',
  DIGITAL = 'digital',
  SERVICIO = 'servicio',
  SUSCRIPCION = 'suscripcion',
}

export enum EstadoProducto {
  ACTIVO = 'activo',
  BORRADOR = 'borrador',
  ARCHIVADO = 'archivado',
  DESCONTINUADO = 'descontinuado',
}

@Entity('productos')
@Unique(['empresaId', 'sku'])
@Index(['empresaId', 'estado'])
@Index(['empresaId', 'categoriaId'])
export class Producto {
  @ApiProperty({ description: 'Identificador único', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'SKU único por empresa', example: 'CAM-001' })
  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @ApiPropertyOptional({ description: 'Código de barras (GTIN, UPC, EAN, ISBN)' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  codigoBarras: string | null;

  @ApiProperty({ description: 'Nombre del producto', example: 'Camiseta Básica' })
  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción detallada' })
  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @ApiPropertyOptional({ description: 'Descripción corta para listados' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcionCorta: string | null;

  @ApiProperty({ description: 'Tipo de producto', enum: TipoProducto })
  @Column({
    type: 'enum',
    enum: TipoProducto,
    default: TipoProducto.FISICO,
  })
  tipo: TipoProducto;

  @ApiProperty({ description: 'Estado del producto', enum: EstadoProducto })
  @Column({
    type: 'enum',
    enum: EstadoProducto,
    default: EstadoProducto.BORRADOR,
  })
  estado: EstadoProducto;

  // Precios
  @ApiProperty({ description: 'Precio de venta base', example: 29.99 })
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precio: number;

  @ApiPropertyOptional({ description: 'Precio de costo', example: 15.00 })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  costo: number | null;

  @ApiPropertyOptional({ description: 'Precio de comparación (tachado)', example: 39.99 })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioComparacion: number | null;

  @ApiPropertyOptional({ description: 'Precio por mayor (desde X unidades)', example: 25.00 })
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  precioMayor: number | null;

  @ApiPropertyOptional({ description: 'Cantidad mínima para precio mayor', example: 10 })
  @Column({ type: 'int', nullable: true })
  cantidadMinimaMayor: number | null;

  // Inventario (nivel producto - para productos sin variantes)
  @ApiProperty({ description: 'Rastrear inventario', default: true })
  @Column({ type: 'boolean', default: true })
  rastrearInventario: boolean;

  @ApiProperty({ description: 'Cantidad en stock (solo si no tiene variantes)', default: 0 })
  @Column({ type: 'int', default: 0 })
  stock: number;

  @ApiPropertyOptional({ description: 'Stock mínimo para alerta', example: 5 })
  @Column({ type: 'int', nullable: true })
  stockMinimo: number | null;

  @ApiPropertyOptional({ description: 'Stock máximo', example: 1000 })
  @Column({ type: 'int', nullable: true })
  stockMaximo: number | null;

  @ApiPropertyOptional({ description: 'Permitir venta sin stock (backorder)', default: false })
  @Column({ type: 'boolean', default: false })
  permitirBackorder: boolean;

  // Envío
  @ApiPropertyOptional({ description: 'Peso en gramos', example: 200 })
  @Column({ type: 'int', nullable: true })
  peso: number | null;

  @ApiPropertyOptional({ description: 'Largo en cm', example: 30 })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  largo: number | null;

  @ApiPropertyOptional({ description: 'Ancho en cm', example: 20 })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  ancho: number | null;

  @ApiPropertyOptional({ description: 'Alto en cm', example: 2 })
  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  alto: number | null;

  @ApiPropertyOptional({ description: 'Requiere envío', default: true })
  @Column({ type: 'boolean', default: true })
  requiereEnvio: boolean;

  // Impuestos
  @ApiPropertyOptional({ description: 'Exento de impuestos', default: false })
  @Column({ type: 'boolean', default: false })
  exentoImpuestos: boolean;

  @ApiPropertyOptional({ description: 'Código de impuesto personalizado' })
  @Column({ type: 'varchar', length: 50, nullable: true })
  codigoImpuesto: string | null;

  // SEO
  @ApiPropertyOptional({ description: 'Título SEO' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  tituloSeo: string | null;

  @ApiPropertyOptional({ description: 'Descripción SEO' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcionSeo: string | null;

  @ApiPropertyOptional({ description: 'Slug URL', example: 'camiseta-basica' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  slug: string | null;

  // Imágenes
  @ApiPropertyOptional({ description: 'URL imagen principal' })
  @Column({ type: 'text', nullable: true })
  imagenPrincipal: string | null;

  @ApiPropertyOptional({ description: 'Galería de imágenes (JSON array)', type: 'array', items: { type: 'string' } })
  @Column({ type: 'jsonb', nullable: true })
  imagenes: string[] | null;

  // Organización
  @ApiPropertyOptional({ description: 'Proveedor / Vendedor' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  proveedor: string | null;

  @ApiPropertyOptional({ description: 'Marca' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  marca: string | null;

  @ApiPropertyOptional({ description: 'Código MPN del fabricante' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  mpn: string | null;

  @ApiPropertyOptional({ description: 'GTIN global' })
  @Column({ type: 'varchar', length: 100, nullable: true })
  gtin: string | null;

  // Configuración
  @ApiPropertyOptional({ description: 'Requiere variantes para venderse', default: false })
  @Column({ type: 'boolean', default: false })
  requiereVariantes: boolean;

  @ApiPropertyOptional({ description: 'Configuración JSON flexible' })
  @Column({ type: 'jsonb', nullable: true })
  configuracion: Record<string, any> | null;

  // Relaciones
  @ApiProperty({ description: 'ID de la empresa' })
  @Column({ type: 'uuid' })
  empresaId: string;

  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @ApiPropertyOptional({ description: 'Categoría principal' })
  @Column({ type: 'uuid', nullable: true })
  categoriaId: string | null;

  @ManyToOne(() => Categoria, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoriaId' })
  categoria: Categoria | null;

  @ManyToMany(() => Coleccion, (coleccion) => coleccion.productos)
  @JoinTable({
    name: 'producto_colecciones',
    joinColumn: { name: 'productoId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'coleccionId', referencedColumnName: 'id' },
  })
  colecciones: Coleccion[];

  @OneToMany(() => ProductoVariante, (variante) => variante.producto, { cascade: true })
  variantes: ProductoVariante[];

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' })
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' })
  actualizadoEn: Date;

  // Métodos de conveniencia
  get precioEfectivo(): number {
    return this.precio;
  }

  get tieneStock(): boolean {
    if (!this.rastrearInventario) return true;
    if (this.requiereVariantes) return this.variantes?.some(v => v.tieneStock) ?? false;
    return this.stock > 0 || this.permitirBackorder;
  }

  get stockTotal(): number {
    if (!this.rastrearInventario) return 0;
    if (this.requiereVariantes) {
      return this.variantes?.reduce((sum, v) => sum + v.stock, 0) ?? 0;
    }
    return this.stock;
  }
}