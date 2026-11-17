"use client";

import { useLayoutEffect, useRef, type PointerEvent } from "react";

export type ConnectorMark = { src: string; name: string };

type Body = { x: number; y: number; vx: number; vy: number; r: number };

const CURSOR = 26;
const MAX_SPEED = 1.7;

function unit(index: number) {
  const x = Math.sin(index * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function spread(width: number, height: number, count: number, radius: number): Body[] {
  const cols = Math.max(1, Math.round(Math.sqrt((count * width) / Math.max(height, 1))));
  const rows = Math.ceil(count / cols);
  const cellW = width / cols;
  const cellH = height / rows;
  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const jitterX = (unit(index + 1) - 0.5) * cellW * 0.28;
    const jitterY = (unit(index + 9) - 0.5) * cellH * 0.28;
    const angle = unit(index + 3) * Math.PI * 2;
    const speed = 0.28 + unit(index + 5) * 0.38;
    return {
      x: Math.min(width - radius, Math.max(radius, (col + 0.5) * cellW + jitterX)),
      y: Math.min(height - radius, Math.max(radius, (row + 0.5) * cellH + jitterY)),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: radius,
    };
  });
}

function separate(a: Body, b: Body) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const min = a.r + b.r;
  if (dist >= min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = (min - dist) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return;
  a.vx -= rel * nx;
  a.vy -= rel * ny;
  b.vx += rel * nx;
  b.vy += rel * ny;
}

function shove(body: Body, x: number, y: number, radius: number) {
  const dx = body.x - x;
  const dy = body.y - y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const min = body.r + radius;
  if (dist >= min) return;
  const nx = dx / dist;
  const ny = dy / dist;
  body.x = x + nx * min;
  body.y = y + ny * min;
  const into = body.vx * nx + body.vy * ny;
  if (into < 0) {
    body.vx -= 1.7 * into * nx;
    body.vy -= 1.7 * into * ny;
  }
  body.vx += nx * 0.45;
  body.vy += ny * 0.45;
}

function contain(body: Body, width: number, height: number) {
  if (body.x < body.r) {
    body.x = body.r;
    body.vx = Math.abs(body.vx);
  } else if (body.x > width - body.r) {
    body.x = width - body.r;
    body.vx = -Math.abs(body.vx);
  }
  if (body.y < body.r) {
    body.y = body.r;
    body.vy = Math.abs(body.vy);
  } else if (body.y > height - body.r) {
    body.y = height - body.r;
    body.vy = -Math.abs(body.vy);
  }
  const speed = Math.hypot(body.vx, body.vy);
  if (speed > MAX_SPEED) {
    body.vx = (body.vx / speed) * MAX_SPEED;
    body.vy = (body.vy / speed) * MAX_SPEED;
  } else if (speed < 0.18) {
    body.vx += body.vx * 0.04 || 0.04;
    body.vy += body.vy * 0.04 || 0.02;
  }
}

export function ConnectorField({ marks }: { marks: ConnectorMark[] }) {
  const field = useRef<HTMLDivElement>(null);
  const nodes = useRef<Array<HTMLSpanElement | null>>([]);
  const bodies = useRef<Body[]>([]);
  const pointer = useRef({ x: 0, y: 0, on: false });

  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const radius = 15;

    let widthSeen = 0;
    let heightSeen = 0;
    const place = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      if (width < 8 || height < 8) return;
      if (Math.abs(width - widthSeen) < 4 && Math.abs(height - heightSeen) < 4) return;
      widthSeen = width;
      heightSeen = height;
      bodies.current = spread(width, height, marks.length, radius);
      paint();
    };

    const paint = () => {
      const list = bodies.current;
      nodes.current.forEach((node, index) => {
        const body = list[index];
        if (!node || !body) return;
        node.style.transform = `translate3d(${body.x - body.r}px, ${body.y - body.r}px, 0)`;
      });
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    if (reduce) return () => observer.disconnect();

    let frame = 0;
    const tick = () => {
      const width = el.clientWidth;
      const height = el.clientHeight;
      const list = bodies.current;
      if (width > 8 && height > 8 && list.length) {
        for (const body of list) {
          body.vx *= 0.997;
          body.vy *= 0.997;
          body.x += body.vx;
          body.y += body.vy;
        }
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) separate(list[i]!, list[j]!);
        }
        const cursor = pointer.current;
        if (cursor.on) {
          for (const body of list) shove(body, cursor.x, cursor.y, CURSOR);
        }
        for (const body of list) contain(body, width, height);
        paint();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [marks.length]);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top, on: true };
  };

  return (
    <div
      ref={field}
      className="ks-marks"
      aria-hidden
      onPointerMove={move}
      onPointerLeave={() => {
        pointer.current.on = false;
      }}
    >
      {marks.map((mark, index) => (
        <span
          key={mark.name}
          ref={(node) => {
            nodes.current[index] = node;
          }}
          className="ks-mark"
          title={mark.name}
        >
          <img src={mark.src} alt="" draggable={false} />
        </span>
      ))}
    </div>
  );
}
