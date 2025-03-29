//
// TTL Cache implementation in TypeScript
// A time-based cache that automatically removes entries after their TTL expires
//

// Helper function to get current timestamp in milliseconds
const now = (): number => performance.now();

// Validation helpers
const isPosInt = (value: any): boolean => Number.isInteger(value) && value > 0;
const isPosIntOrInf = (n: any): boolean => n === Infinity || isPosInt(n);

// Reasons why an item might be removed from the cache
type DisposeReason = "delete" | "set" | "evict" | "stale";

// Configuration options for creating a new TTLCache
interface TTLCacheOptions<K, V> {
	max?: number; // Maximum number of items to store
	ttl?: number; // Default Time-To-Live in milliseconds
	updateAgeOnGet?: boolean; // Whether to reset TTL when item is accessed
	checkAgeOnGet?: boolean; // Whether to check expiration on access
	noUpdateTTL?: boolean; // Whether to preserve TTL on value updates
	onRemove?: (value: V, key: K, reason: DisposeReason) => void; // Callback when items are removed
	skipRemoveOnSet?: boolean; // Whether to skip removal callback on value updates
}

// Options for the set() method
interface TTLCacheSetOptions {
	ttl?: number; // Override default TTL for this item
	noUpdateTTL?: boolean; // Override default TTL update behavior
	skipRemoveOnSet?: boolean; // Override default removal callback behavior
}

export class TTLCache<K, V> {
	// Maps expiration timestamps to arrays of keys that expire at that time
	private expirations: Record<number, K[]> = Object.create(null);
	// Main storage for key-value pairs
	private data: Map<K, V> = new Map();
	// Maps keys to their expiration timestamps
	private expirationMap: Map<K, number> = new Map();

	// Cache configuration
	private ttl: number | undefined;
	private max: number;
	private updateAgeOnGet: boolean;
	private checkAgeOnGet: boolean;
	private noUpdateTTL: boolean;
	private skipRemoveOnSet: boolean;

	// Timer for automatic purging of expired items
	private timer?: ReturnType<typeof setTimeout>;
	private timerExpiration?: number;

	// Default no-op removal handler
	public handleRemoval(value: V, key: K, reason: DisposeReason): void {
		// Can be overridden with custom removal logic
	}

	constructor(options: TTLCacheOptions<K, V> = {}) {
		const {
			max = Infinity,
			ttl,
			updateAgeOnGet = false,
			checkAgeOnGet = false,
			noUpdateTTL = false,
			onRemove,
			skipRemoveOnSet = false
		} = options;

		if (ttl !== undefined && !isPosIntOrInf(ttl)) {
			throw new TypeError("ttl must be positive integer or Infinity if set");
		}
		if (!isPosIntOrInf(max)) {
			throw new TypeError("max must be positive integer or Infinity");
		}

		this.ttl = ttl;
		this.max = max;
		this.updateAgeOnGet = Boolean(updateAgeOnGet);
		this.checkAgeOnGet = Boolean(checkAgeOnGet);
		this.noUpdateTTL = Boolean(noUpdateTTL);
		this.skipRemoveOnSet = Boolean(skipRemoveOnSet);

		if (onRemove !== undefined) {
			if (typeof onRemove !== "function") {
				throw new TypeError("onRemove must be a function, received " + typeof onRemove);
			}
			this.handleRemoval = onRemove;
		}
	}

	// Sets up a timer to automatically purge expired items
	private setTimer(expiration: number, ttl: number): void {
		// Skip if we already have a timer for an earlier expiration
		if (this.timerExpiration !== undefined && this.timerExpiration < expiration) {
			return;
		}

		// Clear existing timer if any
		if (this.timer) {
			clearTimeout(this.timer);
		}

		// Create new timer
		const t = setTimeout(() => {
			this.timer = undefined;
			this.timerExpiration = undefined;
			this.purgeStale();

			// Set up next timer for remaining items
			for (const exp in this.expirations) {
				const expNum = Number(exp);
				this.setTimer(expNum, expNum - now());
				break;
			}
		}, ttl);

		// Prevent timer from keeping Node.js process alive
		if (typeof (t as any).unref === "function") {
			(t as any).unref();
		}

		this.timerExpiration = expiration;
		this.timer = t;
	}

