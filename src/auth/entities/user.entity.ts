import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  SUPABASE = 'supabase',
}

export enum UserRole {
  USUARIO = 'usuario',
  ADMIN = 'admin',
  CONTADOR = 'contador',
}

@Entity('usuarios')
@Unique(['correo'])
@Index(['proveedor', 'proveedorId'])
export class Usuario {
  @ApiProperty({ description: 'Identificador único del usuario', example: 'uuid-v4' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Correo electrónico del usuario', example: 'usuario@ejemplo.com' })
  @Column({ type: 'varchar', length: 255, name: 'correo' })
  correo: string;

  @ApiPropertyOptional({ description: 'Nombre completo del usuario' })
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'nombre_completo' })
  nombreCompleto: string | null;

  @ApiPropertyOptional({ description: 'URL del avatar/foto de perfil' })
  @Column({ type: 'text', nullable: true, name: 'url_avatar' })
  urlAvatar: string | null;

  @ApiProperty({ description: 'Proveedor de autenticación', enum: UserProvider })
  @Column({
    type: 'enum',
    enum: UserProvider,
    default: UserProvider.LOCAL,
    name: 'proveedor',
  })
  proveedor: UserProvider;

  @ApiPropertyOptional({ description: 'ID del usuario en el proveedor externo (Google, Supabase)' })
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'proveedor_id' })
  proveedorId: string | null;

  @Exclude()
  @ApiPropertyOptional({ description: 'Contraseña hasheada (solo para auth local)' })
  @Column({ type: 'varchar', length: 255, nullable: true, select: false, name: 'hash_contrasena' })
  hashContrasena: string | null;

  @Exclude()
  @ApiPropertyOptional({ description: 'Refresh token hasheado para renovación de sesión' })
  @Column({ type: 'text', nullable: true, select: false, name: 'hash_refresh_token' })
  hashRefreshToken: string | null;

  @ApiProperty({ description: 'Roles del usuario', enum: UserRole, isArray: true, example: [UserRole.USUARIO] })
  @Column({
    type: 'enum',
    enum: UserRole,
    array: true,
    default: [UserRole.USUARIO],
    name: 'roles',
  })
  roles: UserRole[];

  @ApiProperty({ description: 'Si el usuario está activo', default: true })
  @Column({ type: 'boolean', default: true, name: 'activo' })
  activo: boolean;

  @ApiProperty({ description: 'Si el correo ha sido verificado', default: false })
  @Column({ type: 'boolean', default: false, name: 'correo_verificado' })
  correoVerificado: boolean;

  @ApiProperty({ description: 'Fecha de último inicio de sesión' })
  @Column({ type: 'timestamptz', nullable: true, name: 'ultimo_login' })
  ultimoLogin: Date | null;

  @ApiProperty({ description: 'Fecha de creación' })
  @CreateDateColumn({ type: 'timestamptz', name: 'creado_en' })
  creadoEn: Date;

  @ApiProperty({ description: 'Fecha de última actualización' })
  @UpdateDateColumn({ type: 'timestamptz', name: 'actualizado_en' })
  actualizadoEn: Date;

  @ApiPropertyOptional({ description: 'Fecha de eliminación suave' })
  @Column({ type: 'timestamptz', nullable: true, name: 'eliminado_en' })
  eliminadoEn: Date | null;

  // Métodos de conveniencia
  tieneRol(rol: UserRole): boolean {
    return this.roles.includes(rol);
  }

  esAdmin(): boolean {
    return this.tieneRol(UserRole.ADMIN);
  }

  aPerfilPublico() {
    const { hashContrasena, hashRefreshToken, ...datosPublicos } = this;
    return datosPublicos;
  }
}

export { Usuario as User };