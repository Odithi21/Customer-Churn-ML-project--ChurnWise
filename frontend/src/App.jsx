import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Building2,
  Check, ChevronRight, CircleHelp, Clock3, Database, Gauge, History,
  Info, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Users, Wifi, X,
} from 'lucide-react';
import { api } from './api.js';
import { featureGroups, humanizeFeature, initialForm, latestPredictionByCustomer, payloadFromCustomer } from './data.js';

const DashboardCharts = lazy(() => import('./DashboardCharts.jsx'));

const navigation = [
  { id: 'dashboard', label: 'Overview', icon: Gauge },
  { id: 'predict', label: 'New prediction', icon: Activity },
  { id: 'explain', label: 'Explainability', icon: Sparkles },
  { id: 'history', label: 'History', icon: History },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'about', label: 'About', icon: CircleHelp },
];

const headings = {
  dashboard: ['Operations', 'Churn overview'],
  predict: ['Assessment', 'Customer prediction'],
  explain: ['Model transparency', 'Explainability'],
  history: ['Records', 'Prediction history'],
  customers: ['Portfolio', 'Customers'],
  about: ['System notes', 'About ChurnWise'],
};

const numericKeys = new Set(['SeniorCitizen', 'tenure', 'MonthlyCharges', 'TotalCharges']);

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date);
}

function customerName(customer, fallback = 'Unassigned') {
  return customer?.externalCustomerId || fallback;
}

function ErrorNotice({ message, onRetry }) {
  if (!message) return null;
  return <div className="notice notice-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{message}</span>{onRetry && <button className="text-action" onClick={onRetry}>Retry</button>}</div>;
}

