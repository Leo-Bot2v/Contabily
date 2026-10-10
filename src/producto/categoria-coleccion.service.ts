import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Categoria } from './entities/categoria.entity.js';
import { Coleccion, TipoColeccion, CondicionColeccion, ReglaColeccion, CondicionesColeccion } from './entities/coleccion.entity.js';
import { Producto } from './entities/producto.entity.js';

@Injectable()
export class CategoriaColeccionService {
  private readonly logger = new Logger(CategoriaColeccionService.name);

  constructor(
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
    @InjectRepository(Coleccion)
    private readonly coleccionRepository: Repository<Coleccion>,
    @InjectRepository(Producto)
    private readonly productoRepository: Repository<Producto>,
  ) {}

  // ==================== CATEGORÍAS ====================

  async crearCategoria(empresaId: string, dto: any): Promise<Categoria> {
    // Verificar slug único
    if (dto.slug) {
      const existe = await this.categoriaRepository.findOne({
        where: { empresaId, slug: dto.slug },
      });
      if (existe) {
        throw new ConflictException(`Ya existe una categoría con ese slug`);
      }
    } else if (dto.nombre) {
      dto.slug = this.generarSlug(dto.nombre);
      const existe = await this.categoriaRepository.findOne({
        where: { empresaId, slug: dto.slug },
      });
      if (existe) {
        dto.slug = `${dto.slug}-${Date.now()}`;
      }
    }

    // Validar padre si se proporciona
    if (dto.padreId) {
      const padre = await this.categoriaRepository.findOne({
        where: { id: dto.padreId, empresaId },
      });
      if (!padre) {
        throw new NotFoundException('Categoría padre no encontrada');
      }
    }

    const categoria = this.categoriaRepository.create({
      ...dto,
      empresaId,
    });

    const guardada = await this.categoriaRepository.save(categoria) as unknown as Categoria;
    this.logger.log(`Categoría creada: ${guardada.nombre}`);
    return guardada;
  }

  async obtenerCategoria(id: string, empresaId: string): Promise<Categoria> {
    const categoria = await this.categoriaRepository.findOne({
      where: { id, empresaId },
      relations: { hijos: true, padre: true },
    });
    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return categoria;
  }

  async listarCategorias(empresaId: string, filtro: any = {}): Promise<Categoria[]> {
    const query = this.categoriaRepository.createQueryBuilder('categoria')
      .leftJoinAndSelect('categoria.hijos', 'hijos')
      .where('categoria.empresaId = :empresaId', { empresaId });

    if (filtro.activa !== undefined) {
      query.andWhere('categoria.activa = :activa', { activa: filtro.activa });
    }

    if (filtro.padreId === null) {
      query.andWhere('categoria.padreId IS NULL');
    } else if (filtro.padreId) {
      query.andWhere('categoria.padreId = :padreId', { padreId: filtro.padreId });
    }

    if (filtro.busqueda) {
      query.andWhere('categoria.nombre ILIKE :busqueda', { busqueda: `%${filtro.busqueda}%` });
    }

    query.orderBy('categoria.orden', 'ASC').addOrderBy('categoria.nombre', 'ASC');

    return query.getMany();
  }

  async arbolCategorias(empresaId: string): Promise<Categoria[]> {
    // Obtener solo categorías raíz y sus hijos recursivamente
    const raices = await this.categoriaRepository.find({
      where: { empresaId, padre: IsNull(), activa: true },
      order: { orden: 'ASC', nombre: 'ASC' },
    });

    const cargarHijos = async (categorias: Categoria[]): Promise<Categoria[]> => {
      for (const cat of categorias) {
        cat.hijos = await this.categoriaRepository.find({
          where: { padre: { id: cat.id }, activa: true },
          order: { orden: 'ASC', nombre: 'ASC' },
        });
        if (cat.hijos.length > 0) {
          await cargarHijos(cat.hijos);
        }
      }
      return categorias;
    };

    return cargarHijos(raices);
  }

  async actualizarCategoria(id: string, empresaId: string, dto: any): Promise<Categoria> {
    const categoria = await this.obtenerCategoria(id, empresaId);

    if (dto.slug && dto.slug !== categoria.slug) {
      const existe = await this.categoriaRepository.findOne({
        where: { empresaId, slug: dto.slug },
      });
      if (existe) {
        throw new ConflictException('Ya existe una categoría con ese slug');
      }
    }

    if (dto.padreId) {
      if (dto.padreId === id) {
        throw new ConflictException('Una categoría no puede ser su propio padre');
      }
      const padre = await this.categoriaRepository.findOne({
        where: { id: dto.padreId, empresaId },
      });
      if (!padre) {
        throw new NotFoundException('Categoría padre no encontrada');
      }
      // Verificar que no sea descendiente
      let actual: Categoria | null = padre;
      while (actual) {
        if (actual.id === id) {
          throw new ConflictException('No se puede crear un ciclo en la jerarquía');
        }
        actual = await this.categoriaRepository.findOne({
          where: { id: actual.padre?.id },
        });
      }
    }

    Object.assign(categoria, dto);
    const actualizada = await this.categoriaRepository.save(categoria);
    this.logger.log(`Categoría actualizada: ${actualizada.nombre}`);
    return actualizada;
  }

