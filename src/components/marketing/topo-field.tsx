type Hill = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  turn: number;
  pinch: number;
  rings: number;
  gap: number;
};

const HILLS_A: Hill[] = [
  { cx: 180, cy: 560, rx: 70, ry: 42, turn: -0.6, pinch: 0.1, rings: 9, gap: 36 },
  { cx: 620, cy: 80, rx: 56, ry: 34, turn: 0.4, pinch: 0.08, rings: 6, gap: 40 },
];

const HILLS_B: Hill[] = [
  { cx: 1040, cy: 300, rx: 78, ry: 46, turn: 0.7, pinch: 0.11, rings: 8, gap: 38 },
  { cx: 80, cy: 160, rx: 50, ry: 32, turn: -0.25, pinch: 0.09, rings: 6, gap: 34 },
  { cx: 780, cy: 680, rx: 84, ry: 48, turn: 0.2, pinch: 0.07, rings: 7, gap: 42 },
];

function ringPath(cx: number, cy: number, rx: number, ry: number, turn: number, pinch: number) {
  const steps = 10;
  const points: [number, number][] = [];
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const wave = 1 + pinch * Math.sin(3 * angle + turn * 2);
    const x = Math.cos(angle) * rx * wave;
    const y = Math.sin(angle) * ry * wave;
    points.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }

  let path = "";
  for (let i = 0; i < steps; i++) {
    const p0 = points[(i - 1 + steps) % steps]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % steps]!;
    const p3 = points[(i + 2) % steps]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    if (i === 0) path += `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} `;
    path += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)} `;
  }
  return path;
}

function rings(hills: Hill[]) {
  return hills.flatMap((hill) =>
    Array.from({ length: hill.rings }, (_, index) => {
      const scale = 1 + index;
      return ringPath(hill.cx, hill.cy, hill.rx + hill.gap * (scale - 1) * 0.72, hill.ry + hill.gap * (scale - 1) * 0.46, hill.turn, hill.pinch);
    }),
  );
}

const LINES_A = rings(HILLS_A);
const LINES_B = rings(HILLS_B);

export function TopoField({ id = "kismet-topo", ink = false }: { id?: string; ink?: boolean }) {
  const stroke = ink ? "#111" : `url(#${id})`;
  return (
    <svg className="topo-field" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {ink ? null : (
        <defs>
          <linearGradient id={id} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#111111" />
            <stop offset="55%" stopColor="#6a717c" />
            <stop offset="100%" stopColor="#c5c9cf" />
          </linearGradient>
        </defs>
      )}
      <g className="topo-drift-a" fill="none" stroke={stroke} strokeWidth="1.35">
        {LINES_A.map((d, index) => (
          <path key={`a-${index}`} d={d} opacity={0.4 + (index % 4) * 0.1} />
        ))}
      </g>
      <g className="topo-drift-b" fill="none" stroke={`url(#${id})`} strokeWidth="1.25">
        {LINES_B.map((d, index) => (
          <path key={`b-${index}`} d={d} opacity={0.34 + (index % 4) * 0.1} />
        ))}
      </g>
    </svg>
  );
}
