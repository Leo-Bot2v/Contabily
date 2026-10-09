import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
import { CuentasFinancierasService } from './services/cuentas-financieras.service.js';
import { TransaccionesService } from './services/transacciones.service.js';
import { TipoTransaccion } from './entities/transaccion.entity.js';
import {
  CrearCuentaFinancieraDto,
  RegistrarMovimientoDto,
  TransferenciaDto,
} from './dto/cajas.dto.js';

@ApiTags('Cajas y Bancos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('cajas')
export class CajasController {
  constructor(
    private readonly cuentasFinancierasService: CuentasFinancierasService,
    private readonly transaccionesService: TransaccionesService,
  ) {}

  // ==================== CUENTAS FINANCIERAS ====================

  @Post('cuentas')
  @ApiOperation({ summary: 'Crear una caja o cuenta bancaria (vinculada al plan de cuentas)' })
  @ApiResponse({ status: 201, description: 'Cuenta financiera creada' })
  @ApiResponse({ status: 400, description: 'La cuenta contable no existe, no es transaccional, o falta cuentaAperturaId con saldoInicial > 0' })
  crearCuenta(@Body() dto: CrearCuentaFinancieraDto) {
    return this.cuentasFinancierasService.crearCuentaFinanciera(dto);
  }

  @Get('cuentas')
  @ApiOperation({ summary: 'Listar cajas y bancos con sus saldos actuales' })
  @ApiResponse({ status: 200, description: 'Lista de cuentas financieras' })
  listarCuentas() {
    return this.cuentasFinancierasService.listarCuentasFinancieras();
  }

  @Get('cuentas/:id/saldo')
  @ApiOperation({ summary: 'Consultar el saldo actual de una caja o banco' })
  @ApiResponse({ status: 200, description: 'Saldo actual' })
  @ApiResponse({ status: 404, description: 'Cuenta no encontrada' })
  obtenerSaldo(@Param('id') id: string) {
    return this.cuentasFinancierasService.obtenerSaldoActual(id);
  }

  // ==================== TRANSACCIONES ====================

  @Post('ingresos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar un ingreso (suma saldo y genera asiento contable)' })
  @ApiResponse({ status: 200, description: 'Ingreso registrado con asiento equilibrado' })
  @ApiResponse({ status: 400, description: 'Cuenta contable no transaccional o vinculada a una caja' })
  registrarIngreso(@Body() dto: RegistrarMovimientoDto) {
    return this.transaccionesService.registrarIngreso(dto);
  }

  @Post('egresos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar un egreso (valida saldo suficiente y genera asiento)' })
  @ApiResponse({ status: 200, description: 'Egreso registrado con asiento equilibrado' })
  @ApiResponse({ status: 400, description: 'Saldo insuficiente, o cuenta contra vinculada a una caja' })
  registrarEgreso(@Body() dto: RegistrarMovimientoDto) {
    return this.transaccionesService.registrarEgreso(dto);
  }

  @Post('transferencias')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transferir dinero entre cuentas (atómico: resta origen, suma destino)' })
  @ApiResponse({ status: 200, description: 'Transferencia realizada' })
  @ApiResponse({ status: 400, description: 'Saldo insuficiente o cuentas iguales' })
  realizarTransferencia(@Body() dto: TransferenciaDto) {
    return this.transaccionesService.realizarTransferencia(dto);
  }

  @Get('transacciones')
  @ApiOperation({ summary: 'Historial de transacciones con filtros opcionales' })
  @ApiResponse({ status: 200, description: 'Últimas 100 transacciones' })
  listarTransacciones(
    @Query('cuentaId') cuentaId?: string,
    @Query('tipo') tipo?: TipoTransaccion,
  ) {
    return this.transaccionesService.listarTransacciones({ cuentaId, tipo });
  }
}
