import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { EmpresaService } from './empresa.service.js';
import type { CrearEmpresaDto, ActualizarEmpresaDto } from './empresa.service.js';

@ApiTags('Empresas')
@Controller('empresas')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva empresa' })
  @ApiResponse({ status: 201, description: 'Empresa creada' })
  @ApiResponse({ status: 409, description: 'RIF ya existe' })
  async crear(@Req() req: any, @Body() dto: CrearEmpresaDto) {
    return this.empresaService.crear(req.user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar empresas del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de empresas' })
  async listar(@Req() req: any) {
    return this.empresaService.buscarPorUsuario(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estadísticas de empresas' })
  @ApiResponse({ status: 200 })
  async stats(@Req() req: any) {
    return this.empresaService.obtenerEstadisticas(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener empresa por ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async obtener(@Req() req: any, @Param('id') id: string) {
    return this.empresaService.buscarPorId(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar empresa' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  @ApiResponse({ status: 409, description: 'RIF ya existe' })
  async actualizar(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.empresaService.actualizar(id, req.user.id, dto);
  }

  @Put(':id/activar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activar empresa' })
  @ApiResponse({ status: 200 })
  async activar(@Req() req: any, @Param('id') id: string) {
    await this.empresaService.activar(id, req.user.id);
    return { message: 'Empresa activada' };
  }

  @Put(':id/desactivar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar empresa' })
  @ApiResponse({ status: 200 })
  async desactivar(@Req() req: any, @Param('id') id: string) {
    await this.empresaService.desactivar(id, req.user.id);
    return { message: 'Empresa desactivada' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactivar empresa (soft delete)' })
  @ApiResponse({ status: 200 })
  async eliminar(@Req() req: any, @Param('id') id: string) {
    await this.empresaService.desactivar(id, req.user.id);
    return { message: 'Empresa desactivada' };
  }
}