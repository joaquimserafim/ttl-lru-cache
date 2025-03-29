import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { TTLCache } from "../ttl-cache";

//
//
//

// Mock the base LRU cache
vi.mock("@joaquimserafim/lru-cache", () => {
	//
	// error mocks
	//

	class KeyNotFoundError extends Error {
		constructor() {
			super("Key not found");
			this.name = "KeyNotFoundError";
		}
	}

	const errorFunction = () => {
		throw { message: "object error" };
	};

	const keyNotFoundErrorFunction = () => {
		throw new KeyNotFoundError();
	};

	//
	// mock implementation
	//

	const LRUCache = vi.fn();

	LRUCache.prototype.get = vi
		.fn()
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(keyNotFoundErrorFunction)
		.mockImplementationOnce(keyNotFoundErrorFunction)
		.mockImplementationOnce(keyNotFoundErrorFunction)
		.mockImplementationOnce(keyNotFoundErrorFunction);

	LRUCache.prototype.put = vi
		.fn()
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(() => undefined);

	LRUCache.prototype.has = vi.fn().mockImplementation(errorFunction);

	LRUCache.prototype.keys = vi
		.fn()
		.mockImplementationOnce(errorFunction)
		.mockImplementationOnce(() => new Error());

	return { LRUCache, KeyNotFoundError };
});

//
// TTLLRUCache error handling tests
//

