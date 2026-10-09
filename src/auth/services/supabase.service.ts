import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient, User as SupabaseUser, Session } from '@supabase/supabase-js';
import { Usuario as User, UserProvider, UserRole } from '../entities/user.entity.js';

export interface SupabaseAuthResult {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;
  private adminClient: SupabaseClient | null = null;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeClients();
  }

  private initializeClients(): void {
    const url = this.configService.get<string>('supabase.url');
    const anonKey = this.configService.get<string>('supabase.anonKey');
    const serviceRoleKey = this.configService.get<string>('supabase.serviceRoleKey');

    if (url && anonKey) {
      this.client = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      if (serviceRoleKey) {
        this.adminClient = createClient(url, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      }

      this.isConfigured = true;
      this.logger.log('Supabase client initialized successfully');
    } else {
      this.logger.warn('Supabase not configured - running in local/testing mode');
      this.isConfigured = false;
    }
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  getAdminClient(): SupabaseClient | null {
    return this.adminClient;
  }

  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  // ==================== AUTENTICACIÓN GOOGLE ====================

  async signInWithGoogle(): Promise<{ url: string | null; error: Error | null }> {
    if (!this.client) {
      return { url: null, error: new Error('Supabase not configured') };
    }

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: this.configService.get<string>('googleOAuth.callbackUrl'),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    return { url: data.url ?? null, error: error ?? null };
  }

  async exchangeCodeForSession(code: string): Promise<SupabaseAuthResult> {
    if (!this.client) {
      return { user: null, session: null, error: new Error('Supabase not configured') };
    }

    const { data, error } = await this.client.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      return { user: null, session: null, error: error ?? new Error('No user returned') };
    }

    const user = this.mapSupabaseUser(data.user, data.session);
    return { user, session: data.session, error: null };
  }

  // ==================== GESTIÓN DE USUARIOS ====================

  async getUser(accessToken: string): Promise<SupabaseAuthResult> {
    if (!this.client) {
      return { user: null, session: null, error: new Error('Supabase not configured') };
    }

    const { data, error } = await this.client.auth.getUser(accessToken);

    if (error || !data.user) {
      return { user: null, session: null, error: error ?? new Error('User not found') };
    }

    const user = this.mapSupabaseUser(data.user, null);
    return { user, session: null, error: null };
  }

  async refreshSession(refreshToken: string): Promise<SupabaseAuthResult> {
    if (!this.client) {
      return { user: null, session: null, error: new Error('Supabase not configured') };
    }

    const { data, error } = await this.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.user || !data.session) {
      return { user: null, session: null, error: error ?? new Error('Failed to refresh session') };
    }

    const user = this.mapSupabaseUser(data.user, data.session);
    return { user, session: data.session, error: null };
  }

  async signOut(accessToken: string): Promise<{ error: Error | null }> {
    if (!this.client) {
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await this.client.auth.signOut({ scope: 'global' });
    return { error: error ?? null };
  }

  // ==================== ADMIN (Service Role) ====================

  async adminGetUserByEmail(email: string): Promise<User | null> {
    if (!this.adminClient) {
      this.logger.warn('Admin client not available (service role key missing)');
      return null;
    }

    const { data, error } = await this.adminClient.auth.admin.listUsers();

    if (error) {
      this.logger.error(`Error listing users: ${error.message}`);
      return null;
    }

    const supabaseUser = data.users.find((u) => u.email === email);
    return supabaseUser ? this.mapSupabaseUser(supabaseUser, null) : null;
  }

  async adminDeleteUser(userId: string): Promise<{ error: Error | null }> {
    if (!this.adminClient) {
      return { error: new Error('Admin client not available') };
    }

    const { error } = await this.adminClient.auth.admin.deleteUser(userId);
    return { error: error ?? null };
  }

  // ==================== HELPERS ====================

  private mapSupabaseUser(supabaseUser: SupabaseUser, session: Session | null): User {
    const user = new User();
    user.id = supabaseUser.id;
    user.correo = supabaseUser.email ?? '';
    user.nombreCompleto = supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null;
    user.urlAvatar = supabaseUser.user_metadata?.avatar_url ?? supabaseUser.user_metadata?.picture ?? null;
    user.proveedor = UserProvider.SUPABASE;
    user.proveedorId = supabaseUser.id;
    user.correoVerificado = !!supabaseUser.email_confirmed_at;
    user.ultimoLogin = supabaseUser.last_sign_in_at ? new Date(supabaseUser.last_sign_in_at) : null;
    user.creadoEn = new Date(supabaseUser.created_at);
    user.actualizadoEn = new Date(supabaseUser.updated_at ?? supabaseUser.created_at);
    user.activo = true;
    user.roles = [UserRole.USUARIO]; // Por defecto, se puede extender con metadata

    // Si hay session, podríamos extraer tokens
    return user;
  }

  // ==================== UTILIDADES ====================

  async verifyIdToken(idToken: string): Promise<{ user: User | null; error: Error | null }> {
    if (!this.client) {
      return { user: null, error: new Error('Supabase not configured') };
    }

    const { data, error } = await this.client.auth.getUser(idToken);

    if (error || !data.user) {
      return { user: null, error: error ?? new Error('Invalid token') };
    }

    return { user: this.mapSupabaseUser(data.user, null), error: null };
  }
}