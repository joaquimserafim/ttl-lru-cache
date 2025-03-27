import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { TTLLRUCache } from "../ttl-lru-cache";

//
// TTLLRUCache tests
//

describe("TTLLRUCache", () => {
	let cache: TTLLRUCache<string, number>;

	beforeEach(() => {
		vi.useFakeTimers();
		cache = new TTLLRUCache<string, number>(2, 1000); // 1 second TTL
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("set and getValue", () => {
		it("should set and get values with TTL", () => {
			cache.set("a", 1);
			expect(cache.getValue("a")).toBe(1);
		});

		it("should return undefined for expired items", () => {
			cache.set("a", 1);
			vi.advanceTimersByTime(1001); // Advance past TTL
			expect(cache.getValue("a")).toBeUndefined();
		});

		it("should return undefined for non-existent keys", () => {
			expect(cache.getValue("nonexistent")).toBeUndefined();
		});
	});

	describe("getWithTTL", () => {
		it("should return value and remaining TTL", () => {
			cache.set("a", 1);
			const result = cache.getWithTTL("a");
			expect(result).toEqual({
				value: 1,
				ttl: expect.any(Number)
			});
			expect(result!.ttl).toBeLessThanOrEqual(1000);
		});

		it("should return undefined for expired items", () => {
			cache.set("a", 1);
			vi.advanceTimersByTime(1001);
			expect(cache.getWithTTL("a")).toBeUndefined();
		});
	});

	describe("delete", () => {
		it("should remove items from cache", () => {
			cache.set("a", 1);
			cache.delete("a");
			expect(cache.getValue("a")).toBeUndefined();
		});

		it("should handle deleting non-existent keys", () => {
			expect(() => cache.delete("nonexistent")).not.toThrow();
		});
	});

	describe("has", () => {
		it("should return true for existing non-expired items", () => {
			cache.set("a", 1);
			expect(cache.has("a")).toBe(true);
		});

		it("should return false for expired items", () => {
			cache.set("a", 1);
			vi.advanceTimersByTime(1001);
			expect(cache.has("a")).toBe(false);
		});

		it("should return false for non-existent keys", () => {
			expect(cache.has("nonexistent")).toBe(false);
		});
	});

	describe("touch", () => {
		it("should update TTL for existing items", () => {
			cache.set("a", 1);
			vi.advanceTimersByTime(500);
			expect(cache.touch("a")).toBe(true);
			vi.advanceTimersByTime(501);
			expect(cache.getValue("a")).toBe(1);
		});

		it("should return false for non-existent items", () => {
			expect(cache.touch("nonexistent")).toBe(false);
		});

		it("should return false for expired items", () => {
			cache.set("a", 1);
			vi.advanceTimersByTime(1001);
			expect(cache.touch("a")).toBe(false);
		});
	});

	describe("keys", () => {
		it("should return only non-expired keys", () => {
			cache.set("a", 1);
			cache.set("b", 2);
			vi.advanceTimersByTime(1001);
			cache.set("c", 3);
			expect(cache.keys()).toEqual(["c"]);
		});
	});

	describe("LRU behavior", () => {
		it("should evict least recently used item when capacity is reached", () => {
			cache.set("a", 1);
			cache.set("b", 2);
			expect(cache.getValue("a")).toBe(1); // Make "a" most recently used
			cache.set("c", 3); // Should evict "b"
			expect(cache.getValue("b")).toBeUndefined();
			expect(cache.getValue("a")).toBe(1);
			expect(cache.getValue("c")).toBe(3);
		});
	});

	describe("constructor", () => {
		it("should throw error for invalid capacity", () => {
			expect(() => new TTLLRUCache(-1, 1000)).toThrow();
			expect(() => new TTLLRUCache(0, 1000)).toThrow();
		});
	});
});
