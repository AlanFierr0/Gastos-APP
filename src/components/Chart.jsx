import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

export function LineSeries({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="income" stroke="#135bec" strokeWidth={2} />
        <Line type="monotone" dataKey="expenses" stroke="#50E3C2" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PieBreakdown({ data, colors }) {
  const palette = colors || ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa'];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
          {data.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BarCompare({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="income" fill="#135bec" radius={[6,6,0,0]} />
        <Bar dataKey="expenses" fill="#50E3C2" radius={[6,6,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}





