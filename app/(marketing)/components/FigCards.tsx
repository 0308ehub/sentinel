const cards = [
  {
    fig: "FIG 0.1",
    title: "Built on signals",
    description:
      "Sentinel is shaped by real customer conversations and product feedback from every channel.",
    illustration: (
      <svg
        width="200"
        height="160"
        viewBox="0 0 200 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bottom layer */}
        <path
          d="M40 120 L100 90 L160 120 L100 150 Z"
          stroke="#2a2a2a"
          strokeWidth="1.5"
        />
        {/* Middle layer */}
        <path
          d="M40 100 L100 70 L160 100 L100 130 Z"
          stroke="#333"
          strokeWidth="1.5"
        />
        {/* Top layer */}
        <path
          d="M40 80 L100 50 L160 80 L100 110 Z"
          stroke="#444"
          strokeWidth="1.5"
        />
        {/* Circle on top layer */}
        <ellipse
          cx="100"
          cy="80"
          rx="25"
          ry="12"
          stroke="#555"
          strokeWidth="1.5"
        />
        {/* Lines on bottom layers */}
        <line
          x1="60"
          y1="115"
          x2="140"
          y2="115"
          stroke="#222"
          strokeWidth="1"
        />
        <line
          x1="55"
          y1="105"
          x2="145"
          y2="105"
          stroke="#1e1e1e"
          strokeWidth="1"
        />
        {/* Vertical edges */}
        <line
          x1="40"
          y1="80"
          x2="40"
          y2="120"
          stroke="#333"
          strokeWidth="1.5"
        />
        <line
          x1="160"
          y1="80"
          x2="160"
          y2="120"
          stroke="#333"
          strokeWidth="1.5"
        />
        <line
          x1="100"
          y1="110"
          x2="100"
          y2="150"
          stroke="#2a2a2a"
          strokeWidth="1.5"
        />
      </svg>
    ),
  },
  {
    fig: "FIG 0.2",
    title: "Powered by AI agents",
    description:
      "Designed for workflows shared by humans and agents. From surfacing insights to closing tickets.",
    illustration: (
      <svg
        width="200"
        height="160"
        viewBox="0 0 200 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Large cube center */}
        <path
          d="M80 60 L110 44 L140 60 L140 92 L110 108 L80 92 Z"
          stroke="#444"
          strokeWidth="1.5"
        />
        <line
          x1="110"
          y1="44"
          x2="110"
          y2="76"
          stroke="#333"
          strokeWidth="1.5"
        />
        <line
          x1="110"
          y1="76"
          x2="80"
          y2="92"
          stroke="#333"
          strokeWidth="1.5"
        />
        <line
          x1="110"
          y1="76"
          x2="140"
          y2="92"
          stroke="#333"
          strokeWidth="1.5"
        />
        {/* Small cube top-left */}
        <path
          d="M30 80 L50 70 L70 80 L70 100 L50 110 L30 100 Z"
          stroke="#333"
          strokeWidth="1.2"
        />
        <line
          x1="50"
          y1="70"
          x2="50"
          y2="90"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        <line
          x1="50"
          y1="90"
          x2="30"
          y2="100"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        <line
          x1="50"
          y1="90"
          x2="70"
          y2="100"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        {/* Small cube bottom-right */}
        <path
          d="M130 100 L150 90 L170 100 L170 120 L150 130 L130 120 Z"
          stroke="#333"
          strokeWidth="1.2"
        />
        <line
          x1="150"
          y1="90"
          x2="150"
          y2="110"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        <line
          x1="150"
          y1="110"
          x2="130"
          y2="120"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        <line
          x1="150"
          y1="110"
          x2="170"
          y2="120"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
      </svg>
    ),
  },
  {
    fig: "FIG 0.3",
    title: "Designed for speed",
    description:
      "Reduces noise and restores momentum to help product teams ship with focus and velocity.",
    illustration: (
      <svg
        width="200"
        height="160"
        viewBox="0 0 200 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Back cards */}
        <rect
          x="100"
          y="30"
          width="70"
          height="90"
          rx="4"
          stroke="#1e1e1e"
          strokeWidth="1.5"
          transform="rotate(15 135 75)"
        />
        <rect
          x="95"
          y="30"
          width="70"
          height="90"
          rx="4"
          stroke="#252525"
          strokeWidth="1.5"
          transform="rotate(8 130 75)"
        />
        {/* Front card */}
        <rect
          x="60"
          y="35"
          width="75"
          height="95"
          rx="4"
          stroke="#444"
          strokeWidth="1.5"
        />
        {/* Lines on front card */}
        <line
          x1="72"
          y1="55"
          x2="122"
          y2="55"
          stroke="#333"
          strokeWidth="1.2"
        />
        <line
          x1="72"
          y1="67"
          x2="115"
          y2="67"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        <line
          x1="72"
          y1="79"
          x2="118"
          y2="79"
          stroke="#2a2a2a"
          strokeWidth="1"
        />
        <line
          x1="72"
          y1="91"
          x2="110"
          y2="91"
          stroke="#222"
          strokeWidth="1"
        />
        {/* Speed lines */}
        <line
          x1="30"
          y1="70"
          x2="55"
          y2="70"
          stroke="#1e1e1e"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="25"
          y1="82"
          x2="57"
          y2="82"
          stroke="#1e1e1e"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="94"
          x2="58"
          y2="94"
          stroke="#1a1a1a"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function FigCards() {
  return (
    <section className="border-t border-white/[0.06]">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x divide-y md:divide-y-0 divide-white/[0.06]">
          {cards.map((card) => (
            <div key={card.fig} className="px-10 py-12 flex flex-col">
              <p className="text-[11px] font-medium text-[#444] tracking-[0.15em] uppercase mb-12">
                {card.fig}
              </p>
              <div className="flex-1 flex items-center justify-center mb-10">
                {card.illustration}
              </div>
              <div>
                <h3 className="text-[15px] font-medium text-white mb-2">
                  {card.title}
                </h3>
                <p className="text-[14px] text-[#555] leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