  async eliminarCategoria(id: string, empresaId: string): Promise<void> {
    const categoria = await this.obtenerCategoria(id, empresaId);

    // Verificar si tiene hijos
    const hijos = await this.categoriaRepository.count({
      where: { padre: { id: id } },
    });
    if (hijos > 0) {
      throw new ConflictException('No se puede eliminar una categoría que tiene subcategorías');
    }

    // Verificar si tiene productos
    const productos = await this.productoRepository.count({
      where: { categoriaId: id },
    });
    if (productos > 0) {
      throw new ConflictException('No se puede eliminar una categoría que tiene productos asignados');
    }

    await this.categoriaRepository.softRemove(categoria);
    this.logger.log(`Categoría eliminada: ${categoria.nombre}`);
  }

  // ==================== COLECCIONES ====================

  async crearColeccion(empresaId: string, dto: any): Promise<Coleccion> {
    if (dto.slug) {
      const existe = await this.coleccionRepository.findOne({
        where: { empresaId, slug: dto.slug },
      });
      if (existe) {
        throw new ConflictException('Ya existe una colección con ese slug');
      }
    } else if (dto.nombre) {
      dto.slug = this.generarSlug(dto.nombre);
      const existe = await this.coleccionRepository.findOne({
        where: { empresaId, slug: dto.slug },
      });
      if (existe) {
        dto.slug = `${dto.slug}-${Date.now()}`;
      }
    }

    const coleccion = this.coleccionRepository.create({
      ...dto,
      empresaId,
    });

    const guardada = await this.coleccionRepository.save(coleccion) as unknown as Coleccion;
    this.logger.log(`Colección creada: ${guardada.nombre}`);
    return guardada;
  }

  async obtenerColeccion(id: string, empresaId: string): Promise<Coleccion> {
    const coleccion = await this.coleccionRepository.findOne({
      where: { id, empresaId },
      relations: { productos: true },
    });
    if (!coleccion) {
      throw new NotFoundException('Colección no encontrada');
    }
    return coleccion;
  }

  async listarColecciones(empresaId: string, filtro: any = {}): Promise<{ data: Coleccion[]; total: number }> {
    const query = this.coleccionRepository.createQueryBuilder('coleccion')
      .where('coleccion.empresaId = :empresaId', { empresaId });

    if (filtro.activa !== undefined) {
      query.andWhere('coleccion.activa = :activa', { activa: filtro.activa });
    }

    if (filtro.tipo) {
      query.andWhere('coleccion.tipo = :tipo', { tipo: filtro.tipo });
    }

    if (filtro.busqueda) {
      query.andWhere('coleccion.nombre ILIKE :busqueda', { busqueda: `%${filtro.busqueda}%` });
    }

    const total = await query.getCount();

    const pagina = filtro.pagina || 1;
    const limite = filtro.limite || 20;
    const ordenarPor = filtro.ordenarPor || 'orden';
    const orden = filtro.orden || 'ASC';

    query.orderBy(`coleccion.${ordenarPor}`, orden);
    query.skip((pagina - 1) * limite).take(limite);

    const data = await query.getMany();
    return { data, total };
  }

  async actualizarColeccion(id: string, empresaId: string, dto: any): Promise<Coleccion> {
    const coleccion = await this.obtenerColeccion(id, empresaId);

    if (dto.slug && dto.slug !== coleccion.slug) {
      const existe = await this.coleccionRepository.findOne({
        where: { empresaId, slug: dto.slug },
      });
      if (existe) {
        throw new ConflictException('Ya existe una colección con ese slug');
      }
    }

    // Actualizar productos si se proporcionan
    if (dto.productoIds) {
      const productos = await this.productoRepository.find({
        where: { id: In(dto.productoIds), empresaId },
      });
      if (productos.length !== dto.productoIds.length) {
        throw new NotFoundException('Uno o más productos no encontrados');
      }
      coleccion.productos = productos;
    }

    Object.assign(coleccion, dto);
    const actualizada = await this.coleccionRepository.save(coleccion);
    this.logger.log(`Colección actualizada: ${actualizada.nombre}`);
    return actualizada;
  }

  async agregarProductos(id: string, empresaId: string, dto: { productoIds: string[] }): Promise<Coleccion> {
    const coleccion = await this.obtenerColeccion(id, empresaId);

    const productos = await this.productoRepository.find({
      where: { id: In(dto.productoIds), empresaId },
    });
    if (productos.length !== dto.productoIds.length) {
      throw new NotFoundException('Uno o más productos no encontrados');
    }

    // Agregar solo los que no estén ya
    const idsActuales = coleccion.productos?.map((p: Producto) => p.id) || [];
    const nuevos = productos.filter((p: Producto) => !idsActuales.includes(p.id));
    coleccion.productos = [...(coleccion.productos || []), ...nuevos];

    const actualizada = await this.coleccionRepository.save(coleccion);
    this.logger.log(`Productos agregados a colección: ${actualizada.nombre}`);
    return actualizada;
  }

  async removerProductos(id: string, empresaId: string, dto: { productoIds: string[] }): Promise<Coleccion> {
    const coleccion = await this.obtenerColeccion(id, empresaId);

    const idsRemover = new Set(dto.productoIds);
    coleccion.productos = (coleccion.productos || []).filter((p: Producto) => !idsRemover.has(p.id));

    const actualizada = await this.coleccionRepository.save(coleccion);
    this.logger.log(`Productos removidos de colección: ${actualizada.nombre}`);
    return actualizada;
  }

  async eliminarColeccion(id: string, empresaId: string): Promise<void> {
    const coleccion = await this.obtenerColeccion(id, empresaId);
    await this.coleccionRepository.softRemove(coleccion);
    this.logger.log(`Colección eliminada: ${coleccion.nombre}`);
  }

  // ==================== UTILIDADES ====================

  private generarSlug(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
}