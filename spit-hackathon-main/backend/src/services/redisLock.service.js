const { getRedisClient } = require('../config/redis');
const config = require('../config/env');

/**
 * Redis-based distributed locking service for preventing double bookings
 */

class RedisLockService {
  constructor() {
    this.lockPrefix = 'lock:slot:';
    this.defaultTTL = config.redisLockTTL; // milliseconds
  }

  /**
   * Generate lock key for a specific slot
   */
  getLockKey(providerId, startTime) {
    const timestamp = new Date(startTime).getTime();
    return `${this.lockPrefix}${providerId}:${timestamp}`;
  }

  /**
   * Acquire a lock for a slot
   * Returns true if lock acquired, false if already locked
   */
  async acquireLock(providerId, startTime, ttlMs = null) {
    const redis = getRedisClient();
    
    if (!redis) {
      console.warn('Redis not available, skipping lock');
      return true; // Fallback: allow booking if Redis is down
    }

    const lockKey = this.getLockKey(providerId, startTime);
    const ttl = ttlMs || this.defaultTTL;
    const lockValue = `${Date.now()}`; // Unique value for this lock

    try {
      // SET NX (set if not exists) with expiration
      const result = await redis.set(lockKey, lockValue, {
        NX: true, // Only set if key doesn't exist
        PX: ttl   // Expiration in milliseconds
      });

      return result === 'OK';
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return false;
    }
  }

  /**
   * Release a lock for a slot
   */
  async releaseLock(providerId, startTime) {
    const redis = getRedisClient();
    
    if (!redis) {
      return true;
    }

    const lockKey = this.getLockKey(providerId, startTime);

    try {
      const result = await redis.del(lockKey);
      return result === 1;
    } catch (error) {
      console.error('Error releasing lock:', error);
      return false;
    }
  }

  /**
   * Check if a slot is locked
   */
  async isLocked(providerId, startTime) {
    const redis = getRedisClient();
    
    if (!redis) {
      return false;
    }

    const lockKey = this.getLockKey(providerId, startTime);

    try {
      const exists = await redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      console.error('Error checking lock:', error);
      return false;
    }
  }

  /**
   * Extend lock TTL (for long operations)
   */
  async extendLock(providerId, startTime, additionalTtlMs) {
    const redis = getRedisClient();
    
    if (!redis) {
      return true;
    }

    const lockKey = this.getLockKey(providerId, startTime);

    try {
      const ttl = await redis.pTTL(lockKey);
      
      if (ttl > 0) {
        await redis.pExpire(lockKey, ttl + additionalTtlMs);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error extending lock:', error);
      return false;
    }
  }

  /**
   * Acquire multiple locks at once (for multiple slots)
   */
  async acquireMultipleLocks(slots, ttlMs = null) {
    const results = await Promise.all(
      slots.map(slot => this.acquireLock(slot.providerId, slot.startTime, ttlMs))
    );

    const allAcquired = results.every(result => result === true);

    // If any lock failed, release all acquired locks
    if (!allAcquired) {
      await this.releaseMultipleLocks(slots);
      return false;
    }

    return true;
  }

  /**
   * Release multiple locks at once
   */
  async releaseMultipleLocks(slots) {
    await Promise.all(
      slots.map(slot => this.releaseLock(slot.providerId, slot.startTime))
    );
  }

  /**
   * Clear all locks (use with caution, mainly for testing)
   */
  async clearAllLocks() {
    const redis = getRedisClient();
    
    if (!redis) {
      return;
    }

    try {
      const keys = await redis.keys(`${this.lockPrefix}*`);
      
      if (keys.length > 0) {
        await redis.del(keys);
        console.log(`Cleared ${keys.length} locks`);
      }
    } catch (error) {
      console.error('Error clearing locks:', error);
    }
  }
}

module.exports = new RedisLockService();
