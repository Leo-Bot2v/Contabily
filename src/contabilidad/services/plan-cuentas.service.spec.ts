import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';

import { PlanCuentasService } from './plan-cuentas.service.js';

describe('PlanCuentasService', () => {
  let service: PlanCuentasService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let dataSource: { getRepository: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repo = {
      findOne: vi.fn(),
      find: vi.fn(),
      count: vi.fn(),
      create: vi.fn((...args) => (args.length === 2 ? args[1] : args[0])),
      save: vi.fn((entidad) => Promise.resolve({ id: 'uuid-nuevo', ...entidad })),
      remove: vi.fn(),
    };
    dataSource = {
      getRepository: vi.fn(() => ({ count: vi.fn().mockResolvedValue(0) })),
    };
    service = new PlanCuentasService(repo as never, dataSource as never);
  });

  describe('crearCuenta', () => {
    it('rechaza un código duplicado con ConflictException', async () => {
      repo.findOne.mockResolvedValue({ id: 'x', codigo: '1.1.1.01' });

      await expect(
        service.crearCuenta({ codigo: '1.1.1.01', nombre: 'Caja General' }),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('crea una cuenta válida con valores por defecto', async () => {
      repo.findOne.mockResolvedValue(null);

      const cuenta = await service.crearCuenta({ codigo: '1.1.1.01', nombre: 'Caja General' });

      expect(cuenta).toMatchObject({
        codigo: '1.1.1.01',
        nombre: 'Caja General',
        cuentaPadreId: null,
        esTransaccional: false,
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('valida que la cuenta padre exista', async () => {
      repo.findOne
        .mockResolvedValueOnce(null) // código libre
        .mockResolvedValueOnce(null); // padre no existe

      await expect(
        service.crearCuenta({ codigo: '1.1.1.01', nombre: 'Hija', cuentaPadreId: 'no-existe' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('obtenerArbolCuentas', () => {
    it('construye la jerarquía de padres e hijos', async () => {
      repo.find.mockResolvedValue([
        { id: 'a', codigo: '1', nombre: 'Activo', cuentaPadreId: null, esTransaccional: false },
        { id: 'b', codigo: '1.1', nombre: 'Disponible', cuentaPadreId: 'a', esTransaccional: false },
        { id: 'c', codigo: '1.1.1', nombre: 'Caja', cuentaPadreId: 'b', esTransaccional: true },
        { id: 'd', codigo: '2', nombre: 'Pasivo', cuentaPadreId: null, esTransaccional: false },
      ]);

      const arbol = await service.obtenerArbolCuentas();

      expect(arbol).toHaveLength(2);
      expect(arbol[0].codigo).toBe('1');
      expect(arbol[0].subCuentas).toHaveLength(1);
      expect(arbol[0].subCuentas[0].codigo).toBe('1.1');
      expect(arbol[0].subCuentas[0].subCuentas[0].codigo).toBe('1.1.1');
      expect(arbol[1].codigo).toBe('2');
    });
  });

  describe('eliminarCuenta', () => {
    it('rechaza eliminar una cuenta con subcuentas', async () => {
      repo.findOne.mockResolvedValue({ id: 'a', codigo: '1', nombre: 'Activo' });
      repo.count.mockResolvedValue(2);

      await expect(service.eliminarCuenta('a')).rejects.toThrow(BadRequestException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('rechaza eliminar una cuenta con cajas o bancos asociados', async () => {
      repo.findOne.mockResolvedValue({ id: 'a', codigo: '1.1.1', nombre: 'Caja' });
      repo.count.mockResolvedValue(0); // sin subcuentas
      dataSource.getRepository.mockReturnValue({ count: vi.fn().mockResolvedValue(1) }); // con caja asociada

      await expect(service.eliminarCuenta('a')).rejects.toThrow(BadRequestException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('elimina una cuenta sin dependencias', async () => {
      repo.findOne.mockResolvedValue({ id: 'a', codigo: '9', nombre: 'Libre' });
      repo.count.mockResolvedValue(0);
      dataSource.getRepository.mockReturnValue({ count: vi.fn().mockResolvedValue(0) });
      repo.remove.mockResolvedValue(undefined);

      const resultado = await service.eliminarCuenta('a');

      expect(resultado).toEqual({ eliminada: true });
      expect(repo.remove).toHaveBeenCalledWith({ id: 'a', codigo: '9', nombre: 'Libre' });
    });
  });

  describe('obtenerCuentaPorId', () => {
    it('lanza NotFound si la cuenta no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.obtenerCuentaPorId('no-existe')).rejects.toThrow(NotFoundException);
    });
  });
});
