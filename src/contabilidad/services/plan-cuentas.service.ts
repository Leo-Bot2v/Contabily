import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { PlanDeCuenta } from '../entities/plan-de-cuenta.entity.js';
import { CuentaFinanciera } from '../../cajas/entities/cuenta-financiera.entity.js';
import { DetalleAsiento } from '../entities/detalle-asiento.entity.js';
import { CrearCuentaDto, ActualizarCuentaDto } from '../dto/plan-cuenta.dto.js';

export interface NodoArbol {
  id: string;
  codigo: string;
  nombre: string;
  esTransaccional: boolean;
  subCuentas: NodoArbol[];
}

const CLASES_BASE = [
  { codigo: '1', nombre: 'Activo' },
  { codigo: '2', nombre: 'Pasivo' },
  { codigo: '3', nombre: 'Patrimonio' },
  { codigo: '4', nombre: 'Ingresos' },
  { codigo: '5', nombre: 'Gastos' },
  { codigo: '6', nombre: 'Costos' },
];

@Injectable()
export class PlanCuentasService {
  constructor(
    @InjectRepository(PlanDeCuenta)
    private readonly planCuentasRepo: Repository<PlanDeCuenta>,
    private readonly dataSource: DataSource,
  ) {}

  async crearCuenta(dto: CrearCuentaDto): Promise<PlanDeCuenta> {
    const existente = await this.planCuentasRepo.findOne({ where: { codigo: dto.codigo } });
    if (existente) {
      throw new ConflictException(`Ya existe una cuenta con el código "${dto.codigo}"`);
    }

    await this.validarClaseRaiz(dto.codigo);

    if (dto.cuentaPadreId) {
      await this.validarCuentaPadre(dto.cuentaPadreId);
    }

    const cuenta = this.planCuentasRepo.create({
      codigo: dto.codigo,
      nombre: dto.nombre,
      cuentaPadreId: dto.cuentaPadreId ?? null,
      esTransaccional: dto.esTransaccional ?? false,
    });

    return this.planCuentasRepo.save(cuenta);
  }

  obtenerCuentas(): Promise<PlanDeCuenta[]> {
    return this.planCuentasRepo.find({ order: { codigo: 'ASC' } });
  }

  async obtenerArbolCuentas(): Promise<NodoArbol[]> {
    const cuentas = await this.planCuentasRepo.find({ order: { codigo: 'ASC' } });

    const porId = new Map<string, NodoArbol>();
    for (const cuenta of cuentas) {
      porId.set(cuenta.id, {
        id: cuenta.id,
        codigo: cuenta.codigo,
        nombre: cuenta.nombre,
        esTransaccional: cuenta.esTransaccional,
        subCuentas: [],
      });
    }

    const raices: NodoArbol[] = [];
    for (const cuenta of cuentas) {
      const nodo = porId.get(cuenta.id)!;
      const padre = cuenta.cuentaPadreId ? porId.get(cuenta.cuentaPadreId) : undefined;
      if (padre) {
        padre.subCuentas.push(nodo);
      } else {
        raices.push(nodo);
      }
    }

    return raices;
  }

  async obtenerCuentaPorId(id: string): Promise<PlanDeCuenta> {
    const cuenta = await this.planCuentasRepo.findOne({ where: { id } });
    if (!cuenta) {
      throw new NotFoundException(`Cuenta contable ${id} no encontrada`);
    }
    return cuenta;
  }

  async actualizarCuenta(id: string, dto: ActualizarCuentaDto): Promise<PlanDeCuenta> {
    const cuenta = await this.obtenerCuentaPorId(id);

    if (dto.codigo && dto.codigo !== cuenta.codigo) {
      const duplicada = await this.planCuentasRepo.findOne({ where: { codigo: dto.codigo } });
      if (duplicada) {
        throw new ConflictException(`Ya existe una cuenta con el código "${dto.codigo}"`);
      }
      await this.validarClaseRaiz(dto.codigo);
    }

    if (dto.cuentaPadreId) {
      if (dto.cuentaPadreId === id) {
        throw new BadRequestException('Una cuenta no puede ser padre de sí misma');
      }
      await this.validarCuentaPadre(dto.cuentaPadreId);
      await this.validarSinCiclo(id, dto.cuentaPadreId);
    }

    Object.assign(cuenta, dto);
    return this.planCuentasRepo.save(cuenta);
  }

  async eliminarCuenta(id: string): Promise<{ eliminada: boolean }> {
    const cuenta = await this.obtenerCuentaPorId(id);

    const subCuentas = await this.planCuentasRepo.count({ where: { cuentaPadreId: id } });
    if (subCuentas > 0) {
      throw new BadRequestException('No se puede eliminar: la cuenta tiene subcuentas asociadas');
    }

    const cuentasFinancieras = await this.dataSource
      .getRepository(CuentaFinanciera)
      .count({ where: { cuentaContableId: id } });
    if (cuentasFinancieras > 0) {
      throw new BadRequestException('No se puede eliminar: la cuenta tiene cajas o bancos asociados');
    }

    const detalles = await this.dataSource
      .getRepository(DetalleAsiento)
      .count({ where: { cuentaId: id } });
    if (detalles > 0) {
      throw new BadRequestException('No se puede eliminar: la cuenta tiene asientos contables asociados');
    }

    await this.planCuentasRepo.remove(cuenta);
    return { eliminada: true };
  }

  private async validarCuentaPadre(cuentaPadreId: string): Promise<void> {
    const padre = await this.planCuentasRepo.findOne({ where: { id: cuentaPadreId } });
    if (!padre) {
      throw new BadRequestException(`La cuenta padre ${cuentaPadreId} no existe`);
    }
  }

  /**
   * Impide ciclos: el candidato a padre no puede ser (ni tener entre sus
   * ascendientes) a la cuenta que se está actualizando, o el árbol dejaría
   * de mostrar ambas ramas.
   */
  private async validarSinCiclo(id: string, cuentaPadreId: string): Promise<void> {
    let actual: string | null = cuentaPadreId;
    let pasos = 0;
    while (actual && pasos < 1000) {
      if (actual === id) {
        throw new BadRequestException(
          'No se puede asignar: la cuenta padre es descendiente de esta cuenta (crearía un ciclo)',
        );
      }
      const nodo: PlanDeCuenta | null = await this.planCuentasRepo.findOne({ where: { id: actual } });
      actual = nodo?.cuentaPadreId ?? null;
      pasos += 1;
    }
  }

  private async validarClaseRaiz(codigo: string): Promise<void> {
    if (!codigo.includes('.')) {
      return;
    }
    const claseRaiz = codigo.split('.')[0];
    const clase = await this.planCuentasRepo.findOne({ where: { codigo: claseRaiz } });
    if (!clase) {
      throw new BadRequestException(
        `Primero debe existir la clase "${claseRaiz}" — crea una cuenta con código "${claseRaiz}" antes de crear "${codigo}"`,
      );
    }
  }

  async sembrarClasesSiVacio(): Promise<PlanDeCuenta[]> {
    const total = await this.planCuentasRepo.count();
    if (total > 0) {
      return [];
    }
    const clases = CLASES_BASE.map((clase) =>
      this.planCuentasRepo.create({
        codigo: clase.codigo,
        nombre: clase.nombre,
        cuentaPadreId: null,
        esTransaccional: false,
      }),
    );
    return this.planCuentasRepo.save(clases);
  }
}
