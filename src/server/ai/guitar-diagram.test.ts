import { describe, expect, it } from "vitest";
import { renderGuitarDiagram } from "./guitar-diagram";

describe("guitar diagram renderer", () => {
  it("renders only allowlisted semantic diagram data", () => {
    const svg = renderGuitarDiagram({
      title: "C <major>",
      startFret: 1,
      positions: [
        { string: 5, fret: 3, finger: 3, label: "C" },
        { string: 4, fret: 2, finger: 2, label: null }
      ],
      openStrings: [1, 3],
      mutedStrings: [6],
      highlightedNotes: []
    });
    expect(svg).toContain("C &lt;major&gt;");
    expect(svg).toContain("Guitar fretboard diagram");
    expect(svg).not.toContain("<script");
    expect(svg.match(/class="note"/g)).toHaveLength(2);
  });
});
