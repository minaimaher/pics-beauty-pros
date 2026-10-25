import { useEffect, useMemo, useState } from 'react';
import { api, useApi, useApp, useT, useFormat, navigate, useLocation, Link, BASE, CATEGORY_LABEL, CATEGORY_PLURAL } from '../lib.jsx';
import { VendorCard, Loading, ErrorNote, Empty } from '../components.jsx';
import { SITE_PHOTOS, CITY_PHOTOS, pexels } from '../../../server/photos.js';
import { MapView } from '../MapView.jsx';


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
        <img className="hero-photo" src={pexels(SITE_PHOTOS.hero, 1920)} alt="" />
        <div className="container hero-inner">
          <p className="eyebrow hero-eyebrow">{t('Photography · Film · Makeup · Hair')}</p>
          <h1>{t('Book the pros behind your moments.')}</h1>
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
              <img src={pexels(SITE_PHOTOS[c], 700)} alt="" loading="lazy" />
              <span className="cat-label">
                <strong>{t(CATEGORY_PLURAL[c])}</strong>
                <span className="small">{t('{n} vendors', { n: fmt.number(data?.categoryCounts?.[c] ?? 0) })}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <ErrorNote error={error} />
      {data?.cityCounts?.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>{t('Explore by city')}</h2>
            <Link to="/search?view=map">⌖ {t('Open the map')}</Link>
          </div>
          <div className="city-grid">
            {data.cityCounts.map(({ city, n }) => (
              <Link key={city} to={`/search?city=${encodeURIComponent(city)}&view=map`} className="city-tile">
                <img src={pexels(CITY_PHOTOS[city] || SITE_PHOTOS.photographer, 700)} alt="" loading="lazy" />
                <span className="cat-label"><strong>{t(city)}</strong><span className="small">{t('{n} vendors', { n: fmt.number(n) })}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}
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

// Builds a vendor's map popup with DOM APIs (no HTML strings from user content).
function vendorPopup(v, t, fmt) {
  return (div) => {
    const el = (tag, cls, text) => Object.assign(document.createElement(tag), { className: cls || '', textContent: text || '' });
    if (v.cover) {
      const img = el('img', 'pp-cover');
      img.src = v.cover;
      img.alt = '';
      div.append(img);
    }
    div.append(el('strong', 'pp-name', v.business_name));
    div.append(el('span', 'pp-meta', `★ ${v.rating_avg ? v.rating_avg.toFixed(1) : '—'} · ${[v.district && t(v.district), t(v.city)].filter(Boolean).join(', ')}`));
    if (v.from_price != null) div.append(el('span', 'pp-price', `${t('From')} ${fmt.money(v.from_price, v.currency)}`));
    const btn = el('button', 'btn btn-small', t('View profile'));
    btn.onclick = () => navigate(`/vendors/${v.id}`);
    div.append(btn);
  };
}

const initialsOf = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function Search() {
  const { market, meta } = useApp();
  const t = useT();
  const fmt = useFormat();
  const { query } = useLocation();
  const [filters, setFilters] = useState({ sort: 'recommended', radiusKm: '50', view: 'list', ...query });
  const [state, setState] = useState({ loading: true });
  const [showFilters, setShowFilters] = useState(false);
  const currency = meta?.currency?.[market];
  const cities = Object.keys(meta?.cities?.[market] || {});

  const districts = Object.keys(meta?.districts?.[market]?.[filters.city] || {});

  useEffect(() => { setFilters((f) => (cities.length && !cities.includes(f.city) && f.city ? { ...f, city: '', district: '' } : f)); }, [market, cities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const { view, ...apiFilters } = filters;
    const p = new URLSearchParams(Object.entries({ ...apiFilters, country: market }).filter(([, v]) => v));
    if (filters.sort === 'distance' && !filters.city) p.set('sort', 'recommended');
    setState((s) => ({ ...s, loading: true }));
    const id = setTimeout(() => {
      api('/search?' + p).then((d) => setState({ loading: false, ...d }), (error) => setState({ loading: false, error }));
      const visible = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && !(k === 'sort' && v === 'recommended') && !(k === 'radiusKm' && v === '50') && !(k === 'view' && v === 'list')));
      history.replaceState(null, '', BASE + '/search' + (visible.size ? '?' + visible : ''));
    }, 200);
    return () => clearTimeout(id);
  }, [filters, market]);

  // Memoised so the map only re-fits when the results or the area actually change.
  const mapMarkers = useMemo(() => (state.results || []).map((v) => ({
    id: v.id, lat: v.lat, lng: v.lng, avatar: v.avatar_url, initials: initialsOf(v.business_name),
    label: v.from_price != null ? fmt.money(v.from_price, v.currency) : '', popup: vendorPopup(v, t, fmt)
  })), [state.results, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const mapCenter = useMemo(
    () => (filters.district && meta?.districts?.[market]?.[filters.city]?.[filters.district]) || meta?.cities?.[market]?.[filters.city] || (market === 'SA' ? [23.9, 45.0] : [30.2, 31.0]),
    [filters.city, filters.district, market, meta]
  );

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
          <select value={filters.city || ''} onChange={(e) => setFilters({ ...filters, city: e.target.value, district: '' })}>
            <option value="">{t('Anywhere')}</option>
            {cities.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </label>
        {districts.length > 0 && (
          <label className="field">{t('District')}
            <select value={filters.district || ''} onChange={set('district')}>
              <option value="">{t('All districts')}</option>
              {districts.map((d2) => <option key={d2} value={d2}>{t(d2)}</option>)}
            </select>
          </label>
        )}
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
        <button className="btn-link" onClick={() => setFilters({ sort: 'recommended', radiusKm: '50', view: filters.view })}>{t('Clear filters')}</button>
      </aside>
      <section className="results">
        <div className="results-head">
          <p>
            {state.loading ? t('Searching…') : t('{n} vendors', { n: state.results?.length ?? 0 })}
          </p>
          <div className="results-tools">
            <div className="seg view-toggle" role="group" aria-label={t('View')}>
              <button className={filters.view !== 'map' ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'list' })} aria-pressed={filters.view !== 'map'}>☰ {t('List')}</button>
              <button className={filters.view === 'map' ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'map' })} aria-pressed={filters.view === 'map'}>⌖ {t('Map')}</button>
            </div>
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
        {filters.view === 'map' && (
          <MapView
            className="search-map"
            height={520}
            center={mapCenter}
            zoom={filters.city ? 11 : 5}
            markers={mapMarkers}
          />
        )}
        <div className="card-grid">{state.results?.map((v) => <VendorCard key={v.id} v={v} />)}</div>
      </section>
    </div>
  );
}
