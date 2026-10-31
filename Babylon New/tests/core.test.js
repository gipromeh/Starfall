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

  it("writes only into the isolated Babylon namespace", () => {
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
