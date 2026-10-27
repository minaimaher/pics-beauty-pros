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
  // Contact sheet: one recent photo from each of several top vendors, linking to them.
  const sheet = [];
  for (const v of [...(data?.featured || []), ...(data?.topRated || [])]) {
    if (v.cover && !sheet.some((x) => x.id === v.id)) sheet.push(v);
  }
  const vendorTotal = (data?.cityCounts || []).reduce((n, c) => n + c.n, 0);
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <h1>{t('Book the pros behind your moments.')}</h1>
            <p className="lead">{t('See real work from photographers, filmmakers, makeup artists and hair stylists, check their dates and book in minutes.')}</p>
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
              <button className="btn">{t('Search')}</button>
            </form>
            {vendorTotal > 0 && (
              <p className="hero-proof">
                <span><strong>{fmt.number(vendorTotal)}</strong> {t('verified vendors')}</span>
                <span>{t('Prices and dates shown upfront')}</span>
                <span>{t('A deposit holds your date')}</span>
              </p>
            )}
          </div>
          <div className="contact-sheet" aria-label={t('Recent work from vendors')}>
            {sheet.slice(0, 6).map((v, i) => (
              <Link key={v.id} to={`/vendors/${v.id}`} className="print" style={{ '--i': i }}>
                <img src={v.cover} alt={t('Work by {name}', { name: v.business_name })} onLoad={(e) => e.currentTarget.classList.add('developed')} />
                <figcaption>{v.business_name}, {t(v.district || v.city)}</figcaption>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head"><h2>{t('What are you booking?')}</h2></div>
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
      {data?.featured?.length > 0 && (
        <section className="container section">
          <div className="section-head"><h2>{t('Featured vendors')}</h2></div>
          <div className="card-grid">{data.featured.map((v) => <VendorCard key={v.id} v={v} />)}</div>
        </section>
      )}
      {data?.cityCounts?.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>{t('Explore by city')}</h2>
            <Link to="/search?view=map">{t('Open the map')}</Link>
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
      <section className="container section">
        <div className="section-head">
          <h2>{t('Top rated')}</h2>
          <Link to="/search?sort=rating">{t('See all')}</Link>
        </div>
        {!data ? <Loading /> : <div className="card-grid">{data.topRated.map((v) => <VendorCard key={v.id} v={v} />)}</div>}
      </section>

      <section className="container section how">
        <h2>{t('How booking works')}</h2>
        <ol className="steps">
          <li><strong>{t('Compare')}</strong><span>{t('Browse portfolios, packages and verified reviews from real bookings.')}</span></li>
          <li><strong>{t('Book & pay a deposit')}</strong><span>{t('Pick a date and time that is actually free. A deposit holds it; the balance is due before the event.')}</span></li>
          <li><strong>{t('Enjoy your day')}</strong><span>{t('Chat with your vendor, get reminders, and leave a review afterwards.')}</span></li>
        </ol>
      </section>

      <section className="container section">
        <div className="vendor-band">
          <div>
            <h2>{t('Photographer, filmmaker or beauty artist?')}</h2>
            <p>{t('Get a storefront for your work, a calendar that prevents double bookings, and deposits collected for you. No commission on bookings.')}</p>
          </div>
          <Link to="/join-vendor" className="btn">{t('List your business')}</Link>
        </div>
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
    div.append(el('span', 'pp-meta', `★ ${v.rating_avg ? v.rating_avg.toFixed(1) : '—'}, ${[v.district && t(v.district), t(v.city)].filter(Boolean).join(', ')}`));
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

  const isMap = filters.view === 'map';
  const extraFilters = ['q', 'minPrice', 'maxPrice', 'tags'].filter((k) => filters[k]).length + (filters.city && filters.radiusKm !== '50' ? 1 : 0);
  const results = state.results || [];
  const grid = <div className="card-grid">{results.map((v) => <VendorCard key={v.id} v={v} />)}</div>;

  return (
    <div className="container search-page">
      <div className="search-bar">
        <div className="chip-row" role="group" aria-label={t('Service')}>
          {['', ...Object.keys(CATEGORY_LABEL)].map((c) => (
            <button key={c || 'all'} type="button" className={'cat-chip' + ((filters.category || '') === c ? ' on' : '')} aria-pressed={(filters.category || '') === c}
              onClick={() => setFilters({ ...filters, category: c })}>
              {c ? t(CATEGORY_PLURAL[c]) : t('All services')}
            </button>
          ))}
        </div>
        <div className="search-controls">
          <label className="control"><span>{t('City')}</span>
            <select value={filters.city || ''} onChange={(e) => setFilters({ ...filters, city: e.target.value, district: '' })}>
              <option value="">{t('Anywhere')}</option>
              {cities.map((c) => <option key={c} value={c}>{t(c)}</option>)}
            </select>
          </label>
          {districts.length > 0 && (
            <label className="control"><span>{t('District')}</span>
              <select value={filters.district || ''} onChange={set('district')}>
                <option value="">{t('All districts')}</option>
                {districts.map((d2) => <option key={d2} value={d2}>{t(d2)}</option>)}
              </select>
            </label>
          )}
          <label className="control"><span>{t('Date')}</span>
            <input type="date" min={meta?.today} value={filters.date || ''} onChange={set('date')} />
          </label>
          <button type="button" className={'btn btn-ghost btn-small filter-btn' + (showFilters ? ' on' : '')} aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>
            {t('More filters')}{extraFilters > 0 && <span className="dot inline">{extraFilters}</span>}
          </button>
          <span className="spacer" />
          <label className="control"><span>{t('Sort')}</span>
            <select value={filters.sort} onChange={set('sort')}>
              <option value="recommended">{t('Recommended')}</option>
              <option value="rating">{t('Highest rated')}</option>
              <option value="price_asc">{t('Price: low to high')}</option>
              <option value="price_desc">{t('Price: high to low')}</option>
              <option value="distance" disabled={!filters.city}>{t('Distance')}</option>
            </select>
          </label>
          <div className="seg view-toggle" role="group" aria-label={t('View')}>
            <button className={!isMap ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'list' })} aria-pressed={!isMap}>{t('List')}</button>
            <button className={isMap ? 'on' : ''} onClick={() => setFilters({ ...filters, view: 'map' })} aria-pressed={isMap}>{t('Map')}</button>
          </div>
        </div>
        {showFilters && (
          <div className="filter-panel">
            <label className="field">{t('Keyword')}<input value={filters.q || ''} onChange={set('q')} placeholder={t('Name, style…')} /></label>
            <div className="row-2">
              <label className="field">{t('Min price')} ({currency})<input type="number" min="0" value={filters.minPrice || ''} onChange={set('minPrice')} /></label>
              <label className="field">{t('Max price')} ({currency})<input type="number" min="0" value={filters.maxPrice || ''} onChange={set('maxPrice')} /></label>
            </div>
            {filters.city ? (
              <label className="field">{t('Within {km} km', { km: filters.radiusKm })}
                <input type="range" min="5" max="300" step="5" value={filters.radiusKm} onChange={set('radiusKm')} />
              </label>
            ) : <p className="small muted">{t('Choose a city to search by distance.')}</p>}
            {meta?.styleTags?.length > 0 && (
              <div className="field tags-field">
                <span>{t('Style')}</span>
                <div className="tags">
                  {meta.styleTags.map((tag) => (
                    <button type="button" key={tag} className={'tag tag-btn' + (tags.includes(tag) ? ' on' : '')} onClick={() => toggleTag(tag)} aria-pressed={tags.includes(tag)}>{tag}</button>
                  ))}
                </div>
              </div>
            )}
            <div><button className="btn-link" onClick={() => setFilters({ sort: 'recommended', radiusKm: '50', view: filters.view })}>{t('Clear filters')}</button></div>
          </div>
        )}
      </div>

      <p className="result-count" aria-live="polite">
        {state.loading ? t('Searching…') : <><strong>{t('{n} vendors', { n: results.length })}</strong>{filters.city && <> {t('in {place}', { place: [filters.district && t(filters.district), t(filters.city)].filter(Boolean).join(', ') })}</>}</>}
      </p>
      <ErrorNote error={state.error} />
      {!state.loading && results.length === 0 && <Empty>{t('No vendors match these filters yet. Try another date or widen the area.')}</Empty>}
      {isMap ? (
        <div className="split">
          {grid}
          <div className="split-map">
            <MapView center={mapCenter} zoom={filters.city ? 11 : 5} markers={mapMarkers} />
          </div>
        </div>
      ) : grid}
    </div>
  );
}
