import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpresaController } from './empresa.controller.js';
import { EmpresaService } from './empresa.service.js';
import { Empresa } from './entities/empresa.entity.js';
import { Usuario } from '../auth/entities/user.entity.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Empresa, Usuario]),
    AuthModule,
  ],
  controllers: [EmpresaController],
  providers: [EmpresaService],
  exports: [EmpresaService, TypeOrmModule],
})
export class EmpresaModule {}