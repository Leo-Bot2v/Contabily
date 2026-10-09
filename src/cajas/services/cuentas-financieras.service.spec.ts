import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { CuentasFinancierasService } from './cuentas-financieras.service.js';
import { CuentaFinanciera, TipoCuentaFinanciera } from '../entities/cuenta-financiera.entity.js';

type MockManager = {
  create: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
};

describe('CuentasFinancierasService', () => {
  let service: CuentasFinancierasService;
  let manager: MockManager;
  let repo: { count: ReturnType<typeof vi.fn> };
  let planCuentasService: { obtenerCuentaPorId: ReturnType<typeof vi.fn> };
  let dataSource: { transaction: ReturnType<typeof vi.fn> };
  let asientosService: { crearAsiento: ReturnType<typeof vi.fn> };
  let tipoCambioService: { obtenerTasaDelDia: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    manager = {
      create: vi.fn((_, datos) => datos),
      save: vi.fn((entidad) => Promise.resolve({ id: 'cf-1', ...entidad })),
    };
    repo = { count: vi.fn().mockResolvedValue(0) };
    planCuentasService = {
      obtenerCuentaPorId: vi.fn(async (id: string) => ({ id, codigo: id, esTransaccional: true })),
    };
    dataSource = {
      transaction: vi.fn(async (callback) => callback(manager)),
    };
    asientosService = {
      crearAsiento: vi.fn().mockResolvedValue({ id: 'asiento-1' }),
    };
    tipoCambioService = {
      obtenerTasaDelDia: vi.fn().mockResolvedValue({ id: 'tc-1', tasa: '11.8500' }),
    };

    service = new CuentasFinancierasService(
      repo as never,
      planCuentasService as never,
      dataSource as never,
      asientosService as never,
      tipoCambioService as never,
    );
  });

  it('crea una cuenta sin saldo inicial y sin asiento de apertura', async () => {
    const cuenta = await service.crearCuentaFinanciera({
      nombre: 'Caja Chica',
      tipo: TipoCuentaFinanciera.EFECTIVO,
      cuentaContableId: 'cc-caja',
    });

    expect(cuenta).toMatchObject({ saldo: '0.00', moneda: 'BOB' });
    expect(asientosService.crearAsiento).not.toHaveBeenCalled();
  });

  it('rechaza saldoInicial > 0 sin cuentaAperturaId', async () => {
    await expect(
      service.crearCuentaFinanciera({
        nombre: 'Caja Chica',
        tipo: TipoCuentaFinanciera.EFECTIVO,
        cuentaContableId: 'cc-caja',
        saldoInicial: 1000,
      }),
    ).rejects.toThrow('cuentaAperturaId');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('genera el asiento de apertura (Debe caja / Haber capital)', async () => {
    const cuenta = await service.crearCuentaFinanciera({
      nombre: 'Caja Chica',
      tipo: TipoCuentaFinanciera.EFECTIVO,
      cuentaContableId: 'cc-caja',
      saldoInicial: 1000,
      cuentaAperturaId: 'cc-capital',
    });

    expect(cuenta).toMatchObject({ saldo: '1000.00' });
    expect(asientosService.crearAsiento).toHaveBeenCalledTimes(1);
    const input = asientosService.crearAsiento.mock.calls[0][1];
    expect(input.glosa).toBe('Apertura de Caja Chica');
    expect(input.detalles).toEqual([
      { cuentaId: 'cc-caja', debe: 1000, haber: 0 },
      { cuentaId: 'cc-capital', debe: 0, haber: 1000 },
    ]);
  });

  it('rechaza cuenta de apertura vinculada a una caja', async () => {
    repo.count.mockResolvedValue(1);

    await expect(
      service.crearCuentaFinanciera({
        nombre: 'Banco',
        tipo: TipoCuentaFinanciera.BANCO,
        cuentaContableId: 'cc-banco',
        saldoInicial: 200,
        cuentaAperturaId: 'cc-otra-caja',
      }),
    ).rejects.toThrow('vinculada a una caja');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechaza cuenta de apertura igual a la cuenta de la caja', async () => {
    await expect(
      service.crearCuentaFinanciera({
        nombre: 'Caja',
        tipo: TipoCuentaFinanciera.EFECTIVO,
        cuentaContableId: 'cc-caja',
        saldoInicial: 100,
        cuentaAperturaId: 'cc-caja',
      }),
    ).rejects.toThrow('misma cuenta');
  });

  it('rechaza una cuenta de apertura no transaccional', async () => {
    planCuentasService.obtenerCuentaPorId.mockImplementation(async (id: string) =>
      id === 'cc-malo' ? { id, codigo: '3', esTransaccional: false } : { id, codigo: id, esTransaccional: true },
    );

    await expect(
      service.crearCuentaFinanciera({
        nombre: 'Caja',
        tipo: TipoCuentaFinanciera.EFECTIVO,
        cuentaContableId: 'cc-caja',
        saldoInicial: 100,
        cuentaAperturaId: 'cc-malo',
      }),
    ).rejects.toThrow('no es transaccional');
  });

  it('rechaza si la cuenta contable de la caja no es transaccional', async () => {
    planCuentasService.obtenerCuentaPorId.mockResolvedValue({
      id: 'cc-clase',
      codigo: '1',
      esTransaccional: false,
    });

    await expect(
      service.crearCuentaFinanciera({
        nombre: 'Caja',
        tipo: TipoCuentaFinanciera.EFECTIVO,
        cuentaContableId: 'cc-clase',
      }),
    ).rejects.toThrow('no es transaccional');
  });

  it('propaga 404 si la cuenta contable no existe', async () => {
    planCuentasService.obtenerCuentaPorId.mockRejectedValue(new NotFoundException('no encontrada'));

    await expect(
      service.crearCuentaFinanciera({
        nombre: 'Caja',
        tipo: TipoCuentaFinanciera.EFECTIVO,
        cuentaContableId: 'inexistente',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('convierte la apertura en USD a BOB con la tasa del día', async () => {
    await service.crearCuentaFinanciera({
      nombre: 'Caja Dolar',
      tipo: TipoCuentaFinanciera.EFECTIVO,
      moneda: 'USD',
      cuentaContableId: 'cc-caja',
      saldoInicial: 100,
      cuentaAperturaId: 'cc-capital',
    });

    expect(tipoCambioService.obtenerTasaDelDia).toHaveBeenCalledTimes(1);
    const input = asientosService.crearAsiento.mock.calls[0][1];
    expect(input.detalles).toEqual([
      { cuentaId: 'cc-caja', debe: 1185, haber: 0 },
      { cuentaId: 'cc-capital', debe: 0, haber: 1185 },
    ]);
  });
});
