"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

/**
 * 일별 수집 추이 — 라인 차트 (최근 N일).
 */
export function BidDailyTrend({ data }: { data: { date: string; n: number }[] }) {
  const max = Math.max(0, ...data.map((d) => d.n));

  return (
    <div className="rounded-lg border border-kt-light-gray/40 bg-white p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-sm font-bold text-kt-black">일별 수집 추이</h3>
        <span className="text-[11px] text-kt-light-gray num">
          최근 {data.length}일 · 최대 {max.toLocaleString("ko-KR")}건/일
        </span>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#A2A4A3" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(d: string) => d.slice(5).replace("-", "/")}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#A2A4A3" }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid #E5E5E5",
                borderRadius: "8px",
                fontSize: 12,
              }}
              labelFormatter={(d) => `${d}`}
              formatter={(v: unknown) => {
                const n = typeof v === "number" ? v : 0;
                return [`${n.toLocaleString("ko-KR")}건`, "수집"];
              }}
            />
            <Line
              type="monotone"
              dataKey="n"
              stroke="#FE2E36"
              strokeWidth={2}
              dot={{ r: 3, fill: "#FE2E36", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#FE2E36", strokeWidth: 2, stroke: "#FFFFFF" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
