# TTL LRU Cache

A TypeScript implementation of a cache with LRU (Least Recently Used) eviction strategies. When the cache reaches its capacity, it removes the least recently accessed items first

## Installation

```bash
pnpm add @joaquimserafim/ttl-lru-cache
```

## Usage

```typescript
// Create a cache with capacity of 100 items and default TTL of 60000ms (1 minute)
const cache = new TTLLRUCache<string, number>(100, 60000);

// Set values in the cache
cache.set("key1", 123); // uses default TTL
cache.set("key2", 456, 30000); // custom TTL of 30 seconds

// Get values safely (returns undefined if key not found or expired)
const value = cache.getValueSafe("key1"); // returns 123 if not expired, undefined otherwise

// Delete values
cache.delete("key1"); // removes key1 from cache
cache.delete("nonexistent"); // safely handles non-existent keys

// Check if key exists
const exists = cache.has("key2"); // returns true if key exists and not expired

// Get remaining TTL
const withTTL = cache.getWithTTL("key2"); // returns { value: 456, ttl: remaining_time }

// Update TTL for existing key
cache.touch("key2", 120000); // extends TTL by 2 minutes

// Get all non-expired keys
const activeKeys = cache.keys(); // returns array of valid keys
```