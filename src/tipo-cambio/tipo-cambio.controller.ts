import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TipoCambio } from './entities/tipo-cambio.entity.js';
import { TipoCambioService } from './services/tipo-cambio.service.js';

@ApiTags('Tipo de cambio')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tipo-cambio')
export class TipoCambioController {
  constructor(private readonly tipoCambioService: TipoCambioService) {}

  @Get()
  @ApiOperation({
    summary: 'Tasa de cambio oficial vigente (USD→BOB, Banco Central de Bolivia vía Cucu)',
  })
  @ApiOkResponse({ type: TipoCambio })
  obtenerTasaVigente(): Promise<TipoCambio> {
    return this.tipoCambioService.obtenerTasaVigente();
  }
}
