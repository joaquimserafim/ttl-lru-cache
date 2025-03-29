import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { TTLCache } from "../ttl-cache";

//
// TTLLRUCache tests
//

describe("TTLCache", () => {
	let cache: TTLCache<string, number>;

	beforeEach(() => {
		vi.useFakeTimers();
		cache = new TTLCache<string, number>({ ttl: 1000 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("basic operations", () => {
		it("should set and get values", () => {
			cache.set("a", 1);
			expect(cache.get("a")).toBe(1);
		});

		it("should handle custom TTL", () => {
			cache.set("a", 1, { ttl: 500 });
			vi.advanceTimersByTime(400);
			expect(cache.get("a")).toBe(1);
			vi.advanceTimersByTime(101);
			expect(cache.get("a")).toBeUndefined();
		});

		it("should respect updateAgeOnGet", () => {
			cache = new TTLCache({ ttl: 1000, updateAgeOnGet: true });
			cache.set("a", 1);
			vi.advanceTimersByTime(900);
			cache.get("a"); // should reset TTL
			vi.advanceTimersByTime(900);
			expect(cache.get("a")).toBe(1);
		});
	});

	describe("capacity management", () => {
		it("should respect max capacity", () => {
			cache = new TTLCache({ max: 2, ttl: 1000 });
			cache.set("a", 1, { ttl: 1000 });
			cache.set("b", 2, { ttl: 2000 });
			cache.set("c", 3, { ttl: 3000 });
			expect(cache.has("a")).toBe(false); // shortest TTL removed first
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});
	});

	describe("removal callback", () => {
		it("should call onRemove when items are removed", () => {
			const onRemove = vi.fn();
			cache = new TTLCache({ ttl: 1000, onRemove });

			cache.set("a", 1);
			cache.delete("a");
			expect(onRemove).toHaveBeenCalledWith(1, "a", "delete");
		});

		it("should respect skipRemoveOnSet", () => {
			const onRemove = vi.fn();
			cache = new TTLCache({ ttl: 1000, onRemove });

			cache.set("a", 1);
			cache.set("a", 2, { skipRemoveOnSet: true });
			expect(onRemove).not.toHaveBeenCalled();
		});
	});

	describe("iteration", () => {
		it("should iterate in expiration order", () => {
			cache.set("a", 1, { ttl: 1000 });
			cache.set("b", 2, { ttl: 2000 });
			cache.set("c", 3, { ttl: 3000 });

			const entries = [...cache];
			expect(entries).toEqual([
				["a", 1],
				["b", 2],
				["c", 3]
			]);
		});

		it("should support array destructuring", () => {
			cache.set("a", 1, { ttl: 1000 });
			cache.set("b", 2, { ttl: 2000 });

			const [[k1, v1], [k2, v2]] = cache;
			expect(k1).toBe("a");
			expect(v1).toBe(1);
			expect(k2).toBe("b");
			expect(v2).toBe(2);
		});

		it("should work with for...of", () => {
			cache.set("a", 1, { ttl: 1000 });
			cache.set("b", 2, { ttl: 2000 });

			const result: [string, number][] = [];
			for (const entry of cache) {
				result.push(entry);
			}
			expect(result).toEqual([
				["a", 1],
				["b", 2]
			]);
		});
	});

	describe("TTL checks", () => {
		it("should return correct remaining TTL", () => {
			cache.set("a", 1, { ttl: 1000 });
			vi.advanceTimersByTime(400);
			expect(cache.getRemainingTTL("a")).toBeLessThanOrEqual(600);
			expect(cache.getRemainingTTL("a")).toBeGreaterThan(500);
		});

		it("should return 0 for expired items", () => {
			cache.set("a", 1, { ttl: 1000 });
			vi.advanceTimersByTime(1001);
			expect(cache.getRemainingTTL("a")).toBe(0);
		});
	});

	describe("constructor validation", () => {
		it("should throw on invalid TTL", () => {
			expect(() => new TTLCache({ ttl: -1 })).toThrow();
			expect(() => new TTLCache({ ttl: 0 })).toThrow();
		});

		it("should throw on invalid max", () => {
			expect(() => new TTLCache({ ttl: 1000, max: -1 })).toThrow();
			expect(() => new TTLCache({ ttl: 1000, max: 0 })).toThrow();
		});
	});

	describe("expiration behavior", () => {
		it("should handle multiple keys with shared expiration time", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);

			// All should exist initially
			expect(cache.has("a")).toBe(true);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);

			// Advance past TTL
			vi.advanceTimersByTime(1001);

			// All should expire together
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(false);
			expect(cache.has("c")).toBe(false);
		});

		it("should handle last item removal from expiration list", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			cache.set("a", 1);
			cache.set("b", 2);

			// Remove last item from first expiration list
			cache.delete("b");

			expect(cache.has("a")).toBe(true);
			expect(cache.has("b")).toBe(false);

			// Advance past TTL
			vi.advanceTimersByTime(1001);
			expect(cache.has("a")).toBe(false);
		});

		it("should respect noUpdateTTL option", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			cache.set("a", 1);

			// Update value without updating TTL
			vi.advanceTimersByTime(500);
			cache.set("a", 2, { noUpdateTTL: true });

			// Should expire at original time
			vi.advanceTimersByTime(501);
			expect(cache.has("a")).toBe(false);
		});

		it("should handle infinite TTL", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			cache.set("a", 1, { ttl: Infinity });

			// Advance well past normal TTL
			vi.advanceTimersByTime(10000);
			expect(cache.has("a")).toBe(true);

			// Check TTL value
			expect(cache.getRemainingTTL("a")).toBe(Infinity);
		});
	});

	describe("capacity management", () => {
		it("should respect max size limit", () => {
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				max: 2
			});

			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);

			expect(cache.size).toBe(2);
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});

		it("should handle partial removals", () => {
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				max: 2
			});

			// Add items with different TTLs
			cache.set("a", 1, { ttl: 500 });
			cache.set("b", 2, { ttl: 1000 });
			cache.set("c", 3, { ttl: 1500 });

			// Should remove oldest TTL first
			expect(cache.size).toBe(2);
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});
	});

	describe("cleanup", () => {
		it("should handle clear operation", () => {
			const onRemove = vi.fn();
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				onRemove
			});

			cache.set("a", 1);
			cache.set("b", 2);

			cache.clear();

			expect(cache.size).toBe(0);
			expect(onRemove).toHaveBeenCalledTimes(2);
			expect(onRemove).toHaveBeenCalledWith(1, "a", "delete");
			expect(onRemove).toHaveBeenCalledWith(2, "b", "delete");
		});

		it("should handle purgeStale operation", () => {
			const onRemove = vi.fn();
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				onRemove
			});

			cache.set("a", 1, { ttl: 500 });
			cache.set("b", 2, { ttl: 1500 });

			// Advance past first TTL
			vi.advanceTimersByTime(501);
			cache.purgeStale();

			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(onRemove).toHaveBeenCalledWith(1, "a", "stale");
		});

		it("should handle expiration list edge cases during purgeStale", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Add items with different expiration times
			cache.set("a", 1, { ttl: 500 }); // Will expire first
			cache.set("b", 2, { ttl: 1000 }); // Will expire later

			// Advance time past first expiration
			vi.advanceTimersByTime(501);

			// Trigger auto-purge by adding another item
			cache.set("c", 3);

			// Multiple purgeStale calls to ensure edge case handling
			cache.purgeStale();
			cache.purgeStale(); // Second call might hit undefined case

			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);
			expect(cache.has("c")).toBe(true);
		});
	});

	describe("get behavior", () => {
		it("should delete expired items when checkAgeOnGet is true", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });
			const onRemove = vi.fn();

			// Set item with onRemove to verify deletion
			cache.set("a", 1);

			// Advance time past TTL
			vi.advanceTimersByTime(1001);

			// Get with checkAgeOnGet should delete and return undefined
			const result = cache.get("a", { checkAgeOnGet: true });

			expect(result).toBeUndefined();
			expect(cache.has("a")).toBe(false);
		});
	});

	describe("deletion behavior", () => {
		it("should properly filter expiration lists when deleting items with shared expiration", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Add multiple items with same TTL
			cache.set("a", 1);
			cache.set("b", 2);
			cache.set("c", 3);

			// Delete middle item
			cache.delete("b");

			// Verify remaining items still expire at correct time
			expect(cache.has("a")).toBe(true);
			expect(cache.has("b")).toBe(false);
			expect(cache.has("c")).toBe(true);

			// Advance to expiration time
			vi.advanceTimersByTime(1001);

			// Both remaining items should be expired
			expect(cache.has("a")).toBe(false);
			expect(cache.has("c")).toBe(false);
		});
	});

	describe("edge cases", () => {
		it("should handle clear on empty cache", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });
			cache.clear(); // Testing line 128 branch
			expect(cache.size).toBe(0);
		});

		it("should handle iteration with empty expiration lists", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Set and expire items to create empty expiration lists
			cache.set("a", 1);
			cache.set("b", 2);
			vi.advanceTimersByTime(1001);

			// Test entries() with empty expiration list (line 278)
			expect([...cache.entries()]).toHaveLength(0);

			// Test values() with empty expiration list (line 292)
			expect([...cache.values()]).toHaveLength(0);
		});

		it("should handle iteration with undefined expiration lists", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// First add and then delete items to create "undefined" entries
			// in the expirations object
			cache.set("a", 1);
			cache.delete("a");

			// These iterations should handle the undefined case
			expect([...cache.entries()]).toHaveLength(0);
			expect([...cache.values()]).toHaveLength(0);
		});
	});

	describe("iteration edge cases", () => {
		it("should handle iteration with empty but existing expiration lists", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Create a situation with empty expiration lists
			cache.set("a", 1);
			cache.set("b", 2, { ttl: 2000 }); // Different expiration time

			// Expire and remove first item but keep its expiration list
			vi.advanceTimersByTime(1001);
			cache.purgeStale();

			// Test iterations with empty but existing expiration lists
			const entries = [...cache.entries()];
			const values = [...cache.values()];

			expect(entries).toHaveLength(1);
			expect(values).toHaveLength(1);
			expect(entries[0][1]).toBe(2);
			expect(values[0]).toBe(2);
		});
	});

	describe("purgeStale edge cases", () => {
		it("should handle undefined expiration lists during purge", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Set up items with different expirations
			cache.set("a", 1, { ttl: 500 }); // Will expire first
			cache.set("b", 2, { ttl: 1500 }); // Will expire later

			// Advance time past first expiration and purge
			vi.advanceTimersByTime(501);
			cache.purgeStale();

			// Verify first item is gone
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(true);

			// Now try to iterate
			const entries = [...cache.entries()];
			const values = [...cache.values()];

			expect(entries).toHaveLength(1);
			expect(values).toHaveLength(1);
			expect(entries[0][1]).toBe(2);
			expect(values[0]).toBe(2);
		});
	});

	describe("size property", () => {
		it("should return data.size directly", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });
			expect(cache.size).toBe(0);
			cache.set("a", 1);
			expect(cache.size).toBe(1);
		});

		it("should accurately track number of items", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Empty cache
			expect(cache.size).toBe(0);

			// Add items
			cache.set("a", 1);
			expect(cache.size).toBe(1);

			cache.set("b", 2);
			expect(cache.size).toBe(2);

			// Delete item
			cache.delete("a");
			expect(cache.size).toBe(1);

			// Clear cache
			cache.clear();
			expect(cache.size).toBe(0);

			// Expire items
			cache.set("c", 3);
			vi.advanceTimersByTime(1001);
			cache.purgeStale();
			expect(cache.size).toBe(0);
		});
	});

	describe("iteration methods", () => {
		it("should handle values iteration with sparse expiration lists", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Create sparse expiration lists
			cache.set("a", 1, { ttl: 500 });
			cache.set("b", 2, { ttl: 1500 });

			// Expire first item
			vi.advanceTimersByTime(501);
			cache.purgeStale();

			// Test values iteration
			const values = [...cache.values()];
			expect(values).toEqual([2]);
		});
	});

	describe("capacity and purge behavior", () => {
		it("should process all expiration lists in purgeToCapacity", () => {
			const cache = new TTLCache<string, number>({
				ttl: 1000,
				max: 2
			});

			// Add items with different expiration times to create multiple lists
			cache.set("a", 1, { ttl: 500 });
			cache.set("b", 2, { ttl: 1000 });
			cache.set("c", 3, { ttl: 1500 });
			cache.set("d", 4, { ttl: 2000 });

			// Should process all expiration lists to maintain max size
			expect(cache.size).toBe(2);
			expect(cache.has("a")).toBe(false);
			expect(cache.has("b")).toBe(false);
			expect(cache.has("c")).toBe(true);
			expect(cache.has("d")).toBe(true);
		});

		it("should handle empty expirations object in purgeStale", () => {
			const cache = new TTLCache<string, number>({ ttl: 1000 });

			// Create and then clear all items
			cache.set("a", 1);
			cache.clear();

			// Should handle empty expirations object
			cache.purgeStale();
			expect(cache.size).toBe(0);
		});
	});
});

