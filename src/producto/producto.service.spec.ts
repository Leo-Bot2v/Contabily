import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { ProductoService } from './producto.service.js';

const EMPRESA = 'empresa-1';
const PRODUCTO_ID = 'producto-1';
const VARIANTE_ID = 'variante-1';

/**
 * El orden importa: replica el del constructor de ProductoService.
 *
 * `compraDetalleRepository` es el último porque se añadió cuando apareció la
 * comprobación de enlaces; no existía cuando el servicio se escribió.
 */
function crearRepos(overrides: Record<string, unknown> = {}) {
  const base = {
    productoRepository: { findOne: vi.fn(), count: vi.fn(), softRemove: vi.fn() },
    varianteRepository: { findOne: vi.fn(), softRemove: vi.fn() },
    categoriaRepository: { findOne: vi.fn(), count: vi.fn(), softRemove: vi.fn() },
    coleccionRepository: { findOne: vi.fn(), softRemove: vi.fn() },
    movimientoRepository: { count: vi.fn() },
    empresaRepository: { findOne: vi.fn() },
    compraDetalleRepository: { count: vi.fn() },
    ...overrides,
  };
  return base;
}

function crearService(repos: ReturnType<typeof crearRepos>) {
  const service = new ProductoService(
    repos.productoRepository as never,
    repos.varianteRepository as never,
    repos.categoriaRepository as never,
    repos.coleccionRepository as never,
    repos.movimientoRepository as never,
    repos.empresaRepository as never,
    repos.compraDetalleRepository as never,
  );
  return service;
}

function producto(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCTO_ID,
    nombre: 'Café molido',
    sku: 'CAF-001',
    empresaId: EMPRESA,
    eliminadoEn: null,
    ...overrides,
  };
}

function variante(overrides: Record<string, unknown> = {}) {
  return {
    id: VARIANTE_ID,
    nombreCompleto: 'Café molido / 500g',
    producto: { empresaId: EMPRESA },
    ...overrides,
  };
}

/**
 * ConflictException devuelve `{ message, error, statusCode }`, no el string a
 * secas; sin esto, `toContain` se queja contra el objeto entero.
 */
function mensajeDe(error: unknown): string {
  const respuesta = (error as ConflictException).getResponse() as { message?: string | string[] };
  const mensaje: unknown = respuesta?.message;
  if (Array.isArray(mensaje)) return mensaje.join(' | ');
  if (typeof mensaje === 'string') return mensaje;
  return JSON.stringify(respuesta);
}

describe('ProductoService.eliminar', () => {
  let repos: ReturnType<typeof crearRepos>;
  let service: ProductoService;

  beforeEach(() => {
    repos = crearRepos({
      productoRepository: {
        findOne: vi.fn(async () => producto()),
        count: vi.fn(),
        softRemove: vi.fn(async (p: unknown) => p),
      },
    });
    service = crearService(repos);
    repos.compraDetalleRepository.count.mockResolvedValue(0);
    repos.movimientoRepository.count.mockResolvedValue(0);
  });

  it('borra un producto que no tiene nada enlazado', async () => {
    await service.eliminar(PRODUCTO_ID, EMPRESA);

    expect(repos.productoRepository.softRemove).toHaveBeenCalledTimes(1);
  });

  it('devuelve 409 si el producto aparece en compras', async () => {
    repos.compraDetalleRepository.count.mockResolvedValue(3);

    await expect(service.eliminar(PRODUCTO_ID, EMPRESA)).rejects.toThrow(ConflictException);
    expect(repos.productoRepository.softRemove).not.toHaveBeenCalled();
  });

  it('explica en el mensaje cuántas compras lo bloquean', async () => {
    repos.compraDetalleRepository.count.mockResolvedValue(3);

    const error = await service.eliminar(PRODUCTO_ID, EMPRESA).catch((e: unknown) => e);

    expect(mensajeDe(error)).toContain('3 compras');
  });

  it('explica también los movimientos de inventario', async () => {
    repos.movimientoRepository.count.mockResolvedValue(5);

    const error = await service.eliminar(PRODUCTO_ID, EMPRESA).catch((e: unknown) => e);

    expect(mensajeDe(error)).toContain('5 movimientos de inventario');
  });

  it('enumera los dos motivos cuando coinciden', async () => {
    repos.compraDetalleRepository.count.mockResolvedValue(1);
    repos.movimientoRepository.count.mockResolvedValue(2);

    const error = await service.eliminar(PRODUCTO_ID, EMPRESA).catch((e: unknown) => e);

    const mensaje = mensajeDe(error);
    expect(mensaje).toContain('1 compra');
    expect(mensaje).toContain('2 movimientos de inventario');
  });

  it('usa singular cuando hay un solo enlace', async () => {
    repos.movimientoRepository.count.mockResolvedValue(1);

    const error = await service.eliminar(PRODUCTO_ID, EMPRESA).catch((e: unknown) => e);

    expect(mensajeDe(error)).toContain('1 movimiento de inventario');
  });

  it('devuelve 404 si el producto no existe en esa empresa', async () => {
    repos.productoRepository.findOne.mockResolvedValue(null);

    await expect(service.eliminar(PRODUCTO_ID, 'otra-empresa')).rejects.toThrow(NotFoundException);
    expect(repos.productoRepository.softRemove).not.toHaveBeenCalled();
  });
});

describe('ProductoService.eliminarVariante', () => {
  let repos: ReturnType<typeof crearRepos>;
  let service: ProductoService;

  beforeEach(() => {
    repos = crearRepos({
      varianteRepository: {
        findOne: vi.fn(async () => variante()),
        softRemove: vi.fn(async (v: unknown) => v),
      },
    });
    service = crearService(repos);
    repos.compraDetalleRepository.count.mockResolvedValue(0);
    repos.movimientoRepository.count.mockResolvedValue(0);
  });

  it('borra una variante sin enlaces', async () => {
    await service.eliminarVariante(VARIANTE_ID, EMPRESA);

    expect(repos.varianteRepository.softRemove).toHaveBeenCalledTimes(1);
  });

  it('devuelve 409 si la variante aparece en compras', async () => {
    repos.compraDetalleRepository.count.mockResolvedValue(2);

    await expect(service.eliminarVariante(VARIANTE_ID, EMPRESA)).rejects.toThrow(ConflictException);
    expect(repos.varianteRepository.softRemove).not.toHaveBeenCalled();
  });

  it('consulta por varianteId y no por productoId', async () => {
    repos.movimientoRepository.count.mockResolvedValue(1);

    await service.eliminarVariante(VARIANTE_ID, EMPRESA).catch(() => undefined);

    expect(repos.movimientoRepository.count).toHaveBeenCalledWith({
      where: { varianteId: VARIANTE_ID },
    });
    expect(repos.compraDetalleRepository.count).toHaveBeenCalledWith({
      where: { varianteId: VARIANTE_ID },
    });
  });

  it('devuelve 404 si la variante pertenece a otra empresa', async () => {
    repos.varianteRepository.findOne.mockResolvedValue(variante({ producto: { empresaId: 'otra' } }));

    await expect(service.eliminarVariante(VARIANTE_ID, EMPRESA)).rejects.toThrow(NotFoundException);
  });
});
