import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

import { TipoCambio } from '../entities/tipo-cambio.entity.js';

interface RespuestaCucu {
  tc_oficial?: { valor?: number; fecha?: string; moneda?: string };
}

@Injectable()
export class TipoCambioService {
  private readonly logger = new Logger(TipoCambioService.name);
  private readonly API_URL = 'https://apibcb.cucu.bo/api/v1/tc/oficial';

  constructor(
    @InjectRepository(TipoCambio)
    private readonly tiposCambioRepo: Repository<TipoCambio>,
    private readonly http: HttpService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async sincronizarTasaDiaria(): Promise<void> {
    try {
      const tasa = await this.obtenerTasaDesdeApi();
      this.logger.log(
        `Tipo de cambio sincronizado: ${tasa.monedaOrigen}/${tasa.monedaDestino} = ${tasa.tasa} (${tasa.fecha})`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo sincronizar el tipo de cambio: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async obtenerTasaVigente(): Promise<TipoCambio> {
    return this.obtenerTasaDelDia(this.hoy());
  }

  async obtenerTasaDelDia(fecha: string = this.hoy()): Promise<TipoCambio> {
    const delDia = await this.tiposCambioRepo.findOne({ where: { fecha } });
    if (delDia) {
      return delDia;
    }

    try {
      return await this.obtenerTasaDesdeApi();
    } catch (error) {
      this.logger.warn(
        `API de Cucu no disponible: ${error instanceof Error ? error.message : String(error)}; se usa la última tasa registrada`,
      );
    }

    const ultima = await this.tiposCambioRepo
      .createQueryBuilder('tc')
      .where('tc.fecha <= :fecha', { fecha })
      .orderBy('tc.fecha', 'DESC')
      .limit(1)
      .getOne();

    if (ultima) {
      return ultima;
    }

    throw new ServiceUnavailableException(
      'No hay tipo de cambio disponible: sin registro local y la API de Cucu no responde',
    );
  }

  private async obtenerTasaDesdeApi(): Promise<TipoCambio> {
    const { data } = await firstValueFrom(
      this.http.get<RespuestaCucu>(this.API_URL, { timeout: 10000 }),
    );
    const tc = data?.tc_oficial;
    if (!tc || typeof tc.valor !== 'number' || typeof tc.fecha !== 'string') {
      throw new Error('Respuesta inesperada de la API de Cucu');
    }
    return this.guardarTasa(tc.fecha, tc.valor, 'USD', 'BOB');
  }

  private async guardarTasa(
    fecha: string,
    tasa: number,
    monedaOrigen: string,
    monedaDestino: string,
  ): Promise<TipoCambio> {
    const existente = await this.tiposCambioRepo.findOne({ where: { fecha } });
    const registro =
      existente ?? this.tiposCambioRepo.create({ fecha, monedaOrigen, monedaDestino });
    registro.tasa = Number(tasa).toFixed(4);
    registro.monedaOrigen = monedaOrigen;
    registro.monedaDestino = monedaDestino;
    return this.tiposCambioRepo.save(registro);
  }

  private hoy(): string {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }
}
