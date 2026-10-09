import { Module, Global, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// In-memory fallback for when Redis is not available
class InMemoryStore {
  private store = new Map<string, { value: string; expiry?: number }>();
  private intervals = new Map<string, NodeJS.Timeout>();

  async connect(): Promise<void> { /* noop */ }
  async ping(): Promise<string> { return 'PONG'; }
  async quit(): Promise<string> { return 'OK'; }
  on(event: string, handler: Function): void { /* noop */ }

  async setEx(key: string, ttl: number, value: string): Promise<'OK'> {
    const expiry = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiry });
    this.clearExpiry(key);
    this.intervals.set(key, setTimeout(() => this.store.delete(key), ttl * 1000));
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.store.delete(key);
      return 0;
    }
    return 1;
  }

  async del(key: string): Promise<number> {
    this.clearExpiry(key);
    return this.store.delete(key) ? 1 : 0;
  }

  async sAdd(key: string, ...members: string[]): Promise<number> {
    const entry = this.store.get(key);
    const set = entry ? new Set(JSON.parse(entry.value)) : new Set();
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    await this.setEx(key, 86400, JSON.stringify([...set]));
    return added;
  }

  async sMembers(key: string): Promise<string[]> {
    const entry = this.store.get(key);
    if (!entry) return [];
    try {
      return JSON.parse(entry.value);
    } catch {
      return [];
    }
  }

  async sRem(key: string, ...members: string[]): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    const set = new Set(JSON.parse(entry.value));
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    await this.setEx(key, 86400, JSON.stringify([...set]));
    return removed;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const value = entry ? parseInt(entry.value, 10) + 1 : 1;
    await this.setEx(key, 86400, String(value));
    return value;
  }

  async pExpire(key: string, milliseconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiry = Date.now() + milliseconds;
    this.clearExpiry(key);
    this.intervals.set(key, setTimeout(() => this.store.delete(key), milliseconds));
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !entry.expiry) return -1;
    const remaining = Math.ceil((entry.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiry = Date.now() + seconds * 1000;
    this.clearExpiry(key);
    this.intervals.set(key, setTimeout(() => this.store.delete(key), seconds * 1000));
    return 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...this.store.keys()].filter(k => regex.test(k));
  }

  async multi(): Promise<any> {
    const ops: Array<{ op: string; args: any[] }> = [];
    const self = this;
    return {
      setEx: (key: string, ttl: number, value: string) => { ops.push({ op: 'setEx', args: [key, ttl, value] }); return this; },
      del: (key: string) => { ops.push({ op: 'del', args: [key] }); return this; },
      exec: async () => {
        for (const { op, args } of ops) {
          if (op === 'setEx') await self.setEx(args[0], args[1], args[2]);
          else if (op === 'del') await self.del(args[0]);
        }
        return ops.length;
      },
    };
  }

  private clearExpiry(key: string) {
    const interval = this.intervals.get(key);
    if (interval) {
      clearTimeout(interval);
      this.intervals.delete(key);
    }
  }
}

@Global()
@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: REDIS_CLIENT,
          useFactory: async (): Promise<InMemoryStore> => {
            const memoryStore = new InMemoryStore();
            await memoryStore.connect();
            return memoryStore;
          },
        },
      ],
      exports: [REDIS_CLIENT],
    };
  }
}