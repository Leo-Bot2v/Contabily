import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthService } from './auth.service.js';
import { leerModoCallbackGoogle } from '../utils/google-state.js';

const CLIENT_ID = 'cliente-id.apps.googleusercontent.com';
const CALLBACK = 'https://contabily-xcw1.onrender.com/api/v1/auth/google/callback';

function crearConfig(values: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    // Sin SUPABASE_URL el servicio arranca en modo local, que es nuestro caso.
    'supabase.url': undefined,
    'googleOAuth.clientId': CLIENT_ID,
    'googleOAuth.callbackUrl': CALLBACK,
    ...values,
  };
  return { get: vi.fn((clave: string) => base[clave]) };
}

describe('AuthService.getGoogleAuthUrl', () => {
  let service: AuthService;
  let config: ReturnType<typeof crearConfig>;

  beforeEach(() => {
    config = crearConfig();
    service = new AuthService(
      config as never,
      {} as never,
      { isReady: vi.fn(() => false) } as never,
    );
  });

  function estadoDeAuthUrl(authUrl: string): string | null {
    return new URL(authUrl).searchParams.get('state');
  }

  it('apunta a Google con el client_id y el callback configurados', async () => {
    const { authUrl } = await service.getGoogleAuthUrl();
    const url = new URL(authUrl);

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK);
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('por defecto pide el modo redirect, el flujo del frontend', async () => {
    const { authUrl } = await service.getGoogleAuthUrl();

    expect(leerModoCallbackGoogle(estadoDeAuthUrl(authUrl))).toBe('redirect');
  });

  it('con mode=json codifica ese modo en el state', async () => {
    const { authUrl } = await service.getGoogleAuthUrl('json');

    expect(leerModoCallbackGoogle(estadoDeAuthUrl(authUrl))).toBe('json');
  });

  it('con mode=redirect lo codifica explícitamente', async () => {
    const { authUrl } = await service.getGoogleAuthUrl('redirect');

    expect(leerModoCallbackGoogle(estadoDeAuthUrl(authUrl))).toBe('redirect');
  });

  it('el state viaja integro dentro de la query string', async () => {
    const { authUrl } = await service.getGoogleAuthUrl('json');

    // Si fuera base64 normal, el + se colaría como espacio y se corrompería.
    expect(authUrl).toContain('state=');
    expect(estadoDeAuthUrl(authUrl)).not.toMatch(/[+/]/);
  });

  it('solo pide los scopes de email y perfil', async () => {
    const { authUrl } = await service.getGoogleAuthUrl();

    expect(new URL(authUrl).searchParams.get('scope')).toBe('email profile');
  });
});

describe('AuthService.getGoogleAuthUrl en modo Supabase', () => {
  it('delega en Supabase y devuelve su URL tal cual', async () => {
    const urlSupabase = 'https://proyecto.supabase.co/auth/v1/authorize?provider=google';
    const config = crearConfig({ 'supabase.url': 'https://proyecto.supabase.co' });
    const supabase = {
      isReady: vi.fn(() => true),
      signInWithGoogle: vi.fn(async () => ({ url: urlSupabase, error: null })),
    };

    const service = new AuthService(config as never, {} as never, supabase as never);
    const resultado = await service.getGoogleAuthUrl('json');

    expect(resultado.authUrl).toBe(urlSupabase);
    expect(supabase.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('propaga el error de Supabase como 401', async () => {
    const config = crearConfig({ 'supabase.url': 'https://proyecto.supabase.co' });
    const supabase = {
      isReady: vi.fn(() => true),
      signInWithGoogle: vi.fn(async () => ({ url: null, error: new Error('sin red') })),
    };

    const service = new AuthService(config as never, {} as never, supabase as never);

    await expect(service.getGoogleAuthUrl()).rejects.toThrow('Error iniciando OAuth con Google');
  });
});
