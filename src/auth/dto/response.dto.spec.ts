import { describe, it, expect } from 'vitest';

import { UserResponseDto } from './response.dto.js';
import type { Usuario } from '../entities/user.entity.js';

/** Usuario mínimo con todo lo que fromEntity lee. */
function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'usuario-1',
    correo: 'juan@ejemplo.com',
    nombreCompleto: 'Juan Pérez',
    urlAvatar: null,
    telefono: null,
    proveedor: 'local',
    roles: ['USUARIO'],
    activo: true,
    correoVerificado: false,
    ultimoLogin: null,
    creadoEn: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as unknown as Usuario;
}

describe('UserResponseDto.fromEntity', () => {
  it('expone el teléfono del usuario', () => {
    const dto = UserResponseDto.fromEntity(usuario({ telefono: '+58 412 1234567' }));

    expect(dto.telefono).toBe('+58 412 1234567');
  });

  it('devuelve null cuando el usuario nunca puso teléfono', () => {
    const dto = UserResponseDto.fromEntity(usuario());

    expect(dto.telefono).toBeNull();
  });

  it('no confunde el teléfono con otros campos de contacto', () => {
    const dto = UserResponseDto.fromEntity(
      usuario({ telefono: '0412-1234567', urlAvatar: 'https://cdn.ejemplo.com/a.png' }),
    );

    expect(dto.telefono).toBe('0412-1234567');
    expect(dto.urlAvatar).toBe('https://cdn.ejemplo.com/a.png');
  });

  it('conserva el resto del perfil al añadir el teléfono', () => {
    const dto = UserResponseDto.fromEntity(usuario({ telefono: '0412-1234567' }));

    expect(dto.correo).toBe('juan@ejemplo.com');
    expect(dto.nombreCompleto).toBe('Juan Pérez');
    expect(dto.roles).toEqual(['USUARIO']);
    expect(dto.activo).toBe(true);
    expect(dto.id).toBe('usuario-1');
  });
});
