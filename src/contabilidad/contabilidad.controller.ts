import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PlanCuentasService } from './services/plan-cuentas.service.js';
import { AsientosService } from './services/asientos.service.js';
import { CrearCuentaDto, ActualizarCuentaDto } from './dto/plan-cuenta.dto.js';

@ApiTags('Contabilidad')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('contabilidad')
export class ContabilidadController {
  constructor(
    private readonly planCuentasService: PlanCuentasService,
    private readonly asientosService: AsientosService,
  ) {}

  @Post('plan-cuentas')
  @ApiOperation({ summary: 'Crear una cuenta contable (valida código único)' })
  @ApiResponse({ status: 201, description: 'Cuenta creada' })
  @ApiResponse({ status: 409, description: 'Código ya registrado' })
  crearCuenta(@Body() dto: CrearCuentaDto) {
    return this.planCuentasService.crearCuenta(dto);
  }

  @Get('plan-cuentas')
  @ApiOperation({ summary: 'Listar todas las cuentas del plan (planas, ordenadas por código)' })
  @ApiResponse({ status: 200, description: 'Lista plana de cuentas contables' })
  obtenerCuentas() {
    return this.planCuentasService.obtenerCuentas();
  }

  @Get('plan-cuentas/arbol')
  @ApiOperation({ summary: 'Obtener el plan de cuentas como árbol jerárquico' })
  @ApiResponse({ status: 200, description: 'Árbol de cuentas (padres e hijos)' })
  obtenerArbol() {
    return this.planCuentasService.obtenerArbolCuentas();
  }

  @Patch('plan-cuentas/:id')
  @ApiOperation({ summary: 'Actualizar una cuenta contable existente' })
  @ApiResponse({ status: 200, description: 'Cuenta actualizada' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  actualizarCuenta(@Param('id') id: string, @Body() dto: ActualizarCuentaDto) {
    return this.planCuentasService.actualizarCuenta(id, dto);
  }

  @Delete('plan-cuentas/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar una cuenta contable (valida que no tenga dependencias)' })
  @ApiResponse({ status: 200, description: 'Cuenta eliminada' })
  @ApiResponse({ status: 400, description: 'La cuenta tiene subcuentas, cajas o asientos asociados' })
  eliminarCuenta(@Param('id') id: string) {
    return this.planCuentasService.eliminarCuenta(id);
  }

  @Get('asientos')
  @ApiOperation({ summary: 'Libro diario: listar asientos contables con sus detalles' })
  @ApiResponse({ status: 200, description: 'Lista de asientos con partidas debe/haber' })
  obtenerAsientos() {
    return this.asientosService.obtenerAsientos();
  }
}
