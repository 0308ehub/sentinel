import { openingBeat } from "@/lib/ai/realtime";
for (const hasName of [false, true]) {
  console.log(hasName ? "\n--- mentor already named ---" : "--- brand new, no name ---");
  for (let i = 0; i < 5; i++) {
    const b = openingBeat(i, "Michael", hasName);
    console.log(`  turn ${i}: ${b ? b.slice(0, 88) + "…" : "(opening over — teaching now)"}`);
  }
}