	// Cancels the automatic purge timer
	public cancelTimer(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timerExpiration = undefined;
			this.timer = undefined;
		}
	}

	// Removes all items from the cache
	public clear(): void {
		// Only collect entries if we have a custom removal handler
		const entries = this.handleRemoval !== TTLCache.prototype.handleRemoval ? [...this] : [];
		this.data.clear();
		this.expirationMap.clear();
		this.cancelTimer();
		this.expirations = Object.create(null);

		// Notify removal handler for each item
		for (const [key, val] of entries) {
			this.handleRemoval(val, key, "delete");
		}
	}

	// Updates the TTL for a specific key
	private setTTL(key: K, ttl: number = this.ttl as number): void {
		// Remove from current expiration list
		const current = this.expirationMap.get(key);
		if (current !== undefined) {
			const exp = this.expirations[current];
			if (!exp || exp.length <= 1) {
				delete this.expirations[current];
			} else {
				this.expirations[current] = exp.filter((k) => k !== key);
			}
		}

		// Add to new expiration list
		if (ttl !== Infinity) {
			const expiration = Math.floor(now() + ttl);
			this.expirationMap.set(key, expiration);

			if (!this.expirations[expiration]) {
				this.expirations[expiration] = [];
				this.setTimer(expiration, ttl);
			}

			this.expirations[expiration].push(key);
		} else {
			this.expirationMap.set(key, Infinity);
		}
	}

	// Sets or updates a cache entry
	public set(key: K, val: V, options: TTLCacheSetOptions = {}): this {
		const {
			ttl = this.ttl as number,
			noUpdateTTL = this.noUpdateTTL,
			skipRemoveOnSet = this.skipRemoveOnSet
		} = options;

		if (!isPosIntOrInf(ttl)) {
			throw new TypeError("ttl must be positive integer or Infinity");
		}

		if (this.expirationMap.has(key)) {
			if (!noUpdateTTL) {
				this.setTTL(key, ttl);
			}

			const oldValue = this.data.get(key);
			if (oldValue !== val) {
				this.data.set(key, val);
				if (!skipRemoveOnSet) {
					this.handleRemoval(oldValue as V, key, "set");
				}
			}
		} else {
			this.setTTL(key, ttl);
			this.data.set(key, val);
		}

		while (this.size > this.max) {
			this.purgeToCapacity();
		}

		return this;
	}

	// Standard Map-like methods
	public has(key: K): boolean {
		return this.data.has(key);
	}

	// Gets remaining TTL for a key in milliseconds
	public getRemainingTTL(key: K): number {
		const expiration = this.expirationMap.get(key);
		return expiration === Infinity
			? Infinity
			: expiration !== undefined
				? Math.max(0, Math.ceil(expiration - now()))
				: 0;
	}

	// Retrieves a value from the cache
	public get(
		key: K,
		options: { updateAgeOnGet?: boolean; ttl?: number; checkAgeOnGet?: boolean } = {}
	): V | undefined {
		const {
			updateAgeOnGet = this.updateAgeOnGet,
			ttl = this.ttl as number,
			checkAgeOnGet = this.checkAgeOnGet
		} = options;
		const val = this.data.get(key);

		if (checkAgeOnGet && this.getRemainingTTL(key) === 0) {
			this.delete(key);
			return undefined;
		}

		if (updateAgeOnGet) {
			this.setTTL(key, ttl);
		}
		return val;
	}

	// Removes an item from the cache
	public delete(key: K): boolean {
		const current = this.expirationMap.get(key);

		if (current !== undefined) {
			const value = this.data.get(key) as V;
			this.data.delete(key);
			this.expirationMap.delete(key);
			const exp = this.expirations[current];

			if (exp) {
				if (exp.length <= 1) {
					delete this.expirations[current];
				} else {
					this.expirations[current] = exp.filter((k) => k !== key);
				}
			}

			this.handleRemoval(value, key, "delete");

			if (this.size === 0) {
				this.cancelTimer();
			}
			return true;
		}
		return false;
	}

	// Returns current number of items in cache
	public get size(): number {
		return this.data.size;
	}

	// Helper method to remove a list of keys from the cache and trigger the
	// removal callback with the given reason.
	private removeKeys = (keysToRemove: K[], reason: "stale" | "evict" = "evict"): void => {
		const entries: [K, V][] = [];
		for (const key of keysToRemove) {
			entries.push([key, this.data.get(key) as V]);
			this.data.delete(key);
			this.expirationMap.delete(key);
		}
		for (const [key, val] of entries) {
			this.handleRemoval(val, key, reason);
		}
	};

	// Removes items to maintain maximum size limit
	private purgeToCapacity(): void {
		// Iterate over expiration buckets (assumes numeric keys are iterated in sorted order)
		for (const exp in this.expirations) {
			const keys = this.expirations[exp];
			// If removing the entire bucket still leaves the cache over capacity, remove the entire bucket.
			if (this.size - keys.length >= this.max) {
				delete this.expirations[exp];
				this.removeKeys(keys, "evict");
			} else {
				// Otherwise, remove just enough keys from this bucket to meet capacity.
				const excessCount = this.size - this.max;
				const removedKeys = keys.splice(0, excessCount);
				this.removeKeys(removedKeys, "evict");
				return;
			}
		}
	}

	// Removes all expired items
	public purgeStale(): void {
		const currentTime = Math.ceil(now());
		for (const exp in this.expirations) {
			if (exp === "Infinity" || Number(exp) > currentTime) {
				return;
			}
			const keys = [...(this.expirations[exp] || [])];
			delete this.expirations[exp];
			this.removeKeys(keys, "stale"); // Now using "stale" as the removal reason.
		}
		if (this.size === 0) {
			this.cancelTimer();
		}
	}

	// Iterator methods to make the cache iterable
	public *entries(): IterableIterator<[K, V]> {
		for (const exp in this.expirations) {
			for (const key of this.expirations[exp]) {
				yield [key, this.data.get(key) as V];
			}
		}
	}

	public *keys(): IterableIterator<K> {
		for (const exp in this.expirations) {
			for (const key of this.expirations[exp]) {
				yield key;
			}
		}
	}

	public *values(): IterableIterator<V> {
		for (const exp in this.expirations) {
			for (const key of this.expirations[exp]) {
				yield this.data.get(key) as V;
			}
		}
	}

	public [Symbol.iterator](): IterableIterator<[K, V]> {
		return this.entries();
	}
}
