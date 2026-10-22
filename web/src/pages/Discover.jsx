import { useEffect, useState } from 'react';
import { api, useApi, useApp, useT, useFormat, navigate, useLocation, Link, BASE, CATEGORY_LABEL, CATEGORY_PLURAL } from '../lib.jsx';
import { VendorCard, Loading, ErrorNote, Empty } from '../components.jsx';

const CATEGORY_ART = {
  photographer: 'M4 8h4l2-3h4l2 3h4v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  videographer: 'M3 7h12v10H3z M15 10l6-3v10l-6-3z',
  makeup: 'M9 3h6v5H9z M8 8h8l-1 13H9z',
  hair: 'M6 3v18 M10 3v18 M14 3v18 M18 3v18 M4 9h16'
};

function CategoryIcon({ c }) {
  return <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d={CATEGORY_ART[c]} /></svg>;
}

export function Home() {
  const { market, meta } = useApp();
  const t = useT();
  const fmt = useFormat();
  const { data, error } = useApi(`/home?country=${market}`, [market]);
  const [q, setQ] = useState({ category: '', city: '', date: '' });
  const cities = Object.keys(meta?.cities?.[market] || {});
  const go = (e) => {
    e.preventDefault();
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    navigate('/search?' + p);
  };
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <h1>{t('Book the people who make your moments look unforgettable.')}</h1>
          <p className="lead">{t('Compare verified photographers, videographers, makeup artists and hair dressers — real portfolios, clear prices, live availability.')}</p>
          <form className="hero-search" onSubmit={go}>
            <label>
              <span>{t('Service')}</span>
              <select value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })}>
                <option value="">{t('All services')}</option>
                {Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}
              </select>
            </label>
            <label>
              <span>{t('City')}</span>
              <select value={q.city} onChange={(e) => setQ({ ...q, city: e.target.value })}>
                <option value="">{t('Anywhere')}</option>
                {cities.map((c) => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            </label>
            <label>
              <span>{t('Date')}</span>
              <input type="date" min={meta?.today} value={q.date} onChange={(e) => setQ({ ...q, date: e.target.value })} />
            </label>
            <button className="btn btn-accent">{t('Search')}</button>
          </form>
        </div>
      </section>

      <section className="container section">
        <div className="cat-grid">
          {Object.keys(CATEGORY_LABEL).map((c) => (
            <Link key={c} to={`/search?category=${c}`} className="cat-tile">
              <CategoryIcon c={c} />
              <strong>{t(CATEGORY_PLURAL[c])}</strong>
              <span className="muted small">{t('{n} vendors', { n: fmt.number(data?.categoryCounts?.[c] ?? 0) })}</span>
            </Link>
          ))}
        </div>
      </section>

      <ErrorNote error={error} />
      {data?.featured?.length > 0 && (
        <section className="container section">
          <div className="section-head"><h2>{t('Featured vendors')}</h2></div>
          <div className="card-grid">{data.featured.map((v) => <VendorCard key={v.id} v={v} />)}</div>
        </section>
      )}
      <section className="container section">
        <div className="section-head">
          <h2>{t('Top rated')}</h2>
          <Link to="/search?sort=rating">{t('See all')} →</Link>
        </div>
        {!data ? <Loading /> : <div className="card-grid">{data.topRated.map((v) => <VendorCard key={v.id} v={v} />)}</div>}
      </section>

      <section className="container section how">
        <h2>{t('How it works')}</h2>
        <ol className="steps">
          <li><strong>{t('Compare')}</strong><span>{t('Browse portfolios, packages and verified reviews from real bookings.')}</span></li>
          <li><strong>{t('Book & pay a deposit')}</strong><span>{t('Pick a date and time that is actually free. A deposit holds it; the balance is due before the event.')}</span></li>
          <li><strong>{t('Enjoy your day')}</strong><span>{t('Chat with your vendor, get reminders, and leave a review afterwards.')}</span></li>
        </ol>
      </section>
    </>
  );
}

