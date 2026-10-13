import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Teléfono de contacto en `usuarios`.
 *
 * Nullable y sin índice: la mayoría de las cuentas no lo tiene y no se busca
 * por él. Acepta cualquier formato porque la validación vive en el DTO
 * (`ActualizarPerfilDto`, máximo 50 caracteres) y porque el mismo patrón usa
 * `empresas.telefono`, así que un "+58 412 123 4567" y un "0412-1234567"
 * caben igual.
 *
 * `empresas.telefono` ya existe con esta misma forma, de ahí el 50 y no 255.
 */
export class AgregarTelefonoAUsuarios1791900000000 implements MigrationInterface {
  name = 'AgregarTelefonoAUsuarios1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.usuarios
        ADD COLUMN telefono character varying(50);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.usuarios
        DROP COLUMN telefono;
    `);
  }
}