function EmptyState({ icon: Icon = Database, title, detail, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={20} aria-hidden="true" /></span><h3>{title}</h3><p>{detail}</p>{action}</div>;
}

function RiskBadge({ level }) {
  const name = level || 'Unknown';
  return <span className={`risk-badge risk-${name.toLowerCase()}`}><i />{name} risk</span>;
}

function PredictionTable({ predictions, onExplain, explainingId }) {
  if (!predictions.length) return <EmptyState title="No predictions yet" detail="Your completed assessments will appear here." />;
  return <div className="table-scroll"><table className="data-table">
    <thead><tr><th>Customer</th><th>Outcome</th><th>Probability</th><th>Risk</th><th>Model</th><th>Predicted</th><th aria-label="Actions" /></tr></thead>
    <tbody>{predictions.map((record) => <tr key={record.id}>
      <td><span className="customer-cell">{customerName(record.customer, `Customer ${record.customerId?.slice(-6) || '—'}`)}</span></td>
      <td><span className={`outcome outcome-${record.prediction === 'Churn' ? 'churn' : 'stay'}`}>{record.prediction}</span></td>
      <td className="mono">{formatPercent(record.churnProbability)}</td><td><RiskBadge level={record.riskLevel} /></td>
      <td>{record.modelUsed || '—'}</td><td className="date-cell">{formatDate(record.predictedAt)}</td>
      <td>{record.customer && <button className="icon-button explain-record" aria-label={`Explain prediction for ${customerName(record.customer)}`} title="Explain this prediction" disabled={explainingId === record.id} onClick={() => onExplain(record)}>{explainingId === record.id ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}</button>}</td>
    </tr>)}</tbody>
  </table></div>;
}

function Dashboard({ stats, customers, history, errors, loading, onRefresh, onNavigate, onExplain, explainingId }) {
  const churn = Number(stats?.churnPredictions || 0);
  const noChurn = Number(stats?.noChurnPredictions || 0);
  const total = Number(stats?.totalPredictions || 0);
  const risks = stats?.riskCounts || { high: 0, medium: 0, low: 0 };
  return <>
    <div className="toolbar-line"><p className="lede">A live read on retention activity and customer risk.</p><button className="button button-secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh data</button></div>
    <ErrorNotice message={errors.stats || errors.customers || errors.history} onRetry={onRefresh} />
    <section className="metric-row" aria-label="Prediction statistics">
      <article className="metric metric-primary"><span>Total predictions</span><strong>{loading && !stats ? '—' : total.toLocaleString()}</strong><small>All recorded assessments</small></article>
      <article className="metric"><span>Customers</span><strong>{loading && !customers ? '—' : (customers || []).length.toLocaleString()}</strong><small>In the retention portfolio</small></article>
      <article className="metric"><span>Churn predictions</span><strong>{churn.toLocaleString()}</strong><small>{total ? `${formatPercent(churn / total)} of assessments` : 'No outcomes recorded'}</small></article>
      <article className="metric"><span>High risk</span><strong className="risk-number">{Number(risks.high || 0).toLocaleString()}</strong><small>Prioritize for outreach</small></article>
    </section>
    <Suspense fallback={<div className="chart-loading"><LoaderCircle className="spin" /> Loading analytics</div>}>
      <DashboardCharts total={total} churn={churn} noChurn={noChurn} risks={risks} loading={loading && !stats} onNavigate={onNavigate} />
    </Suspense>
    <section className="panel recent-panel"><div className="panel-heading"><div><span className="eyebrow">Latest activity</span><h2>Recent predictions</h2></div><button className="text-action" onClick={() => onNavigate('history')}>View history <ChevronRight size={15} /></button></div>
      {loading && !history ? <div className="chart-loading"><LoaderCircle className="spin" /> Loading recent activity</div> : <PredictionTable predictions={(history || []).slice(0, 5)} onExplain={onExplain} explainingId={explainingId} />}
    </section>
  </>;
}

function SelectField({ field, value, onChange }) {
  return <label className="field"><span>{field.label}<b aria-hidden="true">*</b></span><select required name={field.key} value={value} onChange={onChange}>{field.options.map((option) => {
    const item = typeof option === 'object' ? option : { label: option, value: option };
    return <option key={item.value} value={item.value}>{item.label}</option>;
  })}</select></label>;
}

function NumericField({ field, value, onChange }) {
  return <label className="field"><span>{field.label}<b aria-hidden="true">*</b></span><input required type="number" name={field.key} value={value} min={field.min} max={field.max} step={field.step} inputMode={field.step === 1 ? 'numeric' : 'decimal'} onChange={onChange} /></label>;
}

function PredictionResult({ result, onExplain, explaining, explanationError }) {
  if (!result) return <div className="result-placeholder"><span className="result-mark"><Activity size={21} /></span><span className="eyebrow">Assessment output</span><h2>Prediction appears here</h2><p>Complete the customer profile to estimate churn probability and risk.</p></div>;
  const churned = result.prediction === 'Churn';
  return <div className={`result-card ${churned ? 'result-churn' : 'result-stay'}`}>
    <span className="eyebrow">Assessment output</span><div className="result-outcome"><span>{churned ? <AlertCircle size={19} /> : <Check size={19} />}</span><div><small>Predicted outcome</small><h2>{result.prediction}</h2></div></div>
    <div className="probability-head"><span>Churn probability</span><strong>{formatPercent(result.churn_probability)}</strong></div><div className="probability-track"><span style={{ width: formatPercent(result.churn_probability) }} /></div>
    <div className="result-facts"><div><span>Risk level</span><RiskBadge level={result.risk_level} /></div><div><span>Model</span><strong>{result.model_used}</strong></div></div>
    <ErrorNotice message={explanationError} /><button className="button button-dark explain-cta" onClick={onExplain} disabled={explaining}>{explaining ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{explaining ? 'Building explanation' : 'Why this prediction?'}</button>
    <p className="result-note">An estimate from the selected model, not a certainty about an individual customer.</p>
  </div>;
}

function PredictionView({ onPrediction, onExplain, loading, explaining, result, error, explanationError }) {
  const [form, setForm] = useState(initialForm);
  const [validationError, setValidationError] = useState('');
  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setValidationError('');
  }
  async function handleSubmit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    if (!element.reportValidity()) return;
    const payload = {};
    for (const [key, value] of Object.entries(form)) {
      if (key === 'customerID') { if (value.trim()) payload[key] = value.trim(); }
      else payload[key] = numericKeys.has(key) ? Number(value) : value;
    }
    if (Object.values(payload).some((value) => typeof value === 'number' && !Number.isFinite(value))) {
      setValidationError('Enter a valid number for each numeric field.');
      return;
    }
    await onPrediction(payload);
  }
  return <div className="prediction-layout"><div className="form-column">
    <div className="section-intro"><p className="lede">Assess an individual account using the same fields as the trained Telco churn models.</p><span className="required-note"><b>*</b> Required fields</span></div>
    <ErrorNotice message={error || validationError} />
    <form onSubmit={handleSubmit} noValidate>
      <div className="customer-id-field"><label className="field"><span>Customer ID <small>Optional</small></span><input name="customerID" value={form.customerID} onChange={handleChange} maxLength={100} placeholder="e.g. 7590-VHVEG" /></label><p>Use an existing ID to update the customer record and keep its prediction history together.</p></div>
      {featureGroups.map((group) => <fieldset className="field-group" key={group.title}><legend>{group.title}</legend><div className="field-grid">{group.fields.map((field) => field.type === 'number'
        ? <NumericField key={field.key} field={field} value={form[field.key]} onChange={handleChange} />
        : <SelectField key={field.key} field={field} value={form[field.key]} onChange={handleChange} />)}</div></fieldset>)}
      <div className="form-footer"><p><ShieldCheck size={15} /> Customer data is sent to the local Express service.</p><button className="button button-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle size={16} className="spin" /> : <Activity size={16} />}{loading ? 'Running prediction' : 'Run prediction'}<ArrowRight size={16} /></button></div>
    </form>
  </div><aside className="result-column" aria-live="polite"><PredictionResult result={result} onExplain={onExplain} explaining={explaining} explanationError={explanationError} /></aside></div>;
}

