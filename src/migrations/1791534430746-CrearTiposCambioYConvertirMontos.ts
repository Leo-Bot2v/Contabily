import { MigrationInterface, QueryRunner } from "typeorm";

export class CrearTiposCambioYConvertirMontos1791534430746 implements MigrationInterface {
    name = 'CrearTiposCambioYConvertirMontos1791534430746'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tipos_cambio" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" date NOT NULL, "moneda_origen" character varying(3) NOT NULL DEFAULT 'USD', "moneda_destino" character varying(3) NOT NULL DEFAULT 'BOB', "tasa" numeric(10,4) NOT NULL, CONSTRAINT "PK_dcd5231eb34f8987ac9185fa868" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_tipos_cambio_fecha" ON "tipos_cambio"  ("fecha") `);
        await queryRunner.query(`ALTER TABLE "transacciones" ADD "monto_en_moneda_base" numeric(15,2) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transacciones" DROP COLUMN "monto_en_moneda_base"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tipos_cambio_fecha"`);
        await queryRunner.query(`DROP TABLE "tipos_cambio"`);
    }

}
