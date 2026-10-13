import { createClient } from 'redis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { env } from '../config/env';

// Determine if Upstash REST mode is configured
const isUpstashRest = !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

let upstashClient: UpstashRedis | null = null;
let nodeRedisClient: ReturnType<typeof createClient> | null = null;

if (isUpstashRest) {
  upstashClient = new UpstashRedis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  });
  console.log('⚡ Initialized Upstash Redis (REST HTTP Mode)');
} else if (env.REDIS_URL) {
  nodeRedisClient = createClient({
    url: env.REDIS_URL,
  });

  nodeRedisClient.on('error', (err) => console.error('❌ Redis Client Error:', err));
  nodeRedisClient.on('connect', () => console.log('⚡ Local/TCP Redis Connected'));
}

export const connectRedis = async () => {
  if (isUpstashRest) {
    // Upstash REST does not require persistent TCP connection
    console.log('⚡ Upstash Redis REST ready');
    return;
  }

  if (nodeRedisClient) {
    try {
      if (!nodeRedisClient.isOpen) {
        await nodeRedisClient.connect();
      }
    } catch (error) {
      console.error('⚠️ Could not connect to TCP Redis:', error);
    }
  }
};

/**
 * Unified Cache Utility
 * Seamlessly handles Upstash REST, Standard Redis (TCP), and graceful fallback
 */
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    try {
      if (upstashClient) {
        const data = await upstashClient.get<T>(key);
        return data ?? null;
      }

      if (nodeRedisClient && nodeRedisClient.isOpen) {
        const raw = await nodeRedisClient.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
      }
    } catch (error) {
      console.warn(`[Cache] Error reading key "${key}":`, error);
    }
    return null;
  },

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      if (upstashClient) {
        if (ttlSeconds) {
          await upstashClient.set(key, value, { ex: ttlSeconds });
        } else {
          await upstashClient.set(key, value);
        }
        return;
      }

      if (nodeRedisClient && nodeRedisClient.isOpen) {
        const raw = JSON.stringify(value);
        if (ttlSeconds) {
          await nodeRedisClient.setEx(key, ttlSeconds, raw);
        } else {
          await nodeRedisClient.set(key, raw);
        }
      }
    } catch (error) {
      console.warn(`[Cache] Error setting key "${key}":`, error);
    }
  },

  async del(key: string): Promise<void> {
    try {
      if (upstashClient) {
        await upstashClient.del(key);
        return;
      }

      if (nodeRedisClient && nodeRedisClient.isOpen) {
        await nodeRedisClient.del(key);
      }
    } catch (error) {
      console.warn(`[Cache] Error deleting key "${key}":`, error);
    }
  },
};
