import type { GuitarDiagram } from "#/shared/contracts";

const escapeXml = (value: string): string =>
  value.replace(
    /[<>&"']/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;"
      })[character] ?? character
  );

export function renderGuitarDiagram(diagram: GuitarDiagram): string {
  const left = 124;
  const top = 170;
  const stringGap = 110;
  const fretGap = 105;
  const frets = 5;
  const xForString = (string: number) => left + (6 - string) * stringGap;
  const yForFret = (fret: number) => top + (fret - diagram.startFret + 0.5) * fretGap;
  const strings = Array.from(
    { length: 6 },
    (_, index) => `<line x1="${left + index * stringGap}" y1="${top}" x2="${left + index * stringGap}" y2="${top + frets * fretGap}" />`
  ).join("");
  const fretLines = Array.from(
    { length: frets + 1 },
    (_, index) => `<line x1="${left}" y1="${top + index * fretGap}" x2="${left + 5 * stringGap}" y2="${top + index * fretGap}" />`
  ).join("");
  const positions = diagram.positions
    .filter((position) => position.fret >= diagram.startFret && position.fret < diagram.startFret + frets)
    .map((position) => {
      const label = position.label ?? (position.finger === null ? "" : String(position.finger));
      return `<g><circle class="note" cx="${xForString(position.string)}" cy="${yForFret(position.fret)}" r="34"/><text class="finger" x="${xForString(position.string)}" y="${yForFret(position.fret) + 11}">${escapeXml(label)}</text></g>`;
    })
    .join("");
  const markers = Array.from({ length: 6 }, (_, index) => {
    const string = 6 - index;
    const marker = diagram.mutedStrings.includes(string) ? "×" : diagram.openStrings.includes(string) ? "○" : "";
    return marker ? `<text class="marker" x="${left + index * stringGap}" y="${top - 54}">${marker}</text>` : "";
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(diagram.title)}</title><desc id="desc">Guitar fretboard diagram</desc>
  <rect width="800" height="800" fill="#f8f1e7" rx="42"/>
  <style>.grid{stroke:#312f3c;stroke-width:6;stroke-linecap:round}.note{fill:#5b5bd6}.finger,.marker,.start{font-family:system-ui,sans-serif;text-anchor:middle;fill:#fff;font-size:28px;font-weight:800}.marker{fill:#312f3c;font-size:38px}.start{fill:#6e697b;text-anchor:end;font-size:24px}</style>
  <text x="400" y="78" text-anchor="middle" font-family="system-ui,sans-serif" font-size="34" font-weight="800" fill="#312f3c">${escapeXml(diagram.title)}</text>
  <g class="grid">${strings}${fretLines}</g>${markers}${positions}
  <text class="start" x="${left - 28}" y="${top + 36}">${diagram.startFret}fr</text>
  </svg>`;
}
