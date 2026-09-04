// Shared UI primitives.

// ---------------------------------------------------------------------------
// Lucide helper: <Icon name="LayoutDashboard" size={18}/>
function Icon({ name, size = 18, className = '', strokeWidth = 1.75 }) {
  const C = window.Lucide ? window.Lucide[name] : null;
  if (!C) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return <C size={size} className={className} strokeWidth={strokeWidth} />;
}

// ---------------------------------------------------------------------------
// Button — primary / secondary / ghost / danger
function Button({ variant = 'primary', size = 'md', leadingIcon, trailingIcon, loading, children, className = '', ...rest }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'h-8 px-3 text-[13px]',
    md: 'h-10 px-4 text-sm',
    lg: 'h-11 px-5 text-[15px]',
  }[size];
  const variants = {
    primary:   'bg-saf-primary text-white shadow-card hover:brightness-110 hover:-translate-y-px active:translate-y-0',
    secondary: 'bg-white text-saf-text border border-saf-border hover:bg-saf-light hover:-translate-y-px',
    ghost:     'bg-transparent text-saf-text hover:bg-saf-light',
    danger:    'bg-saf-danger text-white hover:brightness-110',
    dark:      'bg-saf-dark text-white hover:brightness-110',
    accent:    'bg-saf-accent text-white hover:brightness-105',
  }[variant];
  return (
    <button {...rest} className={`${base} ${sizes} ${variants} ${className}`} disabled={loading || rest.disabled}>
      {loading ? <Icon name="Loader2" size={16} className="animate-spin" /> : (leadingIcon && <Icon name={leadingIcon} size={16} />)}
      {children}
      {trailingIcon && !loading && <Icon name={trailingIcon} size={16} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Card — uniform card surface
function Card({ className = '', children, padding = 'p-6', ...rest }) {
  return (
    <div
      {...rest}
      className={`bg-white border border-saf-border rounded-2xl shadow-card ${padding} ${className}`}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pill / Badge
function Pill({ tone = 'blue', children, className = '' }) {
  const tones = {
    blue:   'bg-saf-light text-saf-primary',
    green:  'bg-emerald-50 text-emerald-700',
    red:    'bg-rose-50 text-rose-700',
    amber:  'bg-amber-50 text-amber-700',
    gray:   'bg-slate-100 text-slate-600',
    dark:   'bg-saf-dark/10 text-saf-dark',
  }[tone];
  return <span className={`inline-flex items-center gap-1 px-2 h-6 text-[11px] font-medium rounded-full ${tones} ${className}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Toast system
const ToastCtx = React.createContext({ push: () => {} });
function ToastProvider({ children }) {
  const [items, setItems] = React.useState([]);
  const push = React.useCallback((toast) => {
    const id = Math.random().toString(36).slice(2);
    const t = { id, kind: 'success', timeout: 4000, ...toast };
    setItems(prev => [...prev, t]);
    setTimeout(() => setItems(prev => prev.filter(p => p.id !== id)), t.timeout);
  }, []);
  const close = (id) => setItems(prev => prev.filter(p => p.id !== id));
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed top-4 ltr:right-4 rtl:left-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {items.map(t => (
          <div key={t.id} className="pointer-events-auto min-w-[320px] max-w-[400px] bg-white border border-saf-border rounded-xl shadow-pop overflow-hidden animate-slideInRight">
            <div className="flex items-start gap-3 p-3">
              <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${t.kind === 'success' ? 'bg-emerald-50 text-emerald-600' : t.kind === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-saf-light text-saf-primary'}`}>
                <Icon name={t.kind === 'success' ? 'CheckCircle2' : t.kind === 'error' ? 'AlertCircle' : 'Info'} size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-saf-text">{t.title}</div>
                {t.desc ? <div className="text-[12px] text-saf-muted mt-0.5">{t.desc}</div> : null}
              </div>
              <button onClick={() => close(t.id)} className="text-saf-muted hover:text-saf-text"><Icon name="X" size={16} /></button>
            </div>
            <div className="h-[2px] bg-saf-light overflow-hidden">
              <div className="h-full bg-saf-primary" style={{ animation: `toastBar ${t.timeout}ms linear forwards` }} />
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes toastBar { from { width: 100%; } to { width: 0%; } }`}</style>
    </ToastCtx.Provider>
  );
}
function useToast() { return React.useContext(ToastCtx); }

// ---------------------------------------------------------------------------
// Modal (centered) with fade-scale
// Accessible modal:
//   - Esc closes
//   - Focus moves to the first focusable element on open
//   - Tab cycles within the modal (simple two-end trap)
//   - Focus returns to the element that triggered the open on close
// No aria-live announcements or focus-restore-on-disable — those land with
// the full a11y pass later. Backdrop click still closes.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Modal({ open, onClose, title, children, width = 560 }) {
  const containerRef = React.useRef(null);
  const returnFocusRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;

    // Capture-phase so we intercept Tab before any inner widget's own
    // keydown logic — and so we can pull focus back if it has already
    // escaped to the document body (e.g. when the user tabs past the
    // last focusable and the browser would normally walk into the
    // sidebar / topbar behind the backdrop).
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      // FOCUSABLE_SELECTOR already excludes :disabled buttons via :not().
      // No offsetParent filter — it would exclude legitimately-focusable
      // elements in some flex/grid layouts, and there's no display:none
      // content inside our modals worth defending against.
      const focusables = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // Focus is somewhere outside the modal entirely — pull it back in.
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);

    const focusTimer = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const first = el.querySelector(FOCUSABLE_SELECTOR);
      first?.focus?.();
    }, 0);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearTimeout(focusTimer);
      const prev = returnFocusRef.current;
      if (prev && typeof prev.focus === 'function') {
        try { prev.focus(); } catch (e) {}
      }
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] bg-saf-dark/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className="bg-white rounded-2xl shadow-pop border border-saf-border max-h-[90vh] overflow-auto animate-fadeScale nice-scroll"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="flex items-center justify-between px-5 py-3 border-b border-saf-border">
            <h3 className="font-medium text-saf-text">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="text-saf-muted hover:text-saf-text"><Icon name="X" size={18} /></button>
          </div>
        ) : null}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side drawer (right-side, 600px)
function Drawer({ open, onClose, title, children, width = 600 }) {
  return (
    <div className={`fixed inset-0 z-[140] transition-all ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-saf-dark/30 backdrop-blur-[2px] transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <div
        className={`absolute top-0 ltr:right-0 rtl:left-0 bottom-0 bg-saf-surface shadow-drawer transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${open ? 'ltr:translate-x-0 rtl:translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'}`}
        style={{ width }}
      >
        <div className="flex items-center justify-between px-5 h-14 border-b border-saf-border bg-white">
          <h3 className="font-medium text-saf-text">{title}</h3>
          <button onClick={onClose} className="text-saf-muted hover:text-saf-text"><Icon name="X" size={18} /></button>
        </div>
        <div className="overflow-auto h-[calc(100%-3.5rem)] nice-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Count-up hook (numeric animation)
function useCountUp(target, duration = 1200) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let start = null;
    let raf;
    const tick = (ts) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// How absence renders, everywhere. NOT an em dash: an em dash reads as
// "empty" rather than "cannot be obtained", and that ambiguity is exactly what
// let a NaN competitor panel survive a whole commit (CLAUDE.md §11 trap 1).
// This is the same wording the Competitors table already uses for a channel it
// cannot read, so one absence reads the same wherever it appears.
const NOT_READABLE = 'Not readable';

// Compact number formatting: 1_234 -> "1.2k", 1_000_000 -> "1m".
// Sibling of fmt(); use fmtCompact for at-a-glance KPI / metric chips
// where exact precision matters less than scale, fmt() for tables and
// places where you want full thousands separators.
//
// THE GUARD COMES FIRST, AND IT IS THE FLOOR. This function used to end with
// `return String(n)`, so `fmtCompact(null)` rendered the literal word "null"
// on screen and `fmtCompact(undefined)` rendered "undefined". A formatter must
// never be able to emit a JavaScript value's default string form — whatever a
// call site does or forgets to do, what comes out of here is either a number
// or a stated absence.
//
// Returns a STRING, never JSX: several call sites interpolate it into template
// literals (the sync report in mock.jsx, the Google chip in
// page-establishments.jsx) where an element would render as "[object Object]"
// — which is the very failure this guard exists to prevent.
function fmtCompact(n) {
  if (n === null || n === undefined || typeof n === 'boolean') return NOT_READABLE;
  // Numeric strings are coerced, because that is what the old implementation
  // did by accident and a present value must keep rendering exactly as it did.
  const v = typeof n === 'number' ? n : (String(n).trim() === '' ? NaN : Number(n));
  if (!Number.isFinite(v)) return NOT_READABLE;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (abs >= 1_000)     return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
}

// True when fmtCompact would report absence. Call sites that append a unit
// noun ("… reviews", "… avg") ask this FIRST, because dropping the marker into
// the middle of a sentence produces "Not readable reviews" — broken English,
// which reads as a bug rather than as a stated absence. The whole phrase has
// to become the marker, not just the number inside it.
function isAbsent(n) {
  return fmtCompact(n) === NOT_READABLE;
}

function fmt(n, opts = {}) {
  // `isNaN(Infinity)` is FALSE, so the original guard let Infinity through and
  // produced "InfinityM" — the same class of defect as fmtCompact's "null".
  // Number.isFinite() rejects null, undefined, NaN and both infinities in one
  // test. The em dash is kept here rather than switched to NOT_READABLE
  // because this function's callers are tables and inline figures whose
  // existing rendering must not change (§4); fmtCompact is the one whose
  // absence path was actually broken.
  const asNum = typeof n === 'number' ? n : (n === null || n === undefined || String(n).trim() === '' ? NaN : Number(n));
  if (!Number.isFinite(asNum)) return '—';
  n = asNum;
  const abs = Math.abs(n);
  if (opts.compact !== false && abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + 'M';
  if (opts.compact !== false && abs >= 1_000) return (n / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + 'K';
  if (opts.pct) return n.toFixed(1) + '%';
  return Math.round(n).toLocaleString();
}

// ---------------------------------------------------------------------------
// AnimatedNumber
function AnimatedNumber({ value, format = (v) => fmt(v) }) {
  const v = useCountUp(value);
  return <span>{format(v)}</span>;
}

// ---------------------------------------------------------------------------
// Tab strip with sliding underline
function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-5 border-b border-saf-border ${className}`}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`py-2.5 text-sm tab-underline ${value === t.id ? 'active text-saf-primary font-medium' : 'text-saf-muted hover:text-saf-text'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton block
function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

// ---------------------------------------------------------------------------
// A platform chip used inline (small)
function PlatformBadge({ id, withName = true, size = 18 }) {
  const p = PLATFORM_BY_ID[id];
  if (!p) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-grid place-items-center rounded-full" style={{ background: p.color, color: 'white', width: size + 8, height: size + 8 }}>
        <PlatformGlyph id={id} size={size - 2} />
      </span>
      {withName && <span className="text-[12px] text-saf-text">{p.name}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Format time / date helpers
function fmtTime(iso, { withDate = false, lang = 'en' } = {}) {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (!withDate) return `${hh}:${mm}`;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${hh}:${mm}`;
}

function relTime(iso, lang = 'en') {
  const diff = (new Date(iso) - Date.now()) / 1000;
  const future = diff > 0;
  const abs = Math.abs(diff);
  const labels = { now: 'now', m: 'm', h: 'h', d: 'd', w: 'w' };
  let v, unit;
  if (abs < 60)            return labels.now;
  else if (abs < 3600)     { v = Math.floor(abs / 60); unit = labels.m; }
  else if (abs < 86400)    { v = Math.floor(abs / 3600); unit = labels.h; }
  else if (abs < 604800)   { v = Math.floor(abs / 86400); unit = labels.d; }
  else                     { v = Math.floor(abs / 604800); unit = labels.w; }
  return future ? `in ${v}${unit}` : `${v}${unit} ago`;
}

// ---------------------------------------------------------------------------
// Small "mock image" tile — used for post thumbnails so we never break the design
function MockImage({ tone = 'warm', label, className = '', kind = 'image' }) {
  const tones = {
    warm:  ['#FFC57A', '#E1306C'],
    night: ['#6E2412', '#B4451F'],
    sand:  ['#F4D9A1', '#D9A35E'],
    tech:  ['#2A1D16', '#D99A16'],
    ramadan: ['#1B3A6B','#D99A16'],
  }[tone] || ['#E0B36A', '#B4451F'];
  return (
    <div
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ background: `linear-gradient(135deg, ${tones[0]}, ${tones[1]})` }}
      aria-label={label}
    >
      {/* decorative shapes */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15" />
      <div className="absolute bottom-2 left-2 w-12 h-12 rounded-full bg-white/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
      {kind === 'video' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-12 h-12 rounded-full bg-white/90 grid place-items-center text-saf-dark"><Icon name="Play" size={20} /></div>
        </div>
      )}
      <div className="absolute bottom-2 ltr:left-2 rtl:right-2 text-[11px] text-white/90 font-medium drop-shadow">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Switch
function Switch({ checked, onChange, label, sub, disabled = false }) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <div className="min-w-0">
        <div className="text-sm text-saf-text">{label}</div>
        {sub && <div className="text-[12px] text-saf-muted">{sub}</div>}
      </div>
      <span
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) onChange(!checked); }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked); }
        }}
        className={`relative inline-block w-10 h-6 rounded-full transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 ${checked ? 'bg-saf-primary' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 ltr:left-0.5 rtl:right-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'ltr:translate-x-4 rtl:-translate-x-4' : ''}`} />
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Tooltip (CSS only)
// ---------------------------------------------------------------------------
// Sparkline — tiny inline SVG. No Recharts overhead (no ResponsiveContainer
// re-measure, no axis/grid layer). Renders nothing if data has < 2 points.
// Use for KPI strip indicators, trend cards, etc. — anything where the
// shape matters more than the precise values.
function Sparkline({ data, width = 80, height = 28, stroke = '#B4451F', fill = true, strokeWidth = 1.5, className = '' }) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - strokeWidth) - strokeWidth / 2]);
  const lineD = 'M' + points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L');
  const fillD = `${lineD} L${width.toFixed(2)},${height.toFixed(2)} L0,${height.toFixed(2)} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden="true" preserveAspectRatio="none">
      {fill && <path d={fillD} fill={stroke} fillOpacity={0.12} />}
      <path d={lineD} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Tooltip({ label, children, side = 'right' }) {
  const pos = {
    right: 'ltr:left-full rtl:right-full ltr:ml-2 rtl:mr-2 top-1/2 -translate-y-1/2',
    top:   'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom:'top-full mt-2 left-1/2 -translate-x-1/2',
  }[side];
  return (
    <span className="relative group inline-flex">
      {children}
      <span className={`pointer-events-none absolute ${pos} px-2 py-1 rounded-md bg-saf-dark text-white text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-pop`}>{label}</span>
    </span>
  );
}


// --- Star rating -------------------------------------------------------------
// Ratings are the restaurant's primary public metric, so they get a real
// primitive rather than a repeated emoji. Renders half-stars because a 4.3
// average shown as four stars is a lie the owner will notice immediately.
//
// Accessibility: the row carries the numeric value as its accessible name.
// Screen-reader users get "4.3 out of 5" rather than five identical "star"
// announcements, and the visual stars are hidden from the tree.
function StarRow({ value = 0, size = 14, className = '', showValue = false }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  const uid = React.useId ? React.useId() : `st-${Math.round(v * 100)}`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`${v.toFixed(1)} out of 5`}
    >
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, v - i));   // 0 → 1 for this star
        const gid = `${uid}-s${i}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
                <stop offset={`${fill * 100}%`} stopColor="#D99A16" />
                <stop offset={`${fill * 100}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.45 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95L12 2.6Z"
              fill={`url(#${gid})`}
              stroke="#D99A16"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
      {showValue && <span className="ms-1 text-[12px] font-semibold text-saf-text">{v.toFixed(1)}</span>}
    </span>
  );
}

// Compact rating chip used in dense rows (review list, competitor table).
// Tone is driven by the value, but the number is always present — rating is
// never communicated by colour alone.
function RatingBadge({ value, size = 'md', className = '' }) {
  const v = Number(value) || 0;
  const tone = v >= 4.5 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
             : v >= 3.5 ? 'bg-saf-light text-saf-primary border-saf-light'
             : v >= 2.5 ? 'bg-amber-50 text-amber-700 border-amber-200'
             :            'bg-rose-50 text-rose-700 border-rose-200';
  const dims = size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-[12px]';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-semibold ${tone} ${dims} ${className}`}>
      <Icon name="Star" size={size === 'sm' ? 10 : 12} />
      {v.toFixed(1)}
    </span>
  );
}

Object.assign(window, { Icon, Button, Card, Pill, Modal, Drawer, ToastProvider, useToast, useCountUp, fmt, fmtCompact, isAbsent, NOT_READABLE, AnimatedNumber, Tabs, Skeleton, PlatformBadge, fmtTime, relTime, MockImage, Switch, Tooltip, Sparkline, StarRow, RatingBadge });
