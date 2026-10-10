import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  IsIn,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TipoCuentaFinanciera } from '../entities/cuenta-financiera.entity.js';

export class CrearCuentaFinancieraDto {
  @ApiProperty({ description: 'Nombre de la caja o banco', example: 'Caja Chica' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiProperty({ description: 'Tipo de cuenta', enum: TipoCuentaFinanciera })
  @IsEnum(TipoCuentaFinanciera, { message: 'El tipo debe ser EFECTIVO o BANCO' })
  tipo: TipoCuentaFinanciera;

  @ApiPropertyOptional({
    description: 'Moneda (solo BOB o USD — la API del BCB no cotiza otras; se normaliza a mayúsculas)',
    example: 'BOB',
    default: 'BOB',
    enum: ['BOB', 'USD'],
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString({ message: 'La moneda debe ser una cadena de texto' })
  @IsIn(['BOB', 'USD'], { message: 'La moneda debe ser BOB o USD' })
  moneda?: string;

  @ApiProperty({
    description:
      'UUID de la cuenta contable vinculada (debe ser transaccional; obtener de GET /api/v1/contabilidad/plan-cuentas)',
    example: 'b4755a45-520f-4954-9e06-55eec8f43a27',
  })
  @IsUUID(4, { message: 'cuentaContableId debe ser un UUID válido' })
  cuentaContableId: string;

  @ApiPropertyOptional({
    description:
      'Saldo inicial de la cuenta (requiere cuentaAperturaId para generar el asiento de apertura)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'El saldo inicial debe ser un número con máximo 2 decimales',
    },
  )
  @Min(0, { message: 'El saldo inicial no puede ser negativo' })
  saldoInicial?: number;

  @ApiPropertyOptional({
    description:
      'UUID de la cuenta contable para el asiento de apertura — Obligatorio si saldoInicial > 0 (ej: 3.1 Capital); debe ser transaccional y no estar vinculada a una caja/banco',
    example: 'b4755a45-520f-4954-9e06-55eec8f43a27',
  })
  @IsOptional()
  @IsUUID(4, { message: 'cuentaAperturaId debe ser un UUID válido' })
  cuentaAperturaId?: string;

  @ApiPropertyOptional({ description: 'Si la cuenta está activa', default: true })
  @IsOptional()
  @IsBoolean({ message: 'activo debe ser un booleano' })
  activo?: boolean;
}

export class RegistrarMovimientoDto {
  @ApiProperty({ description: 'Caja o banco que ejecuta el movimiento' })
  @IsUUID(4, { message: 'cuentaFinancieraId debe ser un UUID válido' })
  cuentaFinancieraId: string;

  @ApiProperty({ description: 'Monto del movimiento (positivo)', example: 1500.0 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @ApiProperty({
    description:
      'UUID de la cuenta contable del lado contrario — ingreso (ej: clase 4) o gasto (ej: clase 5); obtener de GET /api/v1/contabilidad/plan-cuentas',
    example: '40c78da6-e335-4355-aa98-7576c9e5f252',
  })
  @IsUUID(4, { message: 'cuentaContableId debe ser un UUID válido' })
  cuentaContableId: string;

  @ApiPropertyOptional({ description: 'Descripción del movimiento', example: 'Venta de contado' })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Número de recibo/voucher', example: 'REC-001' })
  @IsOptional()
  @IsString({ message: 'La referencia debe ser una cadena de texto' })
  @MaxLength(100, { message: 'La referencia no puede exceder 100 caracteres' })
  referencia?: string;
}

export class TransferenciaDto {
  @ApiProperty({ description: 'Cuenta financiera de origen (de donde sale el dinero)' })
  @IsUUID(4, { message: 'cuentaOrigenId debe ser un UUID válido' })
  cuentaOrigenId: string;

  @ApiProperty({ description: 'Cuenta financiera de destino (a donde llega el dinero)' })
  @IsUUID(4, { message: 'cuentaDestinoId debe ser un UUID válido' })
  cuentaDestinoId: string;

  @ApiProperty({ description: 'Monto a transferir (positivo)', example: 500.0 })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'El monto debe ser un número con máximo 2 decimales' },
  )
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto: number;

  @ApiPropertyOptional({ description: 'Descripción de la transferencia' })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  descripcion?: string;

  @ApiPropertyOptional({ description: 'Número de recibo/voucher', example: 'TRF-001' })
  @IsOptional()
  @IsString({ message: 'La referencia debe ser una cadena de texto' })
  @MaxLength(100, { message: 'La referencia no puede exceder 100 caracteres' })
  referencia?: string;
}
