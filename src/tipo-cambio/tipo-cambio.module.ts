import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

import { TipoCambioController } from './tipo-cambio.controller.js';
import { TipoCambioService } from './services/tipo-cambio.service.js';
import { TipoCambio } from './entities/tipo-cambio.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([TipoCambio]), HttpModule.register({ timeout: 10000 })],
  controllers: [TipoCambioController],
  providers: [TipoCambioService],
  exports: [TipoCambioService],
})
export class TipoCambioModule {}
