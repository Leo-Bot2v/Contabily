import { describe, it, expect } from 'vitest';

import { codificarEstadoGoogle, leerModoCallbackGoogle } from './google-state.js';

/** Construye un `state` a partir de un objeto crudo, como haría un tercero. */
function estadoDe(objeto: unknown): string {
  return Buffer.from(JSON.stringify(objeto), 'utf8').toString('base64');
}

describe('codificarEstadoGoogle', () => {
  it('genera un estado apto para la query string (sin + / ni =)', () => {
    // El base64 normal usa + y / que la query string corrompe: + se lee como
    // espacio. Por eso se usa base64url.
    for (const modo of ['json', 'redirect'] as const) {
      expect(codificarEstadoGoogle(modo)).not.toMatch(/[+/=]/);
    }
  });

  it('redondea ida y vuelta con el lector', () => {
    expect(leerModoCallbackGoogle(codificarEstadoGoogle('json'))).toBe('json');
    expect(leerModoCallbackGoogle(codificarEstadoGoogle('redirect'))).toBe('redirect');
  });

  it('sobrevive a estar dentro de una query string', () => {
    const url = new URL('https://ejemplo.com/callback');
    url.searchParams.set('state', codificarEstadoGoogle('json'));

    // searchParams reescapa al leer: si fuera base64 normal, el + volvería
    // como espacio y el estado se perdería.
    expect(leerModoCallbackGoogle(url.searchParams.get('state'))).toBe('json');
  });
});

describe('leerModoCallbackGoogle', () => {
  it('lee el modo json', () => {
    expect(leerModoCallbackGoogle(estadoDe({ provider: 'google', mode: 'json' }))).toBe('json');
  });

  it('lee el modo redirect', () => {
    expect(leerModoCallbackGoogle(estadoDe({ provider: 'google', mode: 'redirect' }))).toBe(
      'redirect',
    );
  });

  it('acepta también base64 clásico, por compatibilidad con estados antiguos', () => {
    const legado = Buffer.from(
      JSON.stringify({ provider: 'google', mode: 'json' }),
      'utf8',
    ).toString('base64');

    expect(leerModoCallbackGoogle(legado)).toBe('json');
  });

  it('si no hay estado, asume redirect (el modo que existía antes)', () => {
    expect(leerModoCallbackGoogle(undefined)).toBe('redirect');
    expect(leerModoCallbackGoogle(null)).toBe('redirect');
    expect(leerModoCallbackGoogle('')).toBe('redirect');
  });

  it('si el estado es corrupto, asume redirect en vez de lanzar', () => {
    expect(leerModoCallbackGoogle('esto-no-es-base64-~~~')).toBe('redirect');
    expect(leerModoCallbackGoogle('!!!')).toBe('redirect');
    expect(leerModoCallbackGoogle(Buffer.from('no es json', 'utf8').toString('base64url'))).toBe(
      'redirect',
    );
  });

  it('si el estado no es una cadena, asume redirect', () => {
    expect(leerModoCallbackGoogle(42)).toBe('redirect');
    expect(leerModoCallbackGoogle({ mode: 'json' })).toBe('redirect');
    expect(leerModoCallbackGoogle(['json'])).toBe('redirect');
  });

  it('un modo desconocido cae en redirect', () => {
    expect(leerModoCallbackGoogle(estadoDe({ mode: 'admin' }))).toBe('redirect');
    expect(leerModoCallbackGoogle(estadoDe({}))).toBe('redirect');
    expect(leerModoCallbackGoogle(estadoDe({ mode: 7 }))).toBe('redirect');
  });

  it('ignora campos extra y solo mira el modo', () => {
    const conBasura = estadoDe({
      provider: 'google',
      mode: 'json',
      intentadoEn: 'una-petiion-ajena',
      rol: 'admin',
    });

    expect(leerModoCallbackGoogle(conBasura)).toBe('json');
  });
});
