import { openingBeat } from "@/lib/ai/realtime";
for (let i = 0; i < 6; i++) {
  const b = openingBeat(i, "Michael");
  console.log(`turn ${i}: ${b ? b.slice(0, 96) + "…" : "(opening over — teaching now)"}`);
}
