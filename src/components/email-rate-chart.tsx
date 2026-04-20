"use client";

import { useMemo, useState } from "react";

export interface DailyStat {
  date: string;         // YYYY-MM-DD
  sent: number;
  clicked: number;      // emails with >=1 click
  conversions: number;  // paid orders attributed to emails sent that day
}

interface Props {
  data: DailyStat[]; // Expected: 30 days, oldest first, ending on today
}

export function EmailRateChart({ data }: Props) {
  const [range, setRange] = useState<7 | 30>(7);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo(() => data.slice(-range), [data, range]);

  // Compute rates (%)
  const series = useMemo(
    () =>
      points.map((d) => ({
        ...d,
        clickRate: d.sent > 0 ? (d.clicked / d.sent) * 100 : 0,
        convRate: d.sent > 0 ? (d.conversions / d.sent) * 100 : 0,
      })),
    [points]
  );

  // Chart dimensions (viewBox units — responsive via width=100%)
  const W = 800;
  const H = 280;
  const padL = 44;
  const padR = 20;
  const padT = 16;
  const padB = 42;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxRate = Math.max(
    10,
    ...series.map((d) => Math.max(d.clickRate, d.convRate))
  );
  const yMax = Math.ceil(maxRate / 5) * 5; // snap to nearest 5%

  const xFor = (i: number) =>
    series.length <= 1
      ? padL + innerW / 2
      : padL + (i * innerW) / (series.length - 1);
  const yFor = (rate: number) => padT + innerH - (rate / yMax) * innerH;

  const clickPath = series
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.clickRate)}`)
    .join(" ");
  const convPath = series
    .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(d.convRate)}`)
    .join(" ");

  // Y-axis grid lines at 0, 25, 50, 75, 100% of yMax
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    v: yMax * f,
    y: padT + innerH - f * innerH,
  }));

  // X-axis tick labels — show ~7 labels max
  const labelStep = Math.max(1, Math.ceil(series.length / 7));

  function fmtDateShort(s: string) {
    const d = new Date(s + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    if (series.length === 0) return;
    // Nearest index
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < series.length; i++) {
      const d = Math.abs(xFor(i) - x);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const hovered = hoverIdx != null ? series[hoverIdx] : null;
  const hoverX = hoverIdx != null ? xFor(hoverIdx) : 0;

  // Tooltip positioning: flip to left side if hovering near right edge
  const tooltipW = 180;
  const tooltipFlipLeft = hoverX + 12 + tooltipW > W - padR;

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Rates over time
        </span>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-blue-500" />
              Click rate
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 bg-emerald-500" />
              Conversion rate
            </span>
          </div>
          {/* Range toggle */}
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setRange(7);
                setHoverIdx(null);
              }}
              className={`px-3 py-1 text-xs ${
                range === 7
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              7 days
            </button>
            <button
              type="button"
              onClick={() => {
                setRange(30);
                setHoverIdx(null);
              }}
              className={`px-3 py-1 text-xs border-l border-gray-300 ${
                range === 30
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              30 days
            </button>
          </div>
        </div>
      </div>

      <div className="relative px-2 pt-2 pb-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[280px] select-none"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Y-axis grid */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={padL}
                x2={W - padR}
                y1={t.y}
                y2={t.y}
                stroke="#f3f4f6"
                strokeWidth={1}
              />
              <text
                x={padL - 8}
                y={t.y + 4}
                textAnchor="end"
                fontSize={11}
                fill="#9ca3af"
              >
                {t.v.toFixed(0)}%
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {series.map((d, i) =>
            i % labelStep === 0 || i === series.length - 1 ? (
              <text
                key={i}
                x={xFor(i)}
                y={H - padB + 18}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
              >
                {fmtDateShort(d.date)}
              </text>
            ) : null
          )}

          {/* Baseline */}
          <line
            x1={padL}
            x2={W - padR}
            y1={padT + innerH}
            y2={padT + innerH}
            stroke="#e5e7eb"
            strokeWidth={1}
          />

          {/* Hover vertical line */}
          {hoverIdx != null && (
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padT}
              y2={padT + innerH}
              stroke="#d1d5db"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}

          {/* Lines */}
          <path
            d={clickPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={convPath}
            fill="none"
            stroke="#10b981"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dots */}
          {series.map((d, i) => (
            <g key={`pt-${i}`}>
              <circle
                cx={xFor(i)}
                cy={yFor(d.clickRate)}
                r={hoverIdx === i ? 4.5 : 2.5}
                fill="#3b82f6"
              />
              <circle
                cx={xFor(i)}
                cy={yFor(d.convRate)}
                r={hoverIdx === i ? 4.5 : 2.5}
                fill="#10b981"
              />
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hovered && hoverIdx != null && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-gray-200 bg-white shadow-md px-3 py-2 text-xs"
            style={{
              left: `${
                ((tooltipFlipLeft ? hoverX - 12 - tooltipW : hoverX + 12) /
                  W) *
                100
              }%`,
              top: 20,
              width: tooltipW,
            }}
          >
            <div className="font-semibold text-gray-800 mb-1">
              {new Date(hovered.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                Click rate
              </span>
              <span className="font-semibold text-gray-800">
                {hovered.clickRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-0.5">
              <span className="inline-flex items-center gap-1.5 text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                Conversion rate
              </span>
              <span className="font-semibold text-gray-800">
                {hovered.convRate.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 pt-1 border-t border-gray-100 text-gray-500">
              {hovered.sent.toLocaleString()} sent · {hovered.clicked.toLocaleString()}{" "}
              clicked · {hovered.conversions.toLocaleString()} conv.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
