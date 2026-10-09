import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';

import { User } from './auth/entities/user.entity.js';
import { PlanDeCuenta } from './contabilidad/entities/plan-de-cuenta.entity.js';
import { AsientoContable } from './contabilidad/entities/asiento-contable.entity.js';
import { DetalleAsiento } from './contabilidad/entities/detalle-asiento.entity.js';
import { CuentaFinanciera } from './cajas/entities/cuenta-financiera.entity.js';
import { Transaccion } from './cajas/entities/transaccion.entity.js';
import { TipoCambio } from './tipo-cambio/entities/tipo-cambio.entity.js';

import { InitSchema1791533603941 } from './migrations/1791533603941-InitSchema.js';
import { CrearTiposCambioYConvertirMontos1791534430746 } from './migrations/1791534430746-CrearTiposCambioYConvertirMontos.js';
import { AgregarTasaAplicadaATransacciones1791536036688 } from './migrations/1791536036688-AgregarTasaAplicadaATransacciones.js';

// Carga manual de .env: el CLI de TypeORM corre fuera de Nest y necesita las credenciales.
function cargarEnv(): void {
  try {
    const contenido = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
    for (const linea of contenido.split('\n')) {
      const coincidencia = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(linea.trim());
      if (coincidencia && process.env[coincidencia[1]] === undefined) {
        process.env[coincidencia[1]] = coincidencia[2];
      }
    }
  } catch {
    // sin .env se usan los valores por defecto de abajo
  }
}

cargarEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5433),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'contabily_test',
  entities: [
    User,
    PlanDeCuenta,
    AsientoContable,
    DetalleAsiento,
    CuentaFinanciera,
    Transaccion,
    TipoCambio,
  ],
  migrations: [
    InitSchema1791533603941,
    CrearTiposCambioYConvertirMontos1791534430746,
    AgregarTasaAplicadaATransacciones1791536036688,
  ],
  synchronize: false,
  logging: false,
});
