import { describe, it, expect } from 'vitest';
import { ValidationPipe, BadRequestException } from '@nestjs/common';

import { CrearEmpresaDto, ActualizarEmpresaDto } from './empresa.dto.js';

/**
 * Usa el mismo ValidationPipe que src/main.ts instala globalmente. Es la pieza
 * que antes se saltaba la validación de estas empresas, porque los DTO eran
 * interfaces y no había metadato en tiempo de ejecución que revisar.
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

async function validar(body: unknown): Promise<CrearEmpresaDto> {
  return pipe.transform(body, { type: 'body', metatype: CrearEmpresaDto, data: '' });
}

async function validarActualizacion(body: unknown): Promise<ActualizarEmpresaDto> {
  return pipe.transform(body, { type: 'body', metatype: ActualizarEmpresaDto, data: '' });
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

describe('CrearEmpresaDto', () => {
  it('acepta una empresa mínima con nombre y rif', async () => {
    const dto = await validar({ nombre: 'Mi Tienda C.A.', rif: 'J-12345678-9' });

    expect(dto.nombre).toBe('Mi Tienda C.A.');
    expect(dto.rif).toBe('J-12345678-9');
  });

  it('rechaza un body vacío con un mensaje claro en vez de un 500', async () => {
    const mensaje = await mensajeDeError({});

    expect(mensaje).toContain('El nombre es obligatorio');
    expect(mensaje).toContain('El rif es obligatorio');
  });

  it('rechaza un nombre vacío', async () => {
    const mensaje = await mensajeDeError({ nombre: '', rif: 'J-12345678-9' });

    expect(mensaje).toContain('El nombre es obligatorio');
  });

  it('rechaza un rif demasiado largo (la columna admite 50)', async () => {
    const mensaje = await mensajeDeError({ nombre: 'Mi Tienda', rif: 'J'.repeat(51) });

    expect(mensaje).toContain('El rif no puede exceder 50 caracteres');
  });

  it('rechaza un email inválido', async () => {
    const mensaje = await mensajeDeError({
      nombre: 'Mi Tienda',
      rif: 'J-1',
      email: 'no-es-un-email',
    });

    expect(mensaje).toContain('El email debe ser válido');
  });

  it('rechaza un tipo de negocio que no existe', async () => {
    const mensaje = await mensajeDeError({
      nombre: 'Mi Tienda',
      rif: 'J-1',
      tipo: 'astronautico',
    });

    expect(mensaje).toContain('El tipo debe ser fisico, digital, servicios o hibrido');
  });

  it('rechaza una moneda que no existe', async () => {
    const mensaje = await mensajeDeError({
      nombre: 'Mi Tienda',
      rif: 'J-1',
      moneda: 'BTC',
    });

    expect(mensaje).toContain('La moneda debe ser una de las permitidas');
  });

  it('rechaza configuración que no sea un objeto', async () => {
    const mensaje = await mensajeDeError({
      nombre: 'Mi Tienda',
      rif: 'J-1',
      configuracion: 'texto libre',
    });

    expect(mensaje).toContain('La configuración debe ser un objeto JSON');
  });

  it('rechaza campos desconocidos en vez de dejarlos pasar al repositorio', async () => {
    const mensaje = await mensajeDeError({
      nombre: 'Mi Tienda',
      rif: 'J-1',
      password: 'no-debería-estar-aquí',
    });

    expect(mensaje).toContain('password');
  });

  it('transforma el body en una instancia de la clase', async () => {
    const dto = await validar({ nombre: 'Mi Tienda', rif: 'J-1', tipo: 'digital' });

    expect(dto).toBeInstanceOf(CrearEmpresaDto);
    expect(dto.tipo).toBe('digital');
  });
});

describe('ActualizarEmpresaDto', () => {
  it('permite un body vacío: todos los campos son opcionales', async () => {
    const dto = await validarActualizacion({});

    expect(dto).toBeInstanceOf(ActualizarEmpresaDto);
  });

  it('acepta solo activo, para encender y apagar la empresa', async () => {
    const dto = await validarActualizacion({ activo: false });

    expect(dto.activo).toBe(false);
  });

  it('valida igual de estrictamente que el de creación cuando se envía el campo', async () => {
    await expect(validarActualizacion({ nombre: 'x'.repeat(256) })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('no incluye propiedades que no se enviaron, para no borrar datos al actualizar', async () => {
    const dto = await validarActualizacion({ telefono: '+58 212 5550000' });

    expect(Object.prototype.hasOwnProperty.call(dto, 'nombre')).toBe(false);
    expect(dto.telefono).toBe('+58 212 5550000');
  });
});
