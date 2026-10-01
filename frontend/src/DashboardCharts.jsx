import {
  ArrowRight,
  FileChartColumn,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const riskColors = { High: '#d3654f', Medium: '#d79536', Low: '#337b61' };

function EmptyChart({ icon: Icon, title, detail, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={20} aria-hidden="true" /></span><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

export default function DashboardCharts({ total, churn, noChurn, risks, loading, onNavigate }) {
  const outcomes = [
    { name: 'Churn', value: churn, fill: '#d3654f' },
    { name: 'No churn', value: noChurn, fill: '#337b61' },
  ];
  const riskData = [
    { name: 'High', count: Number(risks.high || 0), fill: riskColors.High },
    { name: 'Medium', count: Number(risks.medium || 0), fill: riskColors.Medium },
    { name: 'Low', count: Number(risks.low || 0), fill: riskColors.Low },
  ];

  return <section className="analytics-grid" aria-label="Outcome analysis">
    <article className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">Outcome mix</span><h2>Predictions by outcome</h2></div><span className="panel-meta">{total.toLocaleString()} total</span></div>
      {loading ? <div className="chart-loading"><LoaderCircle className="spin" /> Loading statistics</div> : total === 0 ? <EmptyChart icon={FileChartColumn} title="Nothing to chart" detail="Run a prediction to begin building a view of outcomes." action={<button className="text-action" onClick={() => onNavigate('predict')}>Start an assessment <ArrowRight size={14} /></button>} /> : <div className="outcome-chart-wrap">
        <div className="donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={outcomes} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="94%" paddingAngle={3} stroke="none">{outcomes.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip formatter={(value, name) => [value, name]} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{total}</strong><span>records</span></div></div>
        <div className="chart-legend">{outcomes.map((item) => <div key={item.name}><span className="legend-dot" style={{ backgroundColor: item.fill }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div>
      </div>}
    </article>
    <article className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">Exposure</span><h2>Risk distribution</h2></div><span className="panel-meta">By assessment</span></div>
      {loading ? <div className="chart-loading"><LoaderCircle className="spin" /> Loading statistics</div> : total === 0 ? <EmptyChart icon={ShieldCheck} title="No risk levels yet" detail="Risk is assigned to each completed prediction." /> : <div className="risk-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={riskData} layout="vertical" margin={{ top: 2, right: 14, left: 6, bottom: 2 }}><CartesianGrid horizontal={false} stroke="#e5e9e3" /><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={58} tick={{ fill: '#59645e', fontSize: 12 }} /><Tooltip cursor={{ fill: '#f1f3ed' }} /><Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={16}>{riskData.map((item) => <Cell key={item.name} fill={item.fill} />)}</Bar></BarChart></ResponsiveContainer></div>}
      <div className="risk-summary">{riskData.map((item) => <div key={item.name}><span className="legend-dot" style={{ backgroundColor: item.fill }} />{item.name}<strong>{item.count}</strong></div>)}</div>
    </article>
  </section>;
}