function Explainability({ explanation, loading, error, onNavigate }) {
  if (loading) return <div className="panel loading-panel"><LoaderCircle size={20} className="spin" /><span>Calculating local feature contributions…</span></div>;
  if (error) return <ErrorNotice message={error} />;
  if (!explanation) return <div className="panel"><EmptyState icon={Sparkles} title="No explanation to show" detail="Run a customer prediction, then ask why the model reached that result." action={<button className="button button-primary" onClick={() => onNavigate('predict')}><Activity size={15} /> New prediction</button>} /></div>;
  const contributions = explanation.top_contributing_features?.length ? explanation.top_contributing_features : explanation.shap_values || [];
  const maxValue = Math.max(...contributions.map((item) => Math.abs(Number(item.contribution || 0))), 0.000001);
  return <>
    <div className="explain-summary"><div><span className="eyebrow">Local explanation</span><h2>What moved this result</h2><p>Feature contributions describe how this model arrived at its output. They show association within the model, not cause.</p></div><div className="explain-summary-result"><span className={`outcome outcome-${explanation.prediction === 'Churn' ? 'churn' : 'stay'}`}>{explanation.prediction}</span><strong>{formatPercent(explanation.churn_probability)}</strong><small>churn probability · {explanation.model_used}</small></div></div>
    <section className="panel contributions-panel"><div className="panel-heading"><div><span className="eyebrow">SHAP contributions</span><h2>Top contributing features</h2></div><span className="panel-meta">Absolute magnitude · signed direction</span></div>
      {contributions.length ? <ol className="contribution-list">{contributions.map((item, index) => {
        const value = Number(item.contribution || 0);
        const towardChurn = item.direction ? item.direction === 'increase' : value >= 0;
        return <li key={`${item.feature}-${index}`}><span className="contribution-rank">{String(index + 1).padStart(2, '0')}</span><div className="contribution-main"><div className="contribution-title"><strong>{humanizeFeature(item.feature)}</strong><span className={`direction ${towardChurn ? 'direction-up' : 'direction-down'}`}>{towardChurn ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{towardChurn ? 'Toward churn' : 'Toward no churn'}</span></div><div className="contribution-track"><span className={towardChurn ? 'bar-churn' : 'bar-stay'} style={{ width: `${Math.max((Math.abs(value) / maxValue) * 100, 3)}%` }} /></div></div><span className="contribution-value mono">{Math.abs(value).toFixed(4)}</span><p className="contribution-context">{towardChurn ? 'Increased the model output for churn.' : 'Reduced the model output for churn.'}</p></li>;
      })}</ol> : <EmptyState title="No feature contributions returned" detail="The explanation service returned no ranked features for this result." />}
      <p className="causality-note"><Info size={16} /> These values explain the model's output for this account. A contribution is not evidence that changing a feature will change customer behavior.</p>
    </section>
  </>;
}

function HistoryView({ history, loading, error, onRefresh, onExplain, explainingId }) {
  return <section className="panel full-panel"><div className="panel-heading"><div><span className="eyebrow">Saved records</span><h2>All predictions</h2></div><button className="button button-secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button></div><ErrorNotice message={error} onRetry={onRefresh} />{loading && !history ? <div className="chart-loading"><LoaderCircle className="spin" /> Loading prediction history</div> : <PredictionTable predictions={history || []} onExplain={onExplain} explainingId={explainingId} />}</section>;
}

function CustomersView({ customers, history, loading, error, onRefresh, onNavigate }) {
  const latest = latestPredictionByCustomer(history || []);
  return <section className="panel full-panel"><div className="panel-heading"><div><span className="eyebrow">Customer directory</span><h2>{(customers || []).length} customers</h2></div><button className="button button-secondary" onClick={onRefresh} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button></div><ErrorNotice message={error} onRetry={onRefresh} />{loading && !customers ? <div className="chart-loading"><LoaderCircle className="spin" /> Loading customers</div> : !customers?.length ? <EmptyState icon={Users} title="No customers in the portfolio" detail="Customers are added when a prediction is saved." action={<button className="button button-primary" onClick={() => onNavigate('predict')}><Activity size={15} /> Assess a customer</button>} /> : <div className="table-scroll"><table className="data-table customer-table"><thead><tr><th>Customer ID</th><th>Tenure</th><th>Monthly charge</th><th>Predictions</th><th>Latest outcome</th><th>Probability</th><th>Risk</th></tr></thead><tbody>{customers.map((customer) => {
    const result = latest.get(customer.externalCustomerId || customer.id);
    return <tr key={customer.id}><td className="customer-cell">{customer.externalCustomerId || <span className="muted">ID not provided</span>}</td><td className="mono">{customer.tenure} mo</td><td className="mono">${Number(customer.monthlyCharges || 0).toFixed(2)}</td><td className="mono">{customer._count?.predictions ?? 0}</td><td>{result ? <span className={`outcome outcome-${result.prediction === 'Churn' ? 'churn' : 'stay'}`}>{result.prediction}</span> : <span className="muted">No result</span>}</td><td className="mono">{result ? formatPercent(result.churnProbability) : '—'}</td><td>{result ? <RiskBadge level={result.riskLevel} /> : '—'}</td></tr>;
  })}</tbody></table></div>}</section>;
}

function AboutView() {
  const models = ['AdaBoost', 'Decision Tree', 'Gradient Boosting', 'K-Nearest Neighbors', 'Logistic Regression', 'Multilayer Perceptron', 'Naive Bayes', 'Random Forest', 'Support Vector Machine', 'XGBoost'];
  return <><div className="about-lead"><span className="eyebrow">Purpose-built for retention analysis</span><h2>Make churn risk easier to inspect.</h2><p>ChurnWise combines a trained customer churn model with local explanations and a record of each assessment, giving operators one place to review risk and decide what to investigate next.</p></div>
    <div className="about-columns">
      <section className="about-section"><span className="about-index">01 / DATA</span><h3>Telco Customer Churn</h3><p>The system uses IBM's Telco Customer Churn dataset, with account tenure, household profile, subscribed services, contract, payment method, and charges. Predictions reflect patterns learned from those records and should be treated as decision support.</p><div className="about-fact"><Database size={17} /><span>19 customer features <i>·</i> binary churn outcome</span></div></section>
      <section className="about-section"><span className="about-index">02 / MODELS</span><h3>Ten trained algorithms</h3><p>Model training compares different classification approaches. The configured default serves predictions; its name is returned with each stored result. The SHAP endpoint currently supports Gradient Boosting, Logistic Regression, and XGBoost.</p><div className="model-list">{models.map((model) => <span key={model}>{model}</span>)}</div></section>
      <section className="about-section"><span className="about-index">03 / EXPLANATION</span><h3>Local SHAP contributions</h3><p>For supported models, ChurnWise ranks the features that contributed most to an individual model output. These values help describe the model's reasoning; they do not establish that a feature caused churn.</p><div className="about-fact"><Sparkles size={17} /><span>Individual, ranked feature contributions</span></div></section>
      <section className="about-section"><span className="about-index">04 / ARCHITECTURE</span><h3>A local service stack</h3><p>The browser communicates with the Express API. Express validates and persists predictions through Prisma and SQLite, then coordinates with the FastAPI model service. The React client never calls FastAPI directly.</p><div className="stack-line"><span>React</span><ArrowRight size={15} /><span>Express</span><ArrowRight size={15} /><span>FastAPI</span></div><div className="about-fact"><Building2 size={17} /><span>Prisma-managed SQLite persistence</span></div></section>
    </div></>;
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [history, setHistory] = useState(null);
  const [health, setHealth] = useState(null);
  const [errors, setErrors] = useState({});
  const [refreshing, setRefreshing] = useState(true);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explainingId, setExplainingId] = useState(null);
  const [predictionResult, setPredictionResult] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [explanationError, setExplanationError] = useState('');
  const [lastPayload, setLastPayload] = useState(null);

  function navigateTo(nextView) {
    setView(nextView);
    if (view !== nextView && window.scrollY !== 0) window.scrollTo(0, 0);
  }

  async function refreshData() {
    setRefreshing(true);
    const entries = await Promise.allSettled([api.health(), api.stats(), api.predictions(), api.customers()]);
    const setters = [setHealth, setStats, (value) => setHistory(value.predictions || []), (value) => setCustomers(value.customers || [])];
    const keys = ['health', 'stats', 'history', 'customers'];
    const nextErrors = {};
    entries.forEach((entry, index) => {
      if (entry.status === 'fulfilled') setters[index](entry.value);
      else nextErrors[keys[index]] = entry.reason?.message || 'Could not load data.';
    });
    setErrors(nextErrors);
    setRefreshing(false);
  }
  useEffect(() => { refreshData(); }, []);

  async function runPrediction(payload) {
    setPredictionLoading(true);
    setErrors((current) => ({ ...current, prediction: '' }));
    setPredictionResult(null);
    setExplanation(null);
    setExplanationError('');
    setLastPayload(payload);
    try {
      const result = await api.predict(payload);
      setPredictionResult(result);
      await refreshData();
      return result;
    } catch (error) {
      setErrors((current) => ({ ...current, prediction: error.message }));
      return null;
    } finally { setPredictionLoading(false); }
  }

  async function explainPayload(payload, recordId = null) {
    setExplaining(true);
    setExplainingId(recordId);
    setExplanationLoading(true);
    setExplanationError('');
    setExplanation(null);
    try {
      const result = await api.explain(payload);
      setExplanation(result);
      navigateTo('explain');
    } catch (error) {
      setExplanationError(error.message);
      if (recordId) setErrors((current) => ({ ...current, history: error.message }));
    } finally {
      setExplaining(false);
      setExplainingId(null);
      setExplanationLoading(false);
    }
  }
  function explainLatest() { if (lastPayload) explainPayload(lastPayload); }
  async function explainRecord(record) { await explainPayload(payloadFromCustomer(record.customer), record.id); }

  const [eyebrow, title] = headings[view];
  const routeError = view === 'dashboard' ? errors.stats || errors.customers || errors.history : view === 'history' ? errors.history : view === 'customers' ? errors.customers : '';
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); navigateTo('dashboard'); }}><span className="brand-mark"><Activity size={20} strokeWidth={2.4} /></span><span><strong>ChurnWise</strong><small>RETENTION CONSOLE</small></span></a>
      <div className="sidebar-label">WORKSPACE</div><nav className="side-nav" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigateTo(id)} aria-current={view === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{view === id && <i />}</button>)}</nav>
      <div className="sidebar-bottom"><div className={`service-status ${health?.status === 'ok' ? 'connected' : health ? 'disconnected' : ''}`}><span className="status-dot" /><span><strong>{health?.status === 'ok' ? 'API connected' : health ? 'API unavailable' : 'Checking API'}</strong><small>{health?.database === 'connected' ? 'Database online' : 'Local services'}</small></span><Wifi size={15} /></div><p>CHURNWISE <span>·</span> PHASE 07</p></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="mobile-brand"><span className="brand-mark"><Activity size={18} /></span><strong>ChurnWise</strong></div><div className="breadcrumb"><span>ChurnWise</span><ChevronRight size={13} /><span>{title}</span></div><div className="topbar-right"><span className="live-indicator"><i /> Local workspace</span><button className="icon-button mobile-refresh" aria-label="Refresh data" title="Refresh data" onClick={refreshData} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : ''} /></button><button className="user-chip" title="Customer retention workspace"><span>CW</span></button></div></header>
      <nav className="mobile-nav" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={`mobile-nav-item ${view === id ? 'active' : ''}`} onClick={() => navigateTo(id)} aria-current={view === id ? 'page' : undefined}><Icon size={17} /><span>{label}</span></button>)}</nav>
      <div className="content-wrap"><div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div><div className="heading-meta"><Clock3 size={14} /> Updated {history?.[0]?.predictedAt ? formatDate(history[0].predictedAt) : 'when data is available'}</div></div>
        {routeError && view !== 'dashboard' && <ErrorNotice message={routeError} onRetry={refreshData} />}
        {view === 'dashboard' && <Dashboard stats={stats} customers={customers} history={history} errors={errors} loading={refreshing} onRefresh={refreshData} onNavigate={navigateTo} onExplain={explainRecord} explainingId={explainingId} />}
        {view === 'predict' && <PredictionView onPrediction={runPrediction} onExplain={explainLatest} loading={predictionLoading} explaining={explaining} result={predictionResult} error={errors.prediction} explanationError={explanationError} />}
        {view === 'explain' && <Explainability explanation={explanation} loading={explanationLoading} error={explanationError} onNavigate={navigateTo} />}
        {view === 'history' && <HistoryView history={history} loading={refreshing} error={errors.history} onRefresh={refreshData} onExplain={explainRecord} explainingId={explainingId} />}
        {view === 'customers' && <CustomersView customers={customers} history={history} loading={refreshing} error={errors.customers} onRefresh={refreshData} onNavigate={navigateTo} />}
        {view === 'about' && <AboutView />}
        <footer className="page-footer"><span>CHURNWISE OPERATIONS</span><span><BookOpen size={13} /> Model outputs are estimates; use professional judgment.</span></footer>
      </div>
    </main>
  </div>;
}