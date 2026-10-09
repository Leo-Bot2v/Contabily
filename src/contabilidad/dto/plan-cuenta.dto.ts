import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const PATRON_CODIGO = /^\d+(\.\d+)*$/;
const MENSAJE_CODIGO = 'El código debe contener solo números separados por puntos (ej: 1.1.1.01)';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearCuentaDto {
  @ApiProperty({ description: 'Nomenclatura contable única', example: '1.1.1.01' })
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @Matches(PATRON_CODIGO, { message: MENSAJE_CODIGO })
  @MaxLength(20, { message: 'El código no puede exceder 20 caracteres' })
  codigo: string;

  @ApiProperty({ description: 'Título de la cuenta', example: 'Caja General' })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre: string;

  @ApiPropertyOptional({ description: 'ID de la cuenta padre (para subcuentas)' })
  @IsOptional()
  @IsUUID(4, { message: 'El ID de la cuenta padre debe ser un UUID válido' })
  cuentaPadreId?: string;

  @ApiPropertyOptional({ description: 'Acepta movimientos directos', default: false })
  @IsOptional()
  @IsBoolean({ message: 'esTransaccional debe ser un booleano' })
  esTransaccional?: boolean;
}

export class ActualizarCuentaDto {
  @ApiPropertyOptional({ description: 'Nomenclatura contable única', example: '1.1.1.01' })
  @IsOptional()
  @IsString({ message: 'El código debe ser una cadena de texto' })
  @Matches(PATRON_CODIGO, { message: MENSAJE_CODIGO })
  @MaxLength(20, { message: 'El código no puede exceder 20 caracteres' })
  codigo?: string;

  @ApiPropertyOptional({ description: 'Título de la cuenta', example: 'Caja General' })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @MaxLength(255, { message: 'El nombre no puede exceder 255 caracteres' })
  nombre?: string;

  @ApiPropertyOptional({ description: 'ID de la cuenta padre (para subcuentas)' })
  @IsOptional()
  @IsUUID(4, { message: 'El ID de la cuenta padre debe ser un UUID válido' })
  cuentaPadreId?: string;

  @ApiPropertyOptional({ description: 'Acepta movimientos directos' })
  @IsOptional()
  @IsBoolean({ message: 'esTransaccional debe ser un booleano' })
  esTransaccional?: boolean;
}
