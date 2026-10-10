import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductoController } from './producto.controller.js';
import { ProductoService } from './producto.service.js';
import { CategoriaColeccionController } from './categoria-coleccion.controller.js';
import { CategoriaColeccionService } from './categoria-coleccion.service.js';
import { Producto } from './entities/producto.entity.js';
import { ProductoVariante } from './entities/producto-variante.entity.js';
import { Categoria } from './entities/categoria.entity.js';
import { Coleccion } from './entities/coleccion.entity.js';
import { MovimientoInventario } from './entities/movimiento-inventario.entity.js';
import { Empresa } from '../empresa/entities/empresa.entity.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Producto,
      ProductoVariante,
      Categoria,
      Coleccion,
      MovimientoInventario,
      Empresa,
    ]),
    AuthModule,
  ],
  controllers: [
    ProductoController,
    CategoriaColeccionController,
  ],
  providers: [
    ProductoService,
    CategoriaColeccionService,
  ],
  exports: [
    ProductoService,
    CategoriaColeccionService,
    TypeOrmModule,
  ],
})
export class ProductoModule {}