describe("advanced behavior", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});
	it("should cancel timer when cache is empty after purgeStale", () => {
		const cache = new TTLCache<string, number>({ ttl: 1000 });
		// Spy on cancelTimer to verify that it's called when the cache becomes empty
		const cancelSpy = vi.spyOn(cache, "cancelTimer");
		cache.set("a", 1, { ttl: 500 });
		vi.advanceTimersByTime(501);
		cache.purgeStale();
		expect(cancelSpy).toHaveBeenCalled();
		cancelSpy.mockRestore();
	});

	it("should call onRemove with 'evict' when evicting items due to capacity constraints", () => {
		const onRemove = vi.fn();
		const cache = new TTLCache<string, number>({ ttl: 1000, max: 2, onRemove });
		cache.set("a", 1, { ttl: 500 });
		cache.set("b", 2, { ttl: 1000 });
		cache.set("c", 3, { ttl: 1500 });
		expect(cache.size).toBe(2);
		expect(onRemove).toHaveBeenCalledWith(expect.any(Number), expect.any(String), "evict");
	});

	it("should iterate in correct order after mixed operations", () => {
		const cache = new TTLCache<string, number>({ ttl: 1000 });
		cache.set("a", 1, { ttl: 500 });
		cache.set("b", 2, { ttl: 1000 });
		cache.set("c", 3, { ttl: 1500 });
		// Delete "b" to mix the order
		cache.delete("b");
		vi.advanceTimersByTime(501);
		cache.purgeStale();
		// Only "c" should remain
		const entries = [...cache.entries()];
		expect(entries).toEqual([["c", 3]]);
	});

	it("should correctly update TTL when both updateAgeOnGet and checkAgeOnGet are enabled", () => {
		const cache = new TTLCache<string, number>({
			ttl: 1000,
			updateAgeOnGet: true,
			checkAgeOnGet: true
		});
		cache.set("a", 1);
		vi.advanceTimersByTime(500);
		expect(cache.get("a")).toBe(1);
		// Advance time such that original TTL would have expired, but TTL was reset
		vi.advanceTimersByTime(600);
		expect(cache.get("a")).toBe(1);
		// Advance beyond the updated TTL
		vi.advanceTimersByTime(1000);
		expect(cache.get("a")).toBeUndefined();
	});

	it("should keep item with Infinity TTL even after long time", () => {
		const cache = new TTLCache<string, number>({ ttl: 1000 });
		cache.set("a", 1, { ttl: Infinity });
		vi.advanceTimersByTime(100000);
		expect(cache.get("a")).toBe(1);
		expect(cache.getRemainingTTL("a")).toBe(Infinity);
	});
});
