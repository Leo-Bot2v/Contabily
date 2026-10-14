import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Correlativo automático de compras (N° de factura interno por negocio).
 *
 *  - secuencia_compras: contador en `empresas` que alimenta el número
 *    `FC-000001` que se asigna cuando el usuario no escribe uno a mano.
 *    Se incrementa con UPDATE ... RETURNING dentro de la transacción de la
 *    compra: el UPDATE bloquea la fila del tenant, así que dos compras
 *    simultáneas no leen el mismo valor ni duplican el correlativo.
 *
 * El backfill deja el contador al día con las compras ya registradas, de
 * modo que la primera compra automática continúa la serie y no pisa números
 * que se hayan cargado a mano.
 */
export class AgregarSecuenciaComprasAEmpresas1791940000000 implements MigrationInterface {
  name = 'AgregarSecuenciaComprasAEmpresas1791940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.empresas
        ADD COLUMN secuencia_compras integer DEFAULT 0 NOT NULL;
    `);

    await queryRunner.query(`
      UPDATE public.empresas e
      SET secuencia_compras = COALESCE(sub.total, 0)
      FROM (
        SELECT empresa_id, COUNT(*)::integer AS total
        FROM public.compras
        GROUP BY empresa_id
      ) sub
      WHERE e.id = sub.empresa_id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.empresas DROP COLUMN secuencia_compras`);
  }
}
