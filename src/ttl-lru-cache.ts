import { LRUCache, KeyNotFoundError } from "@joaquimserafim/lru-cache";

//
// TTLLRUCache class
// Implements a Least Recently Used (LRU) cache with TTL
//

interface CacheItem<V> {
	value: V;
	expiry: number;
}

export class TTLLRUCache<K, V> extends LRUCache<K, CacheItem<V>> {
	constructor(
		capacity: number,
		private defaultTTL: number = 60000 // default 1 minute in milliseconds
	) {
		super(capacity);
	}

	set(key: K, value: V, ttl?: number): void {
		const expiry = Date.now() + (ttl ?? this.defaultTTL);
		super.put(key, { value, expiry });
	}

	getValue(key: K): V | undefined {
		try {
			const item = super.get(key);
			if (Date.now() > item.expiry) {
				// Item has expired
				this.delete(key);
				return undefined;
			}
			return item.value;
		} catch (error) {
			if (error instanceof KeyNotFoundError) {
				return undefined;
			}
			throw error;
		}
	}

	getWithTTL(key: K): { value: V; ttl: number } | undefined {
		try {
			const item = super.get(key);
			const now = Date.now();
			const ttl = item.expiry - now;

			if (ttl <= 0) {
				this.delete(key);
				return undefined;
			}

			return { value: item.value, ttl };
		} catch (error) {
			if (error instanceof KeyNotFoundError) {
				return undefined;
			}
			throw error;
		}
	}

	// Override getSafe to handle TTL
	getValueSafe(key: K): V | undefined {
		return this.getValue(key);
	}

	// Helper method to delete an item
	delete(key: K): void {
		try {
			super.put(key, { value: null as V, expiry: 0 });
		} catch (error) {
			if (!(error instanceof KeyNotFoundError)) {
				throw error;
			}
		}
	}

	// Method to check if a key exists and is not expired
	has(key: K): boolean {
		try {
			const item = super.get(key);
			if (Date.now() > item.expiry) {
				this.delete(key);
				return false;
			}
			return true;
		} catch (error) {
			if (error instanceof KeyNotFoundError) {
				return false;
			}
			throw error;
		}
	}

	// Method to update TTL for an existing key
	touch(key: K, ttl?: number): boolean {
		try {
			const item = super.get(key);
			if (Date.now() > item.expiry) {
				this.delete(key);
				return false;
			}

			const expiry = Date.now() + (ttl ?? this.defaultTTL);
			super.put(key, { ...item, expiry });
			return true;
		} catch (error) {
			if (error instanceof KeyNotFoundError) {
				return false;
			}
			throw error;
		}
	}

	// Method to get all non-expired keys
	keys(): K[] {
		const allKeys = super.keys();

		if (Array.isArray(allKeys)) {
			// Filter out expired keys and clean them up
			return allKeys.filter(
				(key) => this.has(key) // This already handles errors and expiry checks
			);
		}

		return [];
	}
}
