import { prisma } from "@/lib/db/prisma";

async function main() {
  const alex = await prisma.child.findFirstOrThrow({
    where: { name: "Alex" }, orderBy: { createdAt: "desc" },
  });
  const hyps = await prisma.hypothesis.findMany({
    where: { childId: alex.id },
    include: { revisions: { orderBy: { createdAt: "asc" } } },
    orderBy: { confidence: "desc" },
  });
  console.log("HOW EACH BELIEF MOVED\n");
  for (const h of hyps) {
    if (!h.revisions.length) continue;
    const pts = [h.revisions[0].before, ...h.revisions.map((r) => r.after)];
    const bar = pts.map((p) => "▁▂▃▄▅▆▇█"[Math.min(7, Math.floor(p * 8))]).join("");
    const delta = pts[pts.length - 1] - pts[0];
    console.log(`  ${bar}  ${h.type}`);
    console.log(`     ${Math.round(pts[0]*100)}% → ${Math.round(pts[pts.length-1]*100)}% (${delta>=0?"+":""}${Math.round(delta*100)}) · ${h.status}`);
  }
  const iv = await prisma.intervention.findMany({
    where: { childId: alex.id, successful: { not: null } },
  });
  const m = new Map<string, {a:number;s:number}>();
  for (const i of iv) {
    const c = m.get(i.strategy) ?? {a:0,s:0}; c.a++; if (i.successful) c.s++; m.set(i.strategy,c);
  }
  console.log("\nWHAT IT TRIED\n");
  for (const [k,v] of [...m].sort((a,b)=>b[1].s-a[1].s)) {
    console.log(`  ${v.s>0 ? "✓" : "✗"} ${k.replace(/_/g," ").padEnd(20)} ${v.s}/${v.a}`);
  }
}
main().catch((e)=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
