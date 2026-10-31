
import { describe, it, expect } from "vitest";
import { EventBus } from "../src/core/EventBus.js";
import { SaveStore } from "../src/core/SaveStore.js";

describe("EventBus", () => {
  it("emits and unsubscribes", () => {
    const bus = new EventBus();
    const received = [];
    const off = bus.on("tick", value => received.push(value));
    bus.emit("tick", 1);
    off();
    bus.emit("tick", 2);
    expect(received).toEqual([1]);
  });
});

describe("SaveStore", () => {
  it("reads legacy values without modifying them", () => {
    const values = new Map([["sf_sv", "{\"credits\":10}"], ["sf_hi", "12"]]);
    const storage = {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value)
    };
    const store = new SaveStore(storage);
    expect(store.readLegacy()).toEqual({ sf_sv: "{\"credits\":10}", sf_hi: "12" });
    expect(values.get("sf_sv")).toBe("{\"credits\":10}");
  });

  it("writes versioned data into an isolated namespace", () => {
    const values = new Map();
    const storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    };
    const store = new SaveStore(storage);
    expect(store.writeNamespaced({ credits: 25 })).toBe(true);
    expect(JSON.parse(values.get("sf_babylon_new")).data.credits).toBe(25);
    expect(values.has("sf_sv")).toBe(false);
  });
});


import { FlightModel } from "../src/simulation/FlightModel.js";

describe("FlightModel", () => {
  const makeInput = (...pressed) => {
    const keys = new Set(pressed);
    return {
      down: code => keys.has(code),
      pointer: { x: 0.5, y: 0.5 },
      consumeFlip: () => false
    };
  };

  it("ramps throttle using the original W/S control", () => {
    const model = new FlightModel();
    model.update(1, makeInput("KeyW"));
    expect(model.throttle).toBeCloseTo(0.8, 5);
  });

  it("accelerates forward and damps lateral drift", () => {
    const model = new FlightModel();
    const input = makeInput("KeyW", "KeyD");
    for (let i = 0; i < 60; i++) model.update(1 / 60, input);
    expect(model.velocity.length()).toBeGreaterThan(10);
    const before = model.velocity.x;
    for (let i = 0; i < 60; i++) model.update(1 / 60, makeInput("KeyW"));
    expect(Math.abs(model.velocity.x)).toBeLessThan(Math.abs(before) + 0.01);
  });
});
