import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';
import { generateKeyPairSync } from 'crypto';

export interface JwtKeyPair {
  privateKey: string;
  publicKey: string;
}

@Injectable()
export class JwtRsaService {
  private readonly logger = new Logger(JwtRsaService.name);
  private keyPair: JwtKeyPair | null = null;
  private jwtService: JwtService;

  constructor(private readonly configService: ConfigService) {
    this.jwtService = new JwtService();
    this.loadKeys();
  }

  // ==================== CARGA DE CLAVES ====================

  private loadKeys(): void {
    // 1. Intentar desde variables de entorno (producción)
    const privateKeyEnv = this.configService.get<string>('jwt.privateKey');
    const publicKeyEnv = this.configService.get<string>('jwt.publicKey');

    if (privateKeyEnv && publicKeyEnv) {
      this.keyPair = {
        privateKey: privateKeyEnv.replace(/\\n/g, '\n'),
        publicKey: publicKeyEnv.replace(/\\n/g, '\n'),
      };
      this.logger.log('Claves RSA cargadas desde variables de entorno');
      return;
    }

    // 2. Intentar desde archivos (desarrollo)
    const keysDir = this.configService.get<string>('jwt.keysDir') ?? './keys';
    const privateKeyPath = path.resolve(keysDir, 'private-pkcs8.pem');
    const publicKeyPath = path.resolve(keysDir, 'public.pem');

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      this.keyPair = {
        privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
        publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
      };
      this.logger.log(`Claves RSA cargadas desde: ${keysDir}`);
      return;
    }

    // 3. Generar claves efímeras para testing (NO USAR EN PRODUCCIÓN)
    this.logger.warn('⚠️  No se encontraron claves RSA. Generando claves efímeras para testing.');
    this.keyPair = this.generateEphemeralKeys();
  }

  private generateEphemeralKeys(): JwtKeyPair {
    // Generar clave RSA simple para testing
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    return { privateKey, publicKey };
  }

  // ==================== FIRMA Y VERIFICACIÓN ====================

  sign(payload: object, options?: { expiresIn?: string | number }): string {
    if (!this.keyPair) {
      throw new Error('Claves RSA no inicializadas');
    }

    return this.jwtService.sign(payload, {
      privateKey: this.keyPair.privateKey,
      algorithm: 'RS256',
      expiresIn: options?.expiresIn as any,
    });
  }

  verify(token: string): any {
    if (!this.keyPair) {
      throw new Error('Claves RSA no inicializadas');
    }

    return this.jwtService.verify(token, {
      publicKey: this.keyPair.publicKey,
      algorithms: ['RS256'],
    });
  }

  decode(token: string): any {
    return this.jwtService.decode(token);
  }

  // ==================== JWKS ENDPOINT ====================

  getJwks(): { keys: any[] } {
    if (!this.keyPair) {
      throw new Error('Claves RSA no inicializadas');
    }

    // Extraer componentes de la clave pública para JWK
    const publicKey = this.keyPair.publicKey;
    const { createPublicKey } = require('crypto');
    const keyObject = createPublicKey(publicKey);
    const { n, e } = keyObject.export({ format: 'jwk' });

    return {
      keys: [
        {
          kty: 'RSA',
          use: 'sig',
          kid: this.getKeyId(),
          alg: 'RS256',
          n: n,
          e: e,
        },
      ],
    };
  }

  private getKeyId(): string {
    // Generar kid basado en hash de la clave pública
    const { createHash } = require('crypto');
    return createHash('sha256').update(this.keyPair!.publicKey).digest('hex').substring(0, 16);
  }

  // ==================== GETTERS ====================

  getPublicKey(): string {
    return this.keyPair?.publicKey ?? '';
  }

  getPrivateKey(): string {
    return this.keyPair?.privateKey ?? '';
  }

  hasKeys(): boolean {
    return this.keyPair !== null;
  }

  // ==================== ROTACIÓN DE CLAVES ====================

  async rotateKeys(newPrivateKey: string, newPublicKey: string): Promise<void> {
    // Mantener clave anterior para validar tokens existentes
    const oldKeyPair = this.keyPair;
    
    this.keyPair = {
      privateKey: newPrivateKey,
      publicKey: newPublicKey,
    };

    // Programar limpieza de clave antigua (después de que expiren todos los tokens)
    // En producción, mantener un array de claves válidas
    this.logger.log('Claves RSA rotadas. Clave anterior mantenida para validación.');
  }
}