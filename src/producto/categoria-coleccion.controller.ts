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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CategoriaColeccionService } from './categoria-coleccion.service.js';

@ApiTags('Categorías y Colecciones')
@Controller('categorias-colecciones')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class CategoriaColeccionController {
  constructor(private readonly service: CategoriaColeccionService) {}

  // ==================== CATEGORÍAS ====================

  @Post('categorias')
  @ApiOperation({ summary: 'Crear categoría' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Slug ya existe' })
  async crearCategoria(@Body() dto: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.crearCategoria(empresaId, dto);
  }

  @Get('categorias')
  @ApiOperation({ summary: 'Listar categorías (plano)' })
  @ApiResponse({ status: 200 })
  async listarCategorias(@Query() filtro: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.listarCategorias(empresaId, filtro);
  }

  @Get('categorias/arbol')
  @ApiOperation({ summary: 'Árbol de categorías (jerárquico)' })
  @ApiResponse({ status: 200 })
  async arbolCategorias() {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.arbolCategorias(empresaId);
  }

  @Get('categorias/:id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async obtenerCategoria(@Param('id') id: string) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.obtenerCategoria(id, empresaId);
  }

  @Put('categorias/:id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  @ApiResponse({ status: 409, description: 'Slug ya existe o ciclo en jerarquía' })
  async actualizarCategoria(@Param('id') id: string, @Body() dto: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.actualizarCategoria(id, empresaId, dto);
  }

  @Delete('categorias/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar categoría' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  @ApiResponse({ status: 409, description: 'Tiene subcategorías o productos' })
  async eliminarCategoria(@Param('id') id: string) {
    const empresaId = 'empresa-id-desde-contexto';
    await this.service.eliminarCategoria(id, empresaId);
    return { message: 'Categoría eliminada' };
  }

  // ==================== COLECCIONES ====================

  @Post('colecciones')
  @ApiOperation({ summary: 'Crear colección' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'Slug ya existe' })
  async crearColeccion(@Body() dto: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.crearColeccion(empresaId, dto);
  }

  @Get('colecciones')
  @ApiOperation({ summary: 'Listar colecciones' })
  @ApiResponse({ status: 200 })
  async listarColecciones(@Query() filtro: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.listarColecciones(empresaId, filtro);
  }

  @Get('colecciones/:id')
  @ApiOperation({ summary: 'Obtener colección por ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  async obtenerColeccion(@Param('id') id: string) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.obtenerColeccion(id, empresaId);
  }

  @Put('colecciones/:id')
  @ApiOperation({ summary: 'Actualizar colección' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  @ApiResponse({ status: 409, description: 'Slug ya existe' })
  async actualizarColeccion(@Param('id') id: string, @Body() dto: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.actualizarColeccion(id, empresaId, dto);
  }

  @Post('colecciones/:id/productos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agregar productos a colección' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrados' })
  async agregarProductos(@Param('id') id: string, @Body() dto: { productoIds: string[] }) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.agregarProductos(id, empresaId, dto);
  }

  @Delete('colecciones/:id/productos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover productos de colección' })
  @ApiResponse({ status: 200 })
  async removerProductos(@Param('id') id: string, @Body() dto: { productoIds: string[] }) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.service.removerProductos(id, empresaId, dto);
  }

  @Delete('colecciones/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar colección' })
  @ApiResponse({ status: 200 })
  async eliminarColeccion(@Param('id') id: string) {
    const empresaId = 'empresa-id-desde-contexto';
    await this.service.eliminarColeccion(id, empresaId);
    return { message: 'Colección eliminada' };
  }
}