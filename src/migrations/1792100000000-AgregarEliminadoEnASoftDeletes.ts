import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Borrado lógico real en el módulo de productos.
 *
 * `Producto`, `ProductoVariante`, `Categoria` y `Coleccion` llamaban a
 * `softRemove()` sin tener `@DeleteDateColumn`: no había columna donde
 * escribir la fecha, así que las cuatro eliminaciones fallaban siempre.
 *
 * Nullable todas. Al ser una columna nueva y estar vacía, ningún registro
 * queda marcado como borrado y ninguna consulta existente cambia de
 * resultado; a partir de ahí TypeORM filtra solo los que tengan fecha.
 *
 * Se añade `eliminado_en` y no un borrado físico porque la fila tiene que
 * seguir viva: `movimientos_inventario` apunta a productos con CASCADE (un
 * `DELETE` borraría el histórico de stock) y `compras_detalles` con SET NULL
 * (dejaría líneas de factura sin producto). El borrado suave conserva ambas.
 */
export class AgregarEliminadoEnASoftDeletes1792100000000 implements MigrationInterface {
  name = 'AgregarEliminadoEnASoftDeletes1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.productos ADD COLUMN eliminado_en timestamptz`);
    await queryRunner.query(`ALTER TABLE public.producto_variantes ADD COLUMN eliminado_en timestamptz`);
    await queryRunner.query(`ALTER TABLE public.categorias ADD COLUMN eliminado_en timestamptz`);
    await queryRunner.query(`ALTER TABLE public.colecciones ADD COLUMN eliminado_en timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.colecciones DROP COLUMN eliminado_en`);
    await queryRunner.query(`ALTER TABLE public.categorias DROP COLUMN eliminado_en`);
    await queryRunner.query(`ALTER TABLE public.producto_variantes DROP COLUMN eliminado_en`);
    await queryRunner.query(`ALTER TABLE public.productos DROP COLUMN eliminado_en`);
  }
}
