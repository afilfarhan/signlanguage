"use client";

import { useState } from "react";
import { CalibrationLayer, computeECE } from "@/lib/calibration";

interface CalibrationData {
  bins: number;
  confidences: number[];
  accuracies: number[];
  ece: number;
}

interface Props {
  data: CalibrationData;
  threshold?: number;
}

/**
 * ReliabilityDiagram — Visualizes model calibration
 *
 * Shows a 10-bin accuracy vs. confidence plot.
 * Perfect calibration is the diagonal y = x.
 */
export default function ReliabilityDiagram({ data, threshold = 0.05 }: Props) {
  const nBins = data.bins || 10;
  const width = 400;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Build bin data
  const binData: { conf: number; acc: number; count: number }[] = [];
  for (let i = 0; i < nBins; i++) {
    binData.push({ conf: 0, acc: 0, count: 0 });
  }

  for (let i = 0; i < data.confidences.length; i++) {
    const binIdx = Math.min(nBins - 1, Math.floor(data.confidences[i] * nBins));
    binData[binIdx].conf += data.confidences[i];
    binData[binIdx].acc += data.accuracies[i];
    binData[binIdx].count++;
  }

  const bars = binData.map((bin, i) => {
    const avgConf = bin.count > 0 ? bin.conf / bin.count : (i + 0.5) / nBins;
    const avgAcc = bin.count > 0 ? bin.acc / bin.count : 0;
    const x = (i / nBins) * innerWidth + padding.left;
    const barWidth = innerWidth / nBins - 2;
    const yConf = padding.top + (1 - avgConf) * innerHeight;
    const yAcc = padding.top + (1 - avgAcc) * innerHeight;
    return { x, yConf, yAcc, barWidth, avgConf, avgAcc, count: bin.count };
  });

  const ece = data.ece || computeECE(data.confidences, data.accuracies, nBins);
  const calibrated = ece <= threshold;

  return (
    <div className="rounded-2xl border border-line bg-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">Reliability Diagram</h3>
        <div className={`text-sm ${calibrated ? "text-ok" : "text-bad"}`}>
          ECE = {ece.toFixed(4)} {calibrated ? "✓" : "✗"} (threshold: {threshold})
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md mx-auto">
        {/* Grid lines */}
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <line
            key={t}
            x1={padding.left}
            y1={padding.top + (1 - t) * innerHeight}
            x2={padding.left + innerWidth}
            y2={padding.top + (1 - t) * innerHeight}
            stroke="#e5e7eb"
            strokeDasharray="2,2"
          />
        ))}

        {/* Diagonal (perfect calibration) */}
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top}
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="4,4"
        />

        {/* Bars */}
        {bars.map((bar, i) => (
          <g key={i}>
            <rect
              x={bar.x}
              y={Math.min(bar.yConf, bar.yAcc)}
              width={bar.barWidth}
              height={Math.abs(bar.yAcc - bar.yConf)}
              fill={Math.abs(bar.avgConf - bar.avgAcc) < 0.1 ? "#22c55e" : "#ef4444"}
              opacity={0.6}
              rx={2}
            />
            <rect
              x={bar.x}
              y={bar.yConf - 4}
              width={bar.barWidth}
              height={8}
              fill="#6366f1"
              rx={4}
            />
          </g>
        ))}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          stroke="#374151"
          strokeWidth={2}
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + innerHeight}
          stroke="#374151"
          strokeWidth={2}
        />

        {/* Labels */}
        <text x={padding.left + innerWidth / 2} y={height - 5} textAnchor="middle" fontSize={12} fill="#6b7280">
          Confidence
        </text>
        <text
          x={15}
          y={padding.top + innerHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90, 15, ${padding.top + innerHeight / 2})`}
          fontSize={12}
          fill="#6b7280"
        >
          Accuracy
        </text>
      </svg>
    </div>
  );
}
