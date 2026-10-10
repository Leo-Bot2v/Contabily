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
import { ProductoService } from './producto.service.js';
import {
  CrearProductoDto,
  ActualizarProductoDto,
  FiltroProductoDto,
  AjusteStockDto,
  MovimientoStockDto,
} from './dto/producto.dto.js';
import {
  CrearVarianteDto,
  ActualizarVarianteDto,
  AjusteStockVarianteDto,
  GenerarVariantesDto,
} from './dto/variante.dto.js';
import {
  CrearCategoriaDto,
  ActualizarCategoriaDto,
  CrearColeccionDto,
  ActualizarColeccionDto,
  AgregarProductoColeccionDto,
  RemoverProductoColeccionDto,
} from './dto/categoria-coleccion.dto.js';
import {
  CrearMovimientoInventarioDto,
  FiltroMovimientoInventarioDto,
  ResumenInventarioDto,
  MovimientoMasivoDto,
} from './dto/inventario.dto.js';

@ApiTags('Productos')
@Controller('productos')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  // ==================== PRODUCTOS ====================

  @Post()
  @ApiOperation({ summary: 'Crear nuevo producto' })
  @ApiResponse({ status: 201, description: 'Producto creado' })
  @ApiResponse({ status: 409, description: 'SKU o código de barras ya existe' })
  async crear(@Body() dto: CrearProductoDto) {
    // empresaId se obtiene del usuario autenticado / contexto
    const empresaId = 'empresa-id-desde-contexto'; // TODO: obtener del usuario autenticado
    return this.productoService.crear(empresaId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar productos con filtros y paginación' })
  @ApiResponse({ status: 200, description: 'Lista paginada de productos' })
  async listar(@Query() filtro: FiltroProductoDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.listar(empresaId, filtro);
  }

  @Get('resumen-inventario')
  @ApiOperation({ summary: 'Resumen de inventario' })
  @ApiResponse({ status: 200 })
  async resumenInventario(@Query() filtro: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.obtenerResumenInventario(empresaId, filtro);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async obtener(@Param('id') id: string) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.buscarPorId(id, empresaId);
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: 'Obtener producto por SKU' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async obtenerPorSku(@Param('sku') sku: string) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.buscarPorSku(sku, empresaId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  @ApiResponse({ status: 409, description: 'SKU o código de barras ya existe' })
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarProductoDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.actualizar(id, empresaId, dto);
  }

  @Put(':id/stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajustar stock (productos sin variantes)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Producto con variantes o sin rastreo' })
  async ajustarStock(@Param('id') id: string, @Body() dto: AjusteStockDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.ajustarStock(id, empresaId, dto);
  }

  @Put(':id/mover-stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mover stock (entrada/salida/ajuste)' })
  @ApiResponse({ status: 200 })
  async moverStock(@Param('id') id: string, @Body() dto: MovimientoStockDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.moverStock(id, empresaId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar producto (soft delete)' })
  @ApiResponse({ status: 200 })
  async eliminar(@Param('id') id: string) {
    const empresaId = 'empresa-id-desde-contexto';
    await this.productoService.eliminar(id, empresaId);
    return { message: 'Producto eliminado' };
  }

  // ==================== VARIANTES ====================

  @Post(':id/variantes')
  @ApiOperation({ summary: 'Crear variante' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 409, description: 'SKU u opciones ya existen' })
  async crearVariante(@Param('id') id: string, @Body() dto: CrearVarianteDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.crearVariante(id, empresaId, dto);
  }

  @Get(':id/variantes')
  @ApiOperation({ summary: 'Listar variantes de un producto' })
  @ApiResponse({ status: 200 })
  async listarVariantes(@Param('id') id: string) {
    // Se obtienen via relations en buscarPorId
    const empresaId = 'empresa-id-desde-contexto';
    const producto = await this.productoService.buscarPorId(id, empresaId);
    return producto.variantes || [];
  }

  @Put('variantes/:varianteId')
  @ApiOperation({ summary: 'Actualizar variante' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  @ApiResponse({ status: 409, description: 'SKU u opciones ya existen' })
  async actualizarVariante(@Param('varianteId') varianteId: string, @Body() dto: ActualizarVarianteDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.actualizarVariante(varianteId, empresaId, dto);
  }

  @Put('variantes/:varianteId/stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ajustar stock de variante' })
  @ApiResponse({ status: 200 })
  async ajustarStockVariante(@Param('varianteId') varianteId: string, @Body() dto: AjusteStockVarianteDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.ajustarStockVariante(varianteId, empresaId, dto);
  }

  @Post(':id/variantes/generar')
  @ApiOperation({ summary: 'Generar variantes por combinaciones de opciones' })
  @ApiResponse({ status: 201 })
  async generarVariantes(@Param('id') id: string, @Body() dto: GenerarVariantesDto) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.generarVariantes(id, empresaId, dto);
  }

  @Delete('variantes/:varianteId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar variante' })
  @ApiResponse({ status: 200 })
  async eliminarVariante(@Param('varianteId') varianteId: string) {
    const empresaId = 'empresa-id-desde-contexto';
    await this.productoService.eliminarVariante(varianteId, empresaId);
    return { message: 'Variante eliminada' };
  }

  // ==================== MOVIMIENTOS INVENTARIO ====================

  @Get(':id/movimientos')
  @ApiOperation({ summary: 'Historial de movimientos de inventario' })
  @ApiResponse({ status: 200 })
  async obtenerMovimientos(@Param('id') id: string, @Query() filtro: any) {
    const empresaId = 'empresa-id-desde-contexto';
    filtro.productoId = id;
    return this.productoService.obtenerMovimientos(empresaId, filtro);
  }

  @Get('movimientos/todos')
  @ApiOperation({ summary: 'Todos los movimientos de inventario de la empresa' })
  @ApiResponse({ status: 200 })
  async obtenerTodosMovimientos(@Query() filtro: any) {
    const empresaId = 'empresa-id-desde-contexto';
    return this.productoService.obtenerMovimientos(empresaId, filtro);
  }
}