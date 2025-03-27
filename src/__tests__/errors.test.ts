import { vi, describe, it, expect, afterEach } from "vitest";

import { TTLLRUCache } from "../ttl-lru-cache";

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

describe("error handling", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("should handle non-Error objects in getValue", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.getValue("a")).toThrow("object error");
	});

	it("should handle non-Error objects in getValu	eSafe", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.getValueSafe("a")).toThrow("object error");
	});

	it("should handle non-Error objects in getWithTTL", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.getWithTTL("a")).toThrow("object error");
	});

	it("should handle non-Error objects in keys", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.keys()).toThrow("object error");
	});

	it("should handle non-Error objects in delete", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.delete("a")).toThrow("object error");
	});

	it("should handle non-Error objects in has", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.has("a")).toThrow("object error");
	});

	it("should handle non-Error objects in touch", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.touch("a")).toThrow("object error");
	});

	it("should handle non-Error objects in set", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.set("a", 1)).toThrow("object error");
	});

	it("should handle non-Error objects in get", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.get("a")).toThrow();
	});

	it("should handle KeyNotFoundError in getValue", () => {
		const cache = new TTLLRUCache<string, number>(2);
		const result = cache.getValue("nonexistent");
		expect(result).toBeUndefined();
	});

	it("should handle KeyNotFoundError in getWithTTL", () => {
		const cache = new TTLLRUCache<string, number>(2);
		const result = cache.getWithTTL("nonexistent");
		expect(result).toBeUndefined();
	});

	it("should handle KeyNotFoundError in delete", () => {
		const cache = new TTLLRUCache<string, number>(2);
		expect(() => cache.delete("nonexistent")).not.toThrow();
	});

	it("should handle KeyNotFoundError in has", () => {
		const cache = new TTLLRUCache<string, number>(2);
		const result = cache.has("nonexistent");
		expect(result).toBeFalsy();
	});

	it("should handle KeyNotFoundError in touch", () => {
		const cache = new TTLLRUCache<string, number>(2);
		const result = cache.touch("nonexistent");
		expect(result).toBeFalsy();
	});

	it("should handle errors in keys method", () => {
		const cache = new TTLLRUCache<string, number>(2);
		cache.set("key", 1);
		const keys = cache.keys();
		expect(Array.isArray(keys)).toBeTruthy();
		expect(keys.length).toBe(0);
	});

	it("should handle expired items in keys method", () => {
		const cache = new TTLLRUCache<string, number>(2, 1); // 1ms TTL
		cache.set("key", 1);
		// Wait for expiration
		return new Promise((resolve) =>
			setTimeout(() => {
				const keys = cache.keys();
				expect(keys.length).toBe(0);
				resolve(true);
			}, 2)
		);
	});
});
