"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LabelList } from "recharts";
import type { BidKpiBreakdown } from "@/lib/queries/bids";

const COLORS: Record<string, string> = {
  "나라장터":  "#00A5FF", // kt-blue
  "누리장터":  "#00BEAC", // kt-teal
  "기타":      "#AA50FF", // kt-purple
};

/**
 * 소스 그룹별 누적 분포 — 가로 막대.
 * 데이터: BidKpiBreakdown[] (today/week/total)
 * 표시: total 기준 (필요 시 mode prop 추가).
 */
export function BidSourceDistribution({
  data,
}: {
  data: BidKpiBreakdown[];
}) {
  const chartData = data.map((d) => ({
    name: d.group,
    value: d.total,
    today: d.today,
    week: d.week,
  }));

  const total = chartData.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-bold text-kt-black">소스별 분포</h3>
        <span className="text-[11px] text-kt-light-gray num">
          누적 {total.toLocaleString("ko-KR")} 건
        </span>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fill: "#4C4C4E", fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: "rgba(162,164,163,0.08)" }}
              contentStyle={{
                background: "white",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={(v: unknown) => {
                const n = typeof v === "number" ? v : 0;
                return [`${n.toLocaleString("ko-KR")}건`, "누적"];
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={26}>
              {chartData.map((d) => (
                <Cell key={d.name} fill={COLORS[d.name] ?? "#A2A4A3"} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => {
                  const n = typeof v === "number" ? v : 0;
                  return n.toLocaleString("ko-KR");
                }}
                style={{ fill: "#0F0F12", fontSize: 12, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
