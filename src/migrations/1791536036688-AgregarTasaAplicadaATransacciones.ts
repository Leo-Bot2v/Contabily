import { MigrationInterface, QueryRunner } from "typeorm";

export class AgregarTasaAplicadaATransacciones1791536036688 implements MigrationInterface {
    name = 'AgregarTasaAplicadaATransacciones1791536036688'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacciones" ADD "tasa_aplicada" numeric(10,4) NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE "transacciones" ALTER COLUMN "tasa_aplicada" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transacciones" ADD "tipo_cambio_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transacciones" ADD CONSTRAINT "FK_f4acc3327d53cc5266a4d0a28a3" FOREIGN KEY ("tipo_cambio_id") REFERENCES "tipos_cambio"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacciones" DROP CONSTRAINT "FK_f4acc3327d53cc5266a4d0a28a3"`);
        await queryRunner.query(`ALTER TABLE "transacciones" DROP COLUMN "tipo_cambio_id"`);
        await queryRunner.query(`ALTER TABLE "transacciones" DROP COLUMN "tasa_aplicada"`);
    }

}