describe("TTLCache error handling", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor validation", () => {
		it("should validate max parameter", () => {
			expect(() => new TTLCache({ max: -1 })).toThrow();
			expect(() => new TTLCache({ max: 0 })).toThrow();
			expect(() => new TTLCache({ max: 1.5 })).toThrow();
			expect(() => new TTLCache({ max: NaN })).toThrow();
		});

		it("should validate ttl parameter", () => {
			expect(() => new TTLCache({ ttl: -1 })).toThrow();
			expect(() => new TTLCache({ ttl: 0 })).toThrow();
			expect(() => new TTLCache({ ttl: 1.5 })).toThrow();
			expect(() => new TTLCache({ ttl: NaN })).toThrow();
		});

		it("should validate onRemove callback", () => {
			expect(
				() =>
					new TTLCache({
						ttl: 1000,
						onRemove: "not a function" as any
					})
			).toThrow("onRemove must be a function, received string");
		});
	});

	describe("method validation", () => {
		let cache: TTLCache<string, number>;

		beforeEach(() => {
			cache = new TTLCache({ ttl: 1000 });
		});

		it("should validate set ttl parameter", () => {
			expect(() => cache.set("key", 1, { ttl: -1 })).toThrow();
			expect(() => cache.set("key", 1, { ttl: 0 })).toThrow();
			expect(() => cache.set("key", 1, { ttl: NaN })).toThrow();
		});

		it("should handle undefined values", () => {
			expect(cache.get("nonexistent")).toBeUndefined();
			expect(cache.getRemainingTTL("nonexistent")).toBe(0);
			expect(cache.delete("nonexistent")).toBe(false);
		});
	});

	describe("callback error handling", () => {
		it("should propagate errors from onRemove callback", () => {
			const onRemove = vi.fn().mockImplementation(() => {
				throw new Error("Callback error");
			});
			const cache = new TTLCache({ ttl: 1000, onRemove });

			cache.set("a", 1);
			expect(() => cache.delete("a")).toThrow("Callback error");
		});
	});

	describe("concurrent modification", () => {
		it("should handle concurrent modification during iteration", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });
			cache.set("a", 1);

			for (const [key] of cache) {
				cache.delete(key);
			}
			expect(cache.size).toBe(0);
		});
	});

	describe("iteration error handling", () => {
		let cache: TTLCache<string, number>;

		beforeEach(() => {
			cache = new TTLCache({ ttl: 1000 });
		});

		it("should handle errors during iteration", () => {
			cache.set("a", 1);
			cache.set("b", 2);

			// Now this will work with mocked timers
			vi.advanceTimersByTime(1001);

			const entries = [...cache];
			expect(entries).toHaveLength(0);
		});
	});

	describe("cleanup error handling", () => {
		it("should propagate errors from onRemove callback", () => {
			const onRemove = vi.fn().mockImplementation(() => {
				throw new Error("Callback error");
			});

			const cache = new TTLCache({
				ttl: 1000,
				onRemove
			});

			// Should throw when callback errors
			cache.set("a", 1);
			expect(() => cache.delete("a")).toThrow("Callback error");
			expect(onRemove).toHaveBeenCalled();
		});
	});

	describe("clear method", () => {
		it("should not trigger removal handling with default implementation", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });
			const spy = vi.spyOn(cache, "handleRemoval");

			cache.set("a", 1);
			cache.set("b", 2);

			// The default implementation should be called but do nothing
			cache.clear();

			expect(spy).toHaveBeenCalledTimes(2);
			expect(spy.mock.results.every((r) => r.value === undefined)).toBe(true);
			expect(cache.size).toBe(0);
		});

		it("should trigger custom removal handling", () => {
			const handleRemoval = vi.fn();
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				onRemove: handleRemoval
			});

			cache.set("a", 1);
			cache.set("b", 2);
			cache.clear();

			expect(handleRemoval).toHaveBeenCalledTimes(2);
			expect(handleRemoval).toHaveBeenCalledWith(1, "a", "delete");
			expect(handleRemoval).toHaveBeenCalledWith(2, "b", "delete");
			expect(cache.size).toBe(0);
		});
	});

	describe("expiration management", () => {
		it("should properly filter expiration lists when multiple keys share expiration time", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Add multiple items with the same TTL
			cache.set("a", 1, { ttl: 1000 });
			cache.set("b", 2, { ttl: 1000 });
			cache.set("c", 3, { ttl: 1000 });

			// Update TTL for middle item
			cache.set("b", 2, { ttl: 2000 });

			// Check remaining items expire at correct time
			vi.advanceTimersByTime(1001);

			// "a" and "c" should be expired, "b" should remain
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(false);

			// Check "b" expires at new time
			vi.advanceTimersByTime(1000);
			expect(cache.has("b")).toBe(false);
		});

		it("should handle last item removal from expiration list", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Add single item
			cache.set("a", 1, { ttl: 1000 });

			// Update its TTL
			cache.set("a", 1, { ttl: 2000 });

			// Original expiration time should be cleared
			vi.advanceTimersByTime(1001);
			expect(cache.has("a")).toBe(true);

			// Should expire at new time
			vi.advanceTimersByTime(1000);
			expect(cache.has("a")).toBe(false);
		});

		it("should handle noUpdateTTL option correctly", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });
			cache.set("a", 1);

			// Update value without updating TTL
			cache.set("a", 2, { noUpdateTTL: true });

			// Original expiration should remain
			vi.advanceTimersByTime(1001);
			expect(cache.has("a")).toBe(false);
		});

		it("should handle skipRemoveOnSet option correctly", () => {
			const onRemove = vi.fn();
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				onRemove
			});

			cache.set("a", 1);
			cache.set("a", 2, { skipRemoveOnSet: true });

			expect(onRemove).not.toHaveBeenCalled();
		});

		it("should handle purgeToCapacity with exact size match", () => {
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				max: 2
			});

			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);

			expect(cache.size).toBe(2);
		});

		it("should handle purgeStale with Infinity expiration", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			cache.set("a", 1, { ttl: Infinity });
			cache.purgeStale();

			expect(cache.has("a")).toBe(true);
		});

		it("should handle iteration methods", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			cache.set("a", 1);
			cache.set("b", 2);

			// Test entries()
			expect([...cache.entries()]).toHaveLength(2);

			// Test keys()
			expect([...cache.keys()]).toHaveLength(2);

			// Test values()
			expect([...cache.values()]).toHaveLength(2);
		});

		it("should handle purgeToCapacity with partial removal", () => {
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				max: 2
			});

			// Add 3 items with same expiration
			cache.set("a", 1, { ttl: 1000 });
			cache.set("b", 2, { ttl: 1000 });
			cache.set("c", 3, { ttl: 1000 });

			// Should remove first item to maintain max size
			expect(cache.size).toBe(2);
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});

		it("should handle purgeStale with multiple expiration times", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Add items with different expiration times
			cache.set("a", 1, { ttl: 500 });
			cache.set("b", 2, { ttl: 1000 });
			cache.set("c", 3, { ttl: Infinity });

			// Advance time to expire first item
			vi.advanceTimersByTime(501);
			cache.purgeStale();

			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});

		it("should handle purgeToCapacity with multiple expiration lists", () => {
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				max: 2
			});

			// Add items with different expiration times
			cache.set("a", 1, { ttl: 500 });
			cache.set("b", 2, { ttl: 1000 });
			cache.set("c", 3, { ttl: 1500 });

			// Should remove items from first expiration list
			expect(cache.size).toBe(2);
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});

		it("should handle getRemainingTTL with Infinity expiration", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Set item with Infinity TTL
			cache.set("a", 1, { ttl: Infinity });

			// Should return Infinity for remaining TTL
			expect(cache.getRemainingTTL("a")).toBe(Infinity);

			// Even after time passes
			vi.advanceTimersByTime(10000);
			expect(cache.getRemainingTTL("a")).toBe(Infinity);
		});
	});
});
