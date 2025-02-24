import { expect, test, describe, beforeEach, mock } from "bun:test";
import GameState from "../src/utils/game-state";

describe("GameState", () => {
  let gameState: GameState;

  beforeEach(() => {
    // Mock localStorage using Bun's mock API
    const localStorageMock = {
      getItem: mock((key: string) => null),
      setItem: mock((key: string, value: string) => {}),
      removeItem: mock((key: string) => {}),
      clear: mock(() => {}),
    };

    // Replace the global localStorage with our mock.  Critically, we use `globalThis`
    globalThis.localStorage = localStorageMock as unknown as Storage;


    gameState = new GameState();
    // No need to call localStorage.clear() here, as it's already mocked and starts empty.
  });

  test("initial resources", () => {
    expect(gameState.getResources()).toBe(100);
  });

  test("spend resources successfully", () => {
    expect(gameState.spendResources(50)).toBe(true);
    expect(gameState.getResources()).toBe(50);
  });

  test("spend resources unsuccessfully", () => {
    expect(gameState.spendResources(150)).toBe(false);
    expect(gameState.getResources()).toBe(100);
  });

  test("earn resources", () => {
    gameState.earnResources(50);
    expect(gameState.getResources()).toBe(150);
  });

  test("can afford", () => {
    expect(gameState.canAfford(100)).toBe(true);
    expect(gameState.canAfford(101)).toBe(false);
  });

  test("save and load from localStorage", () => {
    // Mock the setItem and getItem methods to simulate localStorage behavior.
    const localStorageMock = globalThis.localStorage as any; // Type assertion for easier mocking
    localStorageMock.setItem.mockImplementation((key: string, value: string) => {
      localStorageMock.getItem.mockImplementation((key:string) => {
          if (key === "game-state") {
              return value;
          }
          return null; // Important: return null for other keys
      })
    });


    gameState.spendResources(20); // modify the resources
    gameState.saveToLocalStorage();

    const newGameState = new GameState();
    newGameState.loadFromLocalStorage();
    expect(newGameState.getResources()).toBe(80);

    // Reset mocks after the test.  Good practice!
    localStorageMock.setItem.mockReset();
    localStorageMock.getItem.mockReset();
  });

    test("loadFromLocalStorage with no data", () => {
        const newGameState = new GameState();
        newGameState.loadFromLocalStorage();
        expect(newGameState.getResources()).toBe(100); // Should default to 100
    });
}); 