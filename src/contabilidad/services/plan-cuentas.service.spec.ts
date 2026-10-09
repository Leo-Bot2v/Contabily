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
      save: vi.fn((entidad) =>
        Promise.resolve(
          Array.isArray(entidad)
            ? entidad.map((e, i) => ({ id: `uuid-${i}`, ...e }))
            : { id: 'uuid-nuevo', ...entidad },
        ),
      ),
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
      repo.findOne.mockImplementation((opciones) =>
        Promise.resolve(opciones?.where?.codigo === '1' ? { id: 'clase-1', codigo: '1' } : null),
      );

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
        .mockResolvedValueOnce({ id: 'clase-1', codigo: '1' }) // clase raíz OK
        .mockResolvedValueOnce(null); // padre no existe

      await expect(
        service.crearCuenta({ codigo: '1.1.1.01', nombre: 'Hija', cuentaPadreId: 'no-existe' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un código con punto si la clase raíz no existe', async () => {
      repo.findOne
        .mockResolvedValueOnce(null) // código libre
        .mockResolvedValueOnce(null); // clase raíz "9" no existe

      await expect(
        service.crearCuenta({ codigo: '9.1.01', nombre: 'Huérfana' }),
      ).rejects.toThrow('Primero debe existir la clase "9"');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('crea un código con punto cuando la clase raíz existe', async () => {
      repo.findOne
        .mockResolvedValueOnce(null) // código libre
        .mockResolvedValueOnce({ id: 'clase-4', codigo: '4', nombre: 'Ingresos' }); // clase raíz OK

      const cuenta = await service.crearCuenta({ codigo: '4.1.01', nombre: 'Ventas' });

      expect(cuenta).toMatchObject({ codigo: '4.1.01', nombre: 'Ventas' });
      expect(repo.save).toHaveBeenCalled();
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

  describe('actualizarCuenta', () => {
    it('rechaza asignar como padre a un descendiente (ciclo)', async () => {
      // 'a' es la raíz y 'b' es su hijo: poner 'a' bajo 'b' crearía un ciclo
      repo.findOne.mockImplementation((opciones) => {
        const id = opciones?.where?.id;
        if (id === 'a') return Promise.resolve({ id: 'a', codigo: '1.1', cuentaPadreId: null });
        if (id === 'b') return Promise.resolve({ id: 'b', codigo: '1.1.01', cuentaPadreId: 'a' });
        return Promise.resolve(null);
      });

      await expect(
        service.actualizarCuenta('a', { cuentaPadreId: 'b' }),
      ).rejects.toThrow('ciclo');
      expect(repo.save).not.toHaveBeenCalled();
    });
    it('rechaza cambiar el código a otro huérfano', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'a', codigo: '5.1.01', nombre: 'Gastos' }) // obtenerCuentaPorId
        .mockResolvedValueOnce(null) // código nuevo sin duplicar
        .mockResolvedValueOnce(null); // clase raíz "9" no existe

      await expect(service.actualizarCuenta('a', { codigo: '9.2' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('sembrarClasesSiVacio', () => {
    it('crea las 6 clases base si el plan está vacío', async () => {
      repo.count.mockResolvedValue(0);

      const clases = await service.sembrarClasesSiVacio();

      expect(clases).toHaveLength(6);
      expect(clases.map((c) => c.codigo)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(clases.map((c) => c.nombre)).toEqual([
        'Activo',
        'Pasivo',
        'Patrimonio',
        'Ingresos',
        'Gastos',
        'Costos',
      ]);
      expect(clases.every((c) => c.esTransaccional === false)).toBe(true);
      expect(repo.save).toHaveBeenCalled();
    });

    it('no toca nada si ya existen cuentas', async () => {
      repo.count.mockResolvedValue(5);

      const resultado = await service.sembrarClasesSiVacio();

      expect(resultado).toEqual([]);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
