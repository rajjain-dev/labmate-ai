"use client";

import { SafetyManual } from "@/components/sable/SafetyManual";
import { cn } from "@/components/sable/utils";

const TILES = [
  { symbol: "S", number: "16", mass: "32.1" },
  { symbol: "A", number: "13", mass: "27.0" },
  { symbol: "B", number: "5", mass: "10.8" },
  { symbol: "L", number: "71", mass: "175.0" },
  { symbol: "E", number: "63", mass: "152.0" },
];

export default function Home() {
  return (
    <div className="sable-app relative min-h-dvh overflow-hidden bg-background">
      <div
        aria-hidden
        className="table-top pointer-events-none absolute inset-0"
        style={{ backgroundImage: "url(/sable/lab-table.jpg)", backgroundSize: "cover" }}
      />

      <h1 className="sr-only">SABLE — Your chemistry lab companion</h1>
      <SafetyManual>
        <div className="sable-tiles flex items-stretch gap-2" aria-hidden="true">
          {TILES.map((tile, i) => (
            <div
              key={tile.symbol}
              className={cn(
                "cartoon-sm relative flex h-20 w-14 flex-col rounded-lg bg-card px-2.5 py-2 sm:h-32 sm:w-28 sm:px-3",
                i % 2 === 1 && "translate-y-2",
              )}
            >
              <span className="text-left font-mono text-xs font-semibold leading-none text-muted-foreground sm:text-sm">
                {tile.number}
              </span>
              <span className="mt-auto text-center font-display text-4xl font-bold leading-none text-foreground sm:text-6xl">
                {tile.symbol}
              </span>
              <span className="mt-1 text-right font-mono text-[10px] font-medium leading-none text-muted-foreground sm:text-[11px]">
                {tile.mass}
              </span>
            </div>
          ))}
        </div>
        <p className="sable-tagline max-w-80 px-4 text-center font-semibold text-muted-foreground">Your handout. A quick brief.<br />A little help, out loud.</p>
      </SafetyManual>
    </div>
  );
}