export function Search() {
  const { market, meta } = useApp();
  const t = useT();
  const { query } = useLocation();
  const [filters, setFilters] = useState({ sort: 'recommended', radiusKm: '50', ...query });
  const [state, setState] = useState({ loading: true });
  const [showFilters, setShowFilters] = useState(false);
  const currency = meta?.currency?.[market];
  const cities = Object.keys(meta?.cities?.[market] || {});

  useEffect(() => { setFilters((f) => ({ ...f, city: cities.includes(f.city) ? f.city : '' })); }, [market]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = new URLSearchParams(Object.entries({ ...filters, country: market }).filter(([, v]) => v));
    if (filters.sort === 'distance' && !filters.city) p.set('sort', 'recommended');
    setState((s) => ({ ...s, loading: true }));
    const id = setTimeout(() => {
      api('/search?' + p).then((d) => setState({ loading: false, ...d }), (error) => setState({ loading: false, error }));
      const visible = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && !(k === 'sort' && v === 'recommended') && !(k === 'radiusKm' && v === '50')));
      history.replaceState(null, '', BASE + '/search' + (visible.size ? '?' + visible : ''));
    }, 200);
    return () => clearTimeout(id);
  }, [filters, market]);

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const tags = filters.tags ? filters.tags.split(',') : [];
  const toggleTag = (tag) => setFilters({ ...filters, tags: (tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag]).join(',') });

  return (
    <div className="container search-layout">
      <aside className={'filters' + (showFilters ? ' open' : '')}>
        <h2 className="h-small">{t('Filters')}</h2>
        <label className="field">{t('Keyword')}<input value={filters.q || ''} onChange={set('q')} placeholder={t('Name, style…')} /></label>
        <label className="field">{t('Service')}
          <select value={filters.category || ''} onChange={set('category')}>
            <option value="">{t('All services')}</option>
            {Object.keys(CATEGORY_LABEL).map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}
          </select>
        </label>
        <label className="field">{t('City')}
          <select value={filters.city || ''} onChange={set('city')}>
            <option value="">{t('Anywhere')}</option>
            {cities.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </label>
        {filters.city && (
          <label className="field">{t('Within {km} km', { km: filters.radiusKm })}
            <input type="range" min="5" max="300" step="5" value={filters.radiusKm} onChange={set('radiusKm')} />
          </label>
        )}
        <label className="field">{t('Available on')}<input type="date" min={meta?.today} value={filters.date || ''} onChange={set('date')} /></label>
        <div className="row-2">
          <label className="field">{t('Min price')} ({currency})<input type="number" min="0" value={filters.minPrice || ''} onChange={set('minPrice')} /></label>
          <label className="field">{t('Max price')} ({currency})<input type="number" min="0" value={filters.maxPrice || ''} onChange={set('maxPrice')} /></label>
        </div>
        {meta?.styleTags?.length > 0 && (
          <div className="field">
            <span>{t('Style')}</span>
            <div className="tags">
              {meta.styleTags.map((tag) => (
                <button type="button" key={tag} className={'tag tag-btn' + (tags.includes(tag) ? ' on' : '')} onClick={() => toggleTag(tag)} aria-pressed={tags.includes(tag)}>{tag}</button>
              ))}
            </div>
          </div>
        )}
        <button className="btn-link" onClick={() => setFilters({ sort: 'recommended', radiusKm: '50' })}>{t('Clear filters')}</button>
      </aside>
      <section className="results">
        <div className="results-head">
          <p>
            {state.loading ? t('Searching…') : t('{n} vendors', { n: state.results?.length ?? 0 })}
          </p>
          <div className="results-tools">
            <button className="btn btn-ghost btn-small filters-toggle" onClick={() => setShowFilters(!showFilters)}>{t('Filters')}</button>
            <label className="sort">{t('Sort')}
              <select value={filters.sort} onChange={set('sort')}>
                <option value="recommended">{t('Recommended')}</option>
                <option value="rating">{t('Highest rated')}</option>
                <option value="price_asc">{t('Price: low to high')}</option>
                <option value="price_desc">{t('Price: high to low')}</option>
                <option value="distance" disabled={!filters.city}>{t('Distance')}</option>
              </select>
            </label>
          </div>
        </div>
        <ErrorNote error={state.error} />
        {!state.loading && state.results?.length === 0 && <Empty>{t('No vendors match these filters yet. Try another date or widen the area.')}</Empty>}
        <div className="card-grid">{state.results?.map((v) => <VendorCard key={v.id} v={v} />)}</div>
      </section>
    </div>
  );
}
