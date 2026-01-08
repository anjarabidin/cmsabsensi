interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheConfig {
  defaultTtl: number;
  maxSize: number;
}

class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private config: CacheConfig = {
    defaultTtl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100 // Maximum number of cached items
  };

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get data from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Check if item is expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl
    };

    // Remove oldest items if cache is full
    if (this.cache.size >= this.config.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, item);
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get or set pattern - fetch data if not in cache
   */
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    
    return data;
  }

  /**
   * Invalidate cache by pattern
   */
  invalidate(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const items = Array.from(this.cache.values());
    const now = Date.now();
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      expiredItems: items.filter(item => now - item.timestamp > item.ttl).length,
      validItems: items.filter(item => now - item.timestamp <= item.ttl).length,
      oldestItem: items.length > 0 ? Math.min(...items.map(item => item.timestamp)) : null,
      newestItem: items.length > 0 ? Math.max(...items.map(item => item.timestamp)) : null
    };
  }
}

// Create singleton instances for different cache types
export const queryCache = new CacheService({
  defaultTtl: 5 * 60 * 1000, // 5 minutes for query cache
  maxSize: 50
});

export const userCache = new CacheService({
  defaultTtl: 10 * 60 * 1000, // 10 minutes for user data
  maxSize: 20
});

export const staticCache = new CacheService({
  defaultTtl: 30 * 60 * 1000, // 30 minutes for static data
  maxSize: 30
});

// Cache keys constants
export const CACHE_KEYS = {
  USER_PROFILE: (userId: string) => `user_profile_${userId}`,
  USER_PERMISSIONS: (userId: string) => `user_permissions_${userId}`,
  EMPLOYEES_LIST: 'employees_list',
  DEPARTMENTS_LIST: 'departments_list',
  ATTENDANCE_TODAY: (userId: string) => `attendance_today_${userId}`,
  ATTENDANCE_MONTH: (userId: string, month: string) => `attendance_month_${userId}_${month}`,
  LEAVE_BALANCE: (userId: string) => `leave_balance_${userId}`,
  PAYROLL_RUNS: 'payroll_runs',
  PAYROLL_DETAILS: (runId: string) => `payroll_details_${runId}`,
  NOTIFICATIONS: (userId: string) => `notifications_${userId}`,
  DASHBOARD_STATS: (userId: string) => `dashboard_stats_${userId}`,
  RECENT_LEAVE: (userId: string) => `recent_leave_${userId}`,
  PENDING_REQUESTS: 'pending_requests'
} as const;

// Cache helper functions
export const cacheHelpers = {
  /**
   * Cache user profile
   */
  cacheUserProfile: (userId: string, profile: any) => {
    userCache.set(CACHE_KEYS.USER_PROFILE(userId), profile);
  },

  /**
   * Get cached user profile
   */
  getUserProfile: (userId: string) => {
    return userCache.get(CACHE_KEYS.USER_PROFILE(userId));
  },

  /**
   * Cache attendance data
   */
  cacheAttendance: (userId: string, date: string, data: any) => {
    const key = date === 'today' 
      ? CACHE_KEYS.ATTENDANCE_TODAY(userId)
      : CACHE_KEYS.ATTENDANCE_MONTH(userId, date);
    queryCache.set(key, data, 2 * 60 * 1000); // 2 minutes for attendance data
  },

  /**
   * Get cached attendance data
   */
  getAttendance: (userId: string, date: string) => {
    const key = date === 'today' 
      ? CACHE_KEYS.ATTENDANCE_TODAY(userId)
      : CACHE_KEYS.ATTENDANCE_MONTH(userId, date);
    return queryCache.get(key);
  },

  /**
   * Cache dashboard stats
   */
  cacheDashboardStats: (userId: string, stats: any) => {
    queryCache.set(CACHE_KEYS.DASHBOARD_STATS(userId), stats, 3 * 60 * 1000); // 3 minutes
  },

  /**
   * Get cached dashboard stats
   */
  getDashboardStats: (userId: string) => {
    return queryCache.get(CACHE_KEYS.DASHBOARD_STATS(userId));
  },

  /**
   * Invalidate user-specific cache
   */
  invalidateUserCache: (userId: string) => {
    queryCache.invalidate(userId);
    userCache.invalidate(userId);
  },

  /**
   * Invalidate all attendance cache
   */
  invalidateAttendanceCache: () => {
    queryCache.invalidate('attendance');
  },

  /**
   * Invalidate all payroll cache
   */
  invalidatePayrollCache: () => {
    queryCache.invalidate('payroll');
  }
};

export default CacheService;
