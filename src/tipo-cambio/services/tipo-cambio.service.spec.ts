import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';

import { TipoCambioService } from './tipo-cambio.service.js';
import { TipoCambio } from '../entities/tipo-cambio.entity.js';

describe('TipoCambioService', () => {
  let service: TipoCambioService;
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let http: { get: ReturnType<typeof vi.fn> };

  const tasaGuardada: Partial<TipoCambio> = {
    id: 'tc-1',
    fecha: '2026-10-09',
    monedaOrigen: 'USD',
    monedaDestino: 'BOB',
    tasa: '11.8500',
  };

  beforeEach(() => {
    repo = {
      findOne: vi.fn().mockResolvedValue(null),
      save: vi.fn((registro) => Promise.resolve({ id: 'tc-nuevo', ...registro })),
      create: vi.fn((datos) => ({ ...datos })),
      createQueryBuilder: vi.fn(),
    };
    http = { get: vi.fn() };
    service = new TipoCambioService(repo as never, http as never);
  });

  function mockQueryBuilderUltima(ultima: TipoCambio | null): void {
    const qb = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(ultima),
    };
    repo.createQueryBuilder.mockReturnValue(qb);
  }

  it('devuelve la tasa desde la BD sin llamar a la API', async () => {
    repo.findOne.mockResolvedValue(tasaGuardada as never);

    const resultado = await service.obtenerTasaDelDia('2026-10-09');

    expect(resultado).toBe(tasaGuardada);
    expect(http.get).not.toHaveBeenCalled();
  });

  it('consulta la API de Cucu y guarda la tasa cuando no está en BD', async () => {
    http.get.mockReturnValue(of({ data: { tc_oficial: { valor: 11.85, fecha: '2026-10-09' } } }));

    const resultado = await service.obtenerTasaDelDia('2026-10-09');

    expect(http.get).toHaveBeenCalledWith(
      'https://apibcb.cucu.bo/api/v1/tc/oficial',
      expect.objectContaining({ timeout: 10000 }),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ fecha: '2026-10-09', tasa: '11.8500' }),
    );
    expect(resultado.tasa).toBe('11.8500');
    expect(resultado.monedaOrigen).toBe('USD');
    expect(resultado.monedaDestino).toBe('BOB');
  });

  it('usa la última tasa registrada si la API falla (fin de semana)', async () => {
    http.get.mockReturnValue(throwError(() => new Error('timeout')));
    const ultima = { ...tasaGuardada } as TipoCambio;
    mockQueryBuilderUltima(ultima);

    const resultado = await service.obtenerTasaDelDia('2026-10-12');

    expect(resultado).toBe(ultima);
    expect(repo.createQueryBuilder).toHaveBeenCalled();
  });

  it('lanza 503 si no hay registro local y la API falla', async () => {
    http.get.mockReturnValue(throwError(() => new Error('sin red')));
    mockQueryBuilderUltima(null);

    await expect(service.obtenerTasaDelDia('2026-10-12')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('rechaza respuestas inesperadas de la API y termina en 503', async () => {
    http.get.mockReturnValue(of({ data: { otro: 'formato' } }));
    mockQueryBuilderUltima(null);

    await expect(service.obtenerTasaDelDia('2026-10-12')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('el cron diario no propaga errores (solo loguea)', async () => {
    http.get.mockReturnValue(throwError(() => new Error('BCB caído')));

    await expect(service.sincronizarTasaDiaria()).resolves.toBeUndefined();
  });
});
