# TTL Cache

A TypeScript implementation of a time-based cache with millisecond-precision TTL (Time To Live). Unlike LRU caches, this implementation is optimized for time-based expiration rather than usage patterns, resulting in better performance by avoiding the overhead of tracking access order.

## Installation

```bash
pnpm add @joaquimserafim/ttl-cache
```

## Usage

```typescript
// Create a cache with a max size of 100 items and default TTL of 1000ms
const cache = new TTLCache<string, number>({
	max: 100, // optional: maximum number of items
	ttl: 1000 // required: default TTL in milliseconds
});

// Basic operations
cache.set("key1", 123); // uses default TTL
cache.set("key2", 456, { ttl: 2000 }); // custom TTL of 2 seconds

// Get values (undefined if expired or not found)
cache.get("key1"); // returns 123 if not expired
cache.has("key1"); // returns true if exists and not expired

// Check remaining time
cache.getRemainingTTL("key1"); // milliseconds until expiration

// Remove items
cache.delete("key1"); // remove single item
cache.clear(); // remove all items

// Size management
console.log(cache.size); // current number of items
```

## Key Features

- Millisecond-precision TTL expiration
- Space-efficient implementation (no linked lists or pointer tracking)
- When capacity is reached, soonest-expiring items are removed first
- Iteration order follows expiration time (soonest to latest)
- Automatic cleanup of expired items
- Type-safe TypeScript implementation

## Behavior Notes

- Every entry must have a TTL (default from constructor or per-set)
- Capacity limits are enforced by item count, not custom sizing
- Items with same expiration time are handled FIFO
- No LRU tracking - optimized for time-based expiration
- Expired items are automatically removed when accessed

## Advanced Usage

```typescript
const cache = new TTLCache<string, number>({
	max: 1000,
	ttl: 60000,
	updateAgeOnGet: false, // don't refresh TTL on get
	checkAgeOnGet: true, // check expiration on get
	onRemove: (value, key, reason) => {
		// called when items are removed
		// reason: "delete" | "set" | "evict" | "stale"
	}
});
```

## Iteration Examples

The cache is iterable and yields entries in order of expiration (soonest to latest). Items with the same expiration time are yielded in order of insertion.

```typescript
const cache = new TTLCache<string, number>({ ttl: 60000 });

// Add items with different TTLs
cache.set("a", 1, { ttl: 1000 }); // expires in 1 second
cache.set("b", 2, { ttl: 2000 }); // expires in 2 seconds
cache.set("c", 3, { ttl: 3000 }); // expires in 3 seconds

// 1. Using for...of (ordered by expiration)
for (const [key, value] of cache) {
	console.log(`${key}: ${value}`); // "a: 1", "b: 2", "c: 3"
}

// 2. Convert to array
const entries = [...cache];
// entries = [["a", 1], ["b", 2], ["c", 3]]

// 3. Destructuring
const [[firstKey, firstValue]] = cache;
// firstKey = "a" (soonest to expire)
// firstValue = 1

// 4. Using with array methods
const values = [...cache].map(([_, value]) => value);
// values = [1, 2, 3]

// 5. Object construction
const obj = Object.fromEntries(cache);
// { a: 1, b: 2, c: 3 }

// 6. Multiple destructuring
const [[k1, v1], [k2, v2]] = cache;
// k1 = "a", v1 = 1, k2 = "b", v2 = 2
```
