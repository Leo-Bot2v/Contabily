import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { TransaccionesService } from './transacciones.service.js';
import { CuentaFinanciera } from '../entities/cuenta-financiera.entity.js';

type MockManager = {
  findOne: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

describe('TransaccionesService', () => {
  let service: TransaccionesService;
  let manager: MockManager;
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let asientosService: { crearAsiento: ReturnType<typeof vi.fn> };
  let planCuentasService: { obtenerCuentaPorId: ReturnType<typeof vi.fn> };
  let cuentas: Record<string, Partial<CuentaFinanciera>>;

  const cuentaContableTransaccional = {
    id: 'cc-caja',
    codigo: '1.1.1.01',
    esTransaccional: true,
  };

  beforeEach(() => {
    cuentas = {
      origen: {
        id: 'origen',
        nombre: 'Caja Chica',
        activo: true,
        saldo: '200.00',
        cuentaContableId: 'cc-caja',
      },
      destino: {
        id: 'destino',
        nombre: 'Banco Union',
        activo: true,
        saldo: '50.00',
        cuentaContableId: 'cc-banco',
      },
    };

    manager = {
      findOne: vi.fn((_, opciones) =>
        Promise.resolve(cuentas[opciones.where.id] ? { ...cuentas[opciones.where.id] } : null),
      ),
      create: vi.fn((_, datos) => datos),
      save: vi.fn((entidad) => Promise.resolve({ id: 'tx-1', ...entidad })),
      update: vi.fn(),
    };

    dataSource = {
      transaction: vi.fn(async (callback) => callback(manager)),
    };

    asientosService = {
      crearAsiento: vi.fn().mockResolvedValue({ id: 'asiento-1' }),
    };

    planCuentasService = {
      obtenerCuentaPorId: vi.fn().mockResolvedValue(cuentaContableTransaccional),
    };

    service = new TransaccionesService(
      {} as never,
      dataSource as never,
      asientosService as never,
      planCuentasService as never,
    );
  });

  describe('registrarIngreso', () => {
    it('suma el saldo y genera un asiento equilibrado', async () => {
      const dto = {
        cuentaFinancieraId: 'origen',
        monto: 150.5,
        cuentaContableId: 'cc-ingreso',
        descripcion: 'Venta de contado',
      };

      const transaccion = await service.registrarIngreso(dto);

      expect(transaccion.tipo).toBe('INGRESO');
      expect(manager.update).toHaveBeenCalledWith(
        CuentaFinanciera,
        'origen',
        { saldo: '350.50' },
      );

      const asiento = asientosService.crearAsiento.mock.calls[0][1];
      const totalDebe = asiento.detalles.reduce((s: number, d: { debe: number }) => s + d.debe, 0);
      const totalHaber = asiento.detalles.reduce((s: number, d: { haber: number }) => s + d.haber, 0);
      expect(totalDebe).toBe(totalHaber);
      expect(asiento.detalles[0]).toMatchObject({ cuentaId: 'cc-caja', debe: 150.5, haber: 0 });
      expect(asiento.detalles[1]).toMatchObject({ cuentaId: 'cc-ingreso', debe: 0, haber: 150.5 });
    });

    it('rechaza si la cuenta contable contra no es transaccional', async () => {
      planCuentasService.obtenerCuentaPorId.mockResolvedValue({
        id: 'cc-gasto',
        codigo: '5.1',
        esTransaccional: false,
      });

      await expect(
        service.registrarIngreso({
          cuentaFinancieraId: 'origen',
          monto: 10,
          cuentaContableId: 'cc-gasto',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('registrarEgreso', () => {
    it('resta el saldo y genera el asiento invertido', async () => {
      const transaccion = await service.registrarEgreso({
        cuentaFinancieraId: 'origen',
        monto: 50,
        cuentaContableId: 'cc-gasto',
        descripcion: 'Pago de alquiler',
      });

      expect(transaccion.tipo).toBe('EGRESO');
      expect(manager.update).toHaveBeenCalledWith(
        CuentaFinanciera,
        'origen',
        { saldo: '150.00' },
      );

      const asiento = asientosService.crearAsiento.mock.calls[0][1];
      expect(asiento.detalles[0]).toMatchObject({ cuentaId: 'cc-gasto', debe: 50, haber: 0 });
      expect(asiento.detalles[1]).toMatchObject({ cuentaId: 'cc-caja', debe: 0, haber: 50 });
    });

    it('rechaza el egreso cuando el saldo es insuficiente', async () => {
      await expect(
        service.registrarEgreso({
          cuentaFinancieraId: 'origen',
          monto: 5000,
          cuentaContableId: 'cc-gasto',
        }),
      ).rejects.toThrow('Saldo insuficiente');
      expect(asientosService.crearAsiento).not.toHaveBeenCalled();
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('rechaza el egreso si la cuenta financiera está inactiva', async () => {
      cuentas.origen.activo = false;

      await expect(
        service.registrarEgreso({
          cuentaFinancieraId: 'origen',
          monto: 10,
          cuentaContableId: 'cc-gasto',
        }),
      ).rejects.toThrow('inactiva');
    });
  });

  describe('realizarTransferencia', () => {
    it('rechaza transferir a la misma cuenta', async () => {
      await expect(
        service.realizarTransferencia({
          cuentaOrigenId: 'origen',
          cuentaDestinoId: 'origen',
          monto: 10,
        }),
      ).rejects.toThrow('no pueden ser la misma');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('resta en el origen, suma en el destino y genera asiento equilibrado', async () => {
      const transaccion = await service.realizarTransferencia({
        cuentaOrigenId: 'origen',
        cuentaDestinoId: 'destino',
        monto: 100,
        descripcion: 'Fondeo de caja',
      });

      expect(transaccion.tipo).toBe('TRANSFERENCIA');
      expect(transaccion.cuentaDestinoId).toBe('destino');

      expect(manager.update).toHaveBeenCalledWith(CuentaFinanciera, 'origen', { saldo: '100.00' });
      expect(manager.update).toHaveBeenCalledWith(CuentaFinanciera, 'destino', { saldo: '150.00' });

      const asiento = asientosService.crearAsiento.mock.calls[0][1];
      // Debe = destino, Haber = origen
      expect(asiento.detalles[0]).toMatchObject({ cuentaId: 'cc-banco', debe: 100, haber: 0 });
      expect(asiento.detalles[1]).toMatchObject({ cuentaId: 'cc-caja', debe: 0, haber: 100 });
    });

    it('rechaza la transferencia si el origen no tiene saldo suficiente', async () => {
      await expect(
        service.realizarTransferencia({
          cuentaOrigenId: 'origen',
          cuentaDestinoId: 'destino',
          monto: 9999,
        }),
      ).rejects.toThrow('Saldo insuficiente');
      expect(manager.update).not.toHaveBeenCalled();
    });
  });

  describe('bloquearCuenta', () => {
    it('lanza NotFound si la cuenta financiera no existe', async () => {
      await expect(
        service.registrarIngreso({
          cuentaFinancieraId: 'fantasma',
          monto: 10,
          cuentaContableId: 'cc-ingreso',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
