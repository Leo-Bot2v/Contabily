import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Imagen adjunta (foto del ticket/factura) en gastos y compras.
 *
 * La imagen viaja en base64 dentro del propio JSON y se guarda en una columna
 * TEXT: el backend corre en Render con disco efímero (lo que se suba a un
 * fichero desaparece en cada redespliegue), así que la base de datos es el
 * único almacenamiento estable disponible sin servicios externos.
 *
 * Es nullable porque es opcional: los registros existentes y los nuevos sin
 * foto quedan en NULL.
 */
export class AgregarImagenAGastosYCompras1792000000000 implements MigrationInterface {
  name = 'AgregarImagenAGastosYCompras1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.gastos ADD COLUMN imagen TEXT`);
    await queryRunner.query(`ALTER TABLE public.compras ADD COLUMN imagen TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.compras DROP COLUMN imagen`);
    await queryRunner.query(`ALTER TABLE public.gastos DROP COLUMN imagen`);
  }
}
