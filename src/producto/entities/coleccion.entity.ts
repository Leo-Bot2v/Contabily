import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Empresa } from '../../empresa/entities/empresa.entity.js';
import { Producto } from './producto.entity.js';

export enum TipoColeccion {
  MANUAL = 'manual',
  AUTOMATICA = 'automatica',
}

export enum CondicionColeccion {
  IGUAL = 'igual',
  NO_IGUAL = 'no_igual',
  CONTIENE = 'contiene',
  NO_CONTIENE = 'no_contiene',
  EMPIEZA_CON = 'empieza_con',
  TERMINA_CON = 'termina_con',
  MAYOR_QUE = 'mayor_que',
  MENOR_QUE = 'menor_que',
  EN_RANGO = 'en_rango',
  ESTA_VACIO = 'esta_vacio',
  NO_ESTA_VACIO = 'no_esta_vacio',
}

export interface ReglaColeccion {
  campo: string;
  condicion: CondicionColeccion;
  valor: string | number | boolean;
}

export interface CondicionesColeccion {
  tipo: 'Y' | 'O';
  reglas: ReglaColeccion[];
  grupos?: CondicionesColeccion[];
}

@Entity('colecciones')
@Unique(['empresaId', 'slug'])
@Index(['empresaId', 'tipo'])
export class Coleccion {
  @ApiProperty({ description: 'Identificador único', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Nombre de la colección', example: 'Verano 2024' })
  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @ApiPropertyOptional({ description: 'Descripción' })
  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @ApiProperty({ description: 'Slug URL', example: 'verano-2024' })
  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @ApiProperty({ description: 'Tipo de colección', enum: TipoColeccion })
  @Column({
    type: 'enum',
    enum: TipoColeccion,
    default: TipoColeccion.MANUAL,
  })
  tipo: TipoColeccion;

  @ApiPropertyOptional({ description: 'Imagen de la colección' })
  @Column({ type: 'text', nullable: true })
  imagen: string | null;

  @ApiPropertyOptional({ description: 'Condiciones para colecciones automáticas (JSON)' })
  @Column({ type: 'jsonb', nullable: true })
  condiciones: CondicionesColeccion | null;

  @ApiProperty({ description: 'Orden de visualización', default: 0 })
  @Column({ type: 'int', default: 0 })
  orden: number;

  @ApiProperty({ description: 'Si la colección está activa', default: true })
  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @ApiPropertyOptional({ description: 'Visible en tienda', default: true })
  @Column({ type: 'boolean', default: true })
  visibleEnTienda: boolean;

  @ApiPropertyOptional({ description: 'Título SEO' })
  @Column({ type: 'varchar', length: 255, nullable: true })
  tituloSeo: string | null;

  @ApiPropertyOptional({ description: 'Descripción SEO' })
  @Column({ type: 'varchar', length: 500, nullable: true })
  descripcionSeo: string | null;

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

  @ManyToMany(() => Producto, (producto) => producto.colecciones)
  @JoinTable({
    name: 'coleccion_productos',
    joinColumn: { name: 'coleccionId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'productoId', referencedColumnName: 'id' },
  })
  productos: Producto[];

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' })
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' })
  actualizadoEn: Date;

  // Métodos de conveniencia
  get totalProductos(): number {
    return this.productos?.length ?? 0;
  }

  evaluarProducto(producto: Producto): boolean {
    if (this.tipo === TipoColeccion.MANUAL) {
      return this.productos?.some(p => p.id === producto.id) ?? false;
    }
    if (!this.condiciones) return false;
    return this.evaluarCondiciones(this.condiciones, producto);
  }

  private evaluarCondiciones(condiciones: CondicionesColeccion, producto: Producto): boolean {
    const resultados = condiciones.reglas.map(regla => this.evaluarRegla(regla, producto));

    if (condiciones.tipo === 'Y') {
      return resultados.every(r => r);
    }
    return resultados.some(r => r);
  }

  private evaluarRegla(regla: ReglaColeccion, producto: Producto): boolean {
    const valorProducto = this.obtenerValorCampo(producto, regla.campo);
    const valorRegla = regla.valor;

    switch (regla.condicion) {
      case CondicionColeccion.IGUAL:
        return valorProducto === valorRegla;
      case CondicionColeccion.NO_IGUAL:
        return valorProducto !== valorRegla;
      case CondicionColeccion.CONTIENE:
        return String(valorProducto).toLowerCase().includes(String(valorRegla).toLowerCase());
      case CondicionColeccion.NO_CONTIENE:
        return !String(valorProducto).toLowerCase().includes(String(valorRegla).toLowerCase());
      case CondicionColeccion.EMPIEZA_CON:
        return String(valorProducto).toLowerCase().startsWith(String(valorRegla).toLowerCase());
      case CondicionColeccion.TERMINA_CON:
        return String(valorProducto).toLowerCase().endsWith(String(valorRegla).toLowerCase());
      case CondicionColeccion.MAYOR_QUE:
        return Number(valorProducto) > Number(valorRegla);
      case CondicionColeccion.MENOR_QUE:
        return Number(valorProducto) < Number(valorRegla);
      case CondicionColeccion.ESTA_VACIO:
        return !valorProducto || String(valorProducto).trim() === '';
      case CondicionColeccion.NO_ESTA_VACIO:
        return valorProducto && String(valorProducto).trim() !== '';
      default:
        return false;
    }
  }

  private obtenerValorCampo(producto: Producto, campo: string): any {
    switch (campo) {
      case 'titulo':
      case 'nombre':
        return producto.nombre;
      case 'tipo':
        return producto.tipo;
      case 'proveedor':
        return producto.proveedor;
      case 'marca':
        return producto.marca;
      case 'categoria':
        return producto.categoria?.nombre;
      case 'precio':
        return producto.precio;
      case 'comparar_precio':
        return producto.precioComparacion;
      case 'peso':
        return producto.peso;
      case 'sku':
        return producto.sku;
      case 'codigo_barras':
        return producto.codigoBarras;
      case 'tags':
      case 'etiquetas':
        return producto.configuracion?.tags ?? [];
      default:
        // Buscar en configuración JSON
        return producto.configuracion?.[campo];
    }
  }
}