import { describe, it, expect } from 'vitest';
import { ValidationPipe, BadRequestException } from '@nestjs/common';

import { ActualizarPerfilDto } from './auth.dto.js';

/**
 * Usa el mismo ValidationPipe que src/main.ts instala globalmente.
 *
 * Lo que se prueba aquí sobre todo es la lista blanca: el perfil es el único
 * punto de la API donde un usuario normal puede escribir en su propia fila de
 * `usuarios`, así que `correo`, `roles` y `hashContrasena` tienen que rebotar
 * antes de llegar al repositorio.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validar(body: unknown): Promise<ActualizarPerfilDto> {
  return pipe.transform(body, { type: 'body', metatype: ActualizarPerfilDto, data: '' });
}

/** Devuelve el mensaje de la primera propiedad con error, o lanza si no falló. */
async function mensajeDeError(body: unknown): Promise<string> {
  try {
    await validar(body);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const respuesta: unknown = (error as BadRequestException).getResponse();
    if (typeof respuesta === 'string') return respuesta;
    const mensaje = (respuesta as { message?: string | string[] }).message;
    return Array.isArray(mensaje) ? mensaje.join(' | ') : String(mensaje);
  }
  throw new Error('La validación no falló, cuando debería hacerlo');
}

describe('ActualizarPerfilDto', () => {
  it('acepta un PATCH vacío, porque no hay nada que actualizar', async () => {
    const dto = await validar({});
    expect(dto).toBeInstanceOf(ActualizarPerfilDto);
    expect(dto.telefono).toBeUndefined();
    expect(dto.nombreCompleto).toBeUndefined();
    expect(dto.urlAvatar).toBeUndefined();
  });

  it('acepta los tres campos del perfil', async () => {
    const dto = await validar({
      nombreCompleto: 'Juan Pérez',
      telefono: '+58 412 1234567',
      urlAvatar: 'https://cdn.ejemplo.com/foto.png',
    });
    expect(dto.nombreCompleto).toBe('Juan Pérez');
    expect(dto.telefono).toBe('+58 412 1234567');
    expect(dto.urlAvatar).toBe('https://cdn.ejemplo.com/foto.png');
  });

  it('acepta un teléfono con signos y espacios, igual que empresas.telefono', async () => {
    const dto = await validar({ telefono: '+58 (412) 123-4567' });
    expect(dto.telefono).toBe('+58 (412) 123-4567');
  });

  it('rechaza un teléfono de más de 50 caracteres', async () => {
    await expect(mensajeDeError({ telefono: '9'.repeat(51) })).resolves.toContain('teléfono');
  });

  it('rechaza un nombre de más de 255 caracteres', async () => {
    await expect(mensajeDeError({ nombreCompleto: 'a'.repeat(256) })).resolves.toContain('nombre');
  });

  it('rechaza un avatar de más de 2048 caracteres', async () => {
    await expect(mensajeDeError({ urlAvatar: 'a'.repeat(2049) })).resolves.toContain('avatar');
  });

  // ==================== LISTA BLANCA ====================

  it('rechaza roles, para que nadie se promueva a admin desde el perfil', async () => {
    await expect(mensajeDeError({ roles: ['ADMIN'] })).resolves.toContain('roles');
  });

  it('rechaza el correo, que solo cambia por un flujo de verificación', async () => {
    await expect(mensajeDeError({ correo: 'otro@ejemplo.com' })).resolves.toContain('correo');
  });

  it('rechaza hashContrasena, para no escribir un hash inventado', async () => {
    await expect(mensajeDeError({ hashContrasena: 'abc123' })).resolves.toContain('hashContrasena');
  });

  it('rechaza varios campos de golpe, no uno por uno', async () => {
    await expect(
      mensajeDeError({ roles: ['ADMIN'], activo: true, eliminadoEn: new Date() }),
    ).resolves.toContain('roles');
  });
});
