import { describe, it, expect, beforeEach, vi } from 'vitest';

import { SecurityAuditService } from './security-audit.service.js';

type BruteForceConfig = {
  enabled: boolean;
  maxAttempts: number;
  windowMinutes: number;
  blockSeconds: number;
};

/** Redis en memoria mínimo: solo lo que SecurityAuditService toca de verdad. */
function crearRedisFalso() {
  const contadores = new Map<string, number>();
  const bloqueadas = new Map<string, number>(); // clave -> segundos TTL
  const escrituras: Array<{ clave: string; ttl: number; valor: string }> = [];
  const indices = new Set<string>();

  return {
    contadores,
    bloqueadas,
    escrituras,
    indices,
    incr: vi.fn(async (clave: string) => {
      const siguiente = (contadores.get(clave) ?? 0) + 1;
      contadores.set(clave, siguiente);
      return siguiente;
    }),
    pExpire: vi.fn(async () => true),
    setEx: vi.fn(async (clave: string, ttl: number, valor: string) => {
      escrituras.push({ clave, ttl, valor });
      if (clave.startsWith('blocked_ip:')) bloqueadas.set(clave, ttl);
      return 'OK';
    }),
    exists: vi.fn(async (clave: string) => (clave.startsWith('blocked_ip:') && bloqueadas.has(clave) ? 1 : 0)),
    get: vi.fn(async () => null),
    sAdd: vi.fn(async (clave: string) => {
      indices.add(clave);
      return 1;
    }),
    keys: vi.fn(async () => []),
    del: vi.fn(async () => 0),
  };
}

function crearConfig(bruteForce: Partial<BruteForceConfig> = {}) {
  const completo: BruteForceConfig = {
    enabled: false,
    maxAttempts: 5,
    windowMinutes: 15,
    blockSeconds: 900,
    ...bruteForce,
  };
  return { get: vi.fn((clave: string) => (clave === 'security.bruteForce' ? completo : undefined)) };
}

/** Cuenta cuántos eventos `brute_force_detected` se han persistido. */
function eventosFuerzaBruta(redis: ReturnType<typeof crearRedisFalso>): number {
  return redis.escrituras.filter(
    ({ valor }) => valor.includes('"eventType":"brute_force_detected"'),
  ).length;
}

function loginFallido(service: SecurityAuditService, ip: string, intento: number): Promise<void> {
  return service.logEvent({
    eventType: 'login_failed',
    email: `usuario${intento}@correo.com`,
    ip,
    success: false,
    severity: 'medium',
    details: { reason: 'invalid_credentials' },
    userAgent: 'vitest',
  });
}

describe('SecurityAuditService — fuerza bruta', () => {
  let redis: ReturnType<typeof crearRedisFalso>;
  let service: SecurityAuditService;

  const ip = '203.0.113.7';

  function montar(bruteForce: Partial<BruteForceConfig> = {}): SecurityAuditService {
    return new SecurityAuditService(redis as never, crearConfig(bruteForce) as never);
  }

  beforeEach(() => {
    redis = crearRedisFalso();
    service = montar();
  });

  it('no bloquea la IP por debajo del umbral', async () => {
    for (let i = 1; i <= 4; i++) await loginFallido(service, ip, i);

    expect(await service.isIpBlocked(ip)).toBe(false);
    expect(eventosFuerzaBruta(redis)).toBe(0);
  });

  it('NO bloquea la IP aunque se supere el umbral, porque el bloqueo está desactivado por defecto', async () => {
    for (let i = 1; i <= 10; i++) await loginFallido(service, ip, i);

    expect(await service.isIpBlocked(ip)).toBe(false);
    expect(redis.bloqueadas.size).toBe(0);
  });

  it('aun sin bloquear, emite el evento de auditoría para que la detección siga siendo visible', async () => {
    for (let i = 1; i <= 5; i++) await loginFallido(service, ip, i);

    expect(eventosFuerzaBruta(redis)).toBe(1);
    expect(redis.indices.has('audit:type:brute_force_detected')).toBe(true);
  });

  it('emite el evento UNA sola vez al cruzar el umbral, no en cada intento posterior', async () => {
    for (let i = 1; i <= 12; i++) await loginFallido(service, ip, i);

    expect(eventosFuerzaBruta(redis)).toBe(1);
  });

  it('bloquea la IP cuando AUTH_BRUTE_FORCE_ENABLED=true, con el TTL configurado', async () => {
    service = montar({ enabled: true, blockSeconds: 300 });

    for (let i = 1; i <= 5; i++) await loginFallido(service, ip, i);

    expect(await service.isIpBlocked(ip)).toBe(true);
    expect(redis.bloqueadas.get(`blocked_ip:${ip}`)).toBe(300);
  });

  it('respeta el umbral personalizado', async () => {
    service = montar({ enabled: true, maxAttempts: 3, blockSeconds: 60 });

    await loginFallido(service, ip, 1);
    await loginFallido(service, ip, 2);
    expect(await service.isIpBlocked(ip)).toBe(false);

    await loginFallido(service, ip, 3);
    expect(await service.isIpBlocked(ip)).toBe(true);
  });

  it('solo contabiliza los fallos de login: otras IP no se ven afectadas', async () => {
    service = montar({ enabled: true, maxAttempts: 2 });

    await loginFallido(service, ip, 1);
    await loginFallido(service, ip, 2);

    expect(await service.isIpBlocked(ip)).toBe(true);
    expect(await service.isIpBlocked('198.51.100.9')).toBe(false);
  });

  it('una ventana distinta se respeta al fijar la caducidad del contador', async () => {
    service = montar({ enabled: true, windowMinutes: 30 });

    await loginFallido(service, ip, 1);

    expect(redis.pExpire).toHaveBeenCalledWith(`brute_force:${ip}`, 30 * 60 * 1000);
  });
});
