# TTL LRU Cache

A TypeScript implementation of a cache with LRU (Least Recently Used) eviction strategies. When the cache reaches its capacity, it removes the least recently accessed items first

## Installation

```bash
pnpm add @joaquimserafim/ttl-lru-cache
```

## Usage

```typescript
import { TTLLRUCache } from "@joaquimserafim/ttl-lru-cache";

// Create a cache with capacity of 100 items and default TTL of 60000ms (1 minute)
const cache = new TTLLRUCache<string, number>(100, 60000);

// Set values in the cache
cache.set("key1", 123); // uses default TTL
cache.set("key2", 456, 30000); // custom TTL of 30 seconds

// Get values
const value1 = cache.getValue("key1"); // returns 123 if not expired
const value2 = cache.getWithTTL("key2"); // returns { value: 456, ttl: remaining_time }

// Check if key exists and not expired
const exists = cache.has("key1");

// Update TTL for existing key
cache.touch("key1", 120000); // extends TTL by 2 minutes

// Get all non-expired keys
const activeKeys = cache.keys();
```
