import { describe, expect, it } from "vitest";

import { clampScale, nextScaleFromWheel } from "../../apps/web/src/components/canvasMath";

describe("canvas zoom math", () => {
  it("clamps scale between min and max", () => {
    expect(clampScale(0.1)).toBe(0.45);
    expect(clampScale(5)).toBe(2.8);
    expect(clampScale(1.4)).toBe(1.4);
  });

  it("updates scale from mouse wheel delta", () => {
    expect(nextScaleFromWheel(1, -20)).toBe(1.1);
    expect(nextScaleFromWheel(1, 20)).toBe(0.9);
  });
});
