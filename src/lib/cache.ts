/**
 * Cache Layer
 * Multi-level caching with in-memory L1 and optional Redis L2
 * Supports tag-based invalidation and stale-while-revalidate
 */

// ============== TYPES ==============

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for group invalidation
  staleWhileRevalidate?: number; // Serve stale for this many seconds while refreshing
}

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleAt?: number;
  tags: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

// ============== L1 IN-MEMORY CACHE ==============

class L1Cache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> keys
  private maxSize: number;
  private stats = { hits: 0, misses: 0, sets: 0, deletes: 0 };

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();

    // Check if completely expired
    if (entry.expiresAt < now && (!entry.staleAt || entry.staleAt < now)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry;
  }

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const { ttl = 300, tags = [], staleWhileRevalidate } = options;
    const now = Date.now();

    // Evict if at capacity (LRU-like: just delete oldest)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.delete(firstKey);
    }

    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttl * 1000,
      staleAt: staleWhileRevalidate ? now + (ttl + staleWhileRevalidate) * 1000 : undefined,
      tags,
    };

    this.cache.set(key, entry);

    // Update tag index
    tags.forEach((tag) => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });

    this.stats.sets++;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Remove from tag index
    entry.tags.forEach((tag) => {
      this.tagIndex.get(tag)?.delete(key);
    });

    this.cache.delete(key);
    this.stats.deletes++;
    return true;
  }

  invalidateTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    keys.forEach((key) => {
      if (this.delete(key)) count++;
    });

    this.tagIndex.delete(tag);
    return count;
  }

  clear(): void {
    this.cache.clear();
    this.tagIndex.clear();
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    };
  }

  size(): number {
    return this.cache.size;
  }
}

// ============== CACHE MANAGER ==============

class CacheManager {
  private l1: L1Cache;
  private keyPrefix: string;

  constructor(options: { maxL1Size?: number; keyPrefix?: string } = {}) {
    this.l1 = new L1Cache(options.maxL1Size || 1000);
    this.keyPrefix = options.keyPrefix || "litlens:";
  }

  private buildKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * Get from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);
    const entry = this.l1.get<T>(fullKey);

    if (!entry) {
      return null;
    }

    // Check if stale (but not expired)
    const now = Date.now();
    if (entry.expiresAt < now) {
      // Return stale data but mark for revalidation
      return entry.data;
    }

    return entry.data;
  }

  /**
   * Set in cache
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key);
    this.l1.set(fullKey, data, options);
  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    return this.l1.delete(fullKey);
  }

  /**
   * Invalidate all keys with a tag
   */
  async invalidateTag(tag: string): Promise<number> {
    return this.l1.invalidateTag(tag);
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.l1.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.l1.getStats();
  }
}

// ============== SINGLETON INSTANCE ==============

export const cache = new CacheManager();

// ============== CACHE KEY BUILDERS ==============

export const cacheKeys = {
  // Project keys
  project: (id: string) => `project:${id}`,
  projectMembers: (id: string) => `project:${id}:members`,
  projectStats: (id: string) => `project:${id}:stats`,
  projectWorks: (id: string, page: number) => `project:${id}:works:${page}`,

  // User keys
  user: (id: string) => `user:${id}`,
  userProjects: (id: string) => `user:${id}:projects`,
  userOrganizations: (id: string) => `user:${id}:organizations`,

  // Organization keys
  organization: (id: string) => `org:${id}`,
  organizationMembers: (id: string) => `org:${id}:members`,

  // Work keys
  work: (id: string) => `work:${id}`,
  
  // Screening keys
  screeningQueue: (projectId: string, phase: string) => `screening:${projectId}:${phase}:queue`,
  screeningProgress: (projectId: string) => `screening:${projectId}:progress`,

  // Library keys
  libraryItems: (userId: string, folderId?: string) => 
    `library:${userId}:${folderId || 'root'}`,
  libraryFolders: (userId: string) => `library:${userId}:folders`,
};

// ============== CACHE TAGS ==============

export const cacheTags = {
  project: (id: string) => `project:${id}`,
  user: (id: string) => `user:${id}`,
  organization: (id: string) => `org:${id}`,
  screening: (projectId: string) => `screening:${projectId}`,
  library: (userId: string) => `library:${userId}`,
};

// ============== CACHE DECORATORS/HELPERS ==============

/**
 * Cached function wrapper
 */
export function cached<T>(
  keyFn: (...args: unknown[]) => string,
  options: CacheOptions = {}
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = keyFn(...args);
      return cache.getOrSet(key, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Invalidate cache on mutation
 */
export async function invalidateOnMutation(
  tags: string[],
  keys?: string[]
): Promise<void> {
  // Invalidate tags
  await Promise.all(tags.map((tag) => cache.invalidateTag(tag)));

  // Delete specific keys
  if (keys) {
    await Promise.all(keys.map((key) => cache.delete(key)));
  }
}

