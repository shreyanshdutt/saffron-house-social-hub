// Customers — tagged by dish, costed on who can actually be reached.
//
// CONVENTIONS.md §11 is the specification and this screen is where it is
// visible or broken. Three things it must never do:
//
//   1. RENDER A SEGMENT AS ONE NUMBER. Every segment shows "N tagged ·
//      M reachable", everywhere — heading, row, tooltip, nowhere excepted. A
//      single figure beside a send control tells a restaurant it can reach
//      people it cannot, and it finds out by paying ₹0.8631 a message.
//   2. COST A SEGMENT ON `tagged`. The cost line multiplies REACHABLE. Costing
//      on tagged would overstate the bill by exactly the number of people who
//      cannot be messaged, which is the same error as (1) wearing a currency
//      symbol.
//   3. OFFER A BROADCAST. There is no send path, so there is no button. A
//      control that would work later is still a claim that it works now.
//
// The rate is not in this file. It comes from the server
// (WHATSAPP_MARKETING_RATE_INR in server/src/config.js) because a price that
// governs money has one home, and a copy here would be a second.

function CustomersPage() {
  return (
    <RequiresServerData what="customer tags">
      {(data) => <CustomersPageInner data={data} />}
    </RequiresServerData>
  );
}

function CustomersPageInner({ data }) {
  const toast = useToast();
  const { profile } = React.useContext(AppCtx);
  const [busy, setBusy] = React.useState(false);

  const customers = data.customers;
  const segments = data.segments;
  const rate = data.marketingRate;

  const reachableTotal = customers.filter(c => c.reachable).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-saf-text">Customers</h1>
        <p className="text-sm text-saf-muted mt-1">
          Tagged by dish, so an offer goes to the people who order it. {customers.length} customers,
          {' '}{reachableTotal} of them reachable on WhatsApp.
        </p>
      </div>

      {/* THE PRIVACY POSITION, STATED WHERE IT IS ACTED ON rather than only in
          a document. A person reading this screen is looking at named
          individuals and should know what is held about them. */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border">
        <Icon name="ShieldCheck" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">
          <strong className="text-saf-text">No phone numbers, emails or addresses are stored.</strong> An
          imported customer carries a reference issued by the messaging provider, never a number. Somebody
          added by hand carries only the label you give them — which is why they cannot be messaged, and why
          every segment below shows how many of its people can be.
        </p>
      </div>

      <SegmentList segments={segments} rate={rate} />
      <CustomerList customers={customers} menu={data.menu} busy={busy} setBusy={setBusy} toast={toast} profile={profile} />
      <AddCustomer menu={data.menu} busy={busy} setBusy={setBusy} toast={toast} profile={profile} />
      <ImportPanel status={data.importStatus} />
    </div>
  );
}

// --- segments ---------------------------------------------------------------

function SegmentList({ segments, rate }) {
  if (!segments.length) {
    return (
      <Card padding="p-5">
        <div className="text-[15px] font-semibold text-saf-text">No segments yet</div>
        <p className="text-[12.5px] text-saf-muted mt-1">
          A segment appears once at least one customer is tagged with a dish.
        </p>
      </Card>
    );
  }
  return (
    <Card padding="p-0">
      <div className="p-4 border-b border-saf-border">
        <h2 className="text-[15px] font-semibold text-saf-text">Segments</h2>
        <p className="text-[12px] text-saf-muted mt-0.5">
          What a marketing message would cost, per dish. Priced on the people who can receive one.
        </p>
      </div>
      <div className="divide-y divide-saf-border">
        {segments.map(s => <SegmentRow key={s.menuItemId} segment={s} rate={rate} />)}
      </div>
    </Card>
  );
}

function SegmentRow({ segment, rate }) {
  const { name, tagged, reachable, unreachable } = segment;
  // Both numbers, always, in one string that cannot be rendered half-way.
  const counts = `${tagged} tagged · ${reachable} reachable`;
  const canReach = reachable > 0;
  const cost = canReach && Number.isFinite(rate) ? reachable * rate : null;

  return (
    <div className="p-4 flex items-start gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-saf-text">{name}</div>
        <div className="text-[12.5px] text-saf-text mt-1 tabular-nums">{counts}</div>
        {unreachable > 0 && (
          <div className="text-[11.5px] text-saf-muted mt-0.5">
            {unreachable} {unreachable === 1 ? 'person was' : 'people were'} added by hand and cannot be messaged.
          </div>
        )}
      </div>

      <div className="text-end shrink-0 min-w-[220px]">
        {canReach ? (
          <>
            {/* THE ARITHMETIC IS SHOWN, not just its result. It is the whole
                argument for the feature and the demonstration of why two
                numbers exist — the multiplier is `reachable`, and a reader can
                see that it is not `tagged`. */}
            <div className="text-[12.5px] text-saf-text tabular-nums">
              {reachable} × ₹{rate} = <strong>₹{cost.toFixed(2)}</strong>
            </div>
            <div className="text-[11px] text-saf-muted mt-0.5">one marketing message to this segment</div>
          </>
        ) : (
          /* NOT "₹0.00". A zero price reads as a bargain; this is a dead end,
             and the difference matters when the next control a person looks
             for is Send. */
          <div className="inline-flex items-start gap-1.5 text-start">
            <Icon name="Ban" size={13} className="text-saf-muted mt-0.5 shrink-0" />
            <span className="text-[11.5px] text-saf-muted leading-relaxed">
              Nobody in this segment can be messaged — all {tagged} {tagged === 1 ? 'was' : 'were'} added by hand.
              There is no cost because there is no reachable audience.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- customers --------------------------------------------------------------

// NAMED FOR ITS FILE, not `SourceBadge`. `page-recommendations.jsx`:428 already
// defines a `SourceBadge({ src })`, it loads AFTER this file, and every
// `src/*.jsx` shares one global scope (CLAUDE.md §5) — so the plain name was
// silently shadowed and this badge rendered nothing at all. Nothing threw; the
// row simply lost half its information, which is the failure mode §5 warns is
// the bad case. Caught by looking at a screenshot, not by a test.
function CustomerSourceBadge({ source }) {
  // Two visually distinct badges so the kind of row never has to be inferred.
  // Contrast measured, not eyeballed — see the commit report.
  const imported = source === 'imported';
  return (
    <span className={`px-2 h-5 inline-flex items-center gap-1 rounded-full text-[11px] font-semibold border ${
      // 700 WEIGHTS, NOT 800. `index.html`'s dark block overrides
      // text-emerald-700 / text-amber-700 and their backgrounds; it does not
      // override the 800s, so 800 stayed dark-on-dark and measured 1.90:1 and
      // 1.92:1 — a badge that is invisible in dark mode and looks fine in
      // light. The border weights have no dark override either, so this uses
      // the themed border token instead of an emerald/amber one.
      imported
        ? 'bg-emerald-50 text-emerald-700 border-saf-border'
        : 'bg-amber-50 text-amber-700 border-saf-border'
    }`}>
      <Icon name={imported ? 'Smartphone' : 'PenLine'} size={11} />
      {imported ? 'From contacts' : 'Added by hand'}
    </span>
  );
}

function ReachBadge({ reachable }) {
  return (
    <span className={`px-2 h-5 inline-flex items-center gap-1 rounded-full text-[11px] font-medium ${
      reachable ? 'bg-saf-light text-saf-primary' : 'bg-saf-surface text-saf-muted border border-saf-border'
    }`}>
      <Icon name={reachable ? 'MessageCircle' : 'MessageCircleOff'} size={11} />
      {reachable ? 'Can be messaged' : 'Cannot be messaged'}
    </span>
  );
}

function CustomerList({ customers, menu, busy, setBusy, toast, profile }) {
  const removeTag = async (customer, tag) => {
    if (busy) return;
    setBusy(true);
    try {
      await untagCustomer(customer.id, tag.menuItemId);
      toast.push({ title: `Removed the ${tag.name} tag`, kind: 'info' });
    } catch (err) {
      toast.push({ title: 'Nothing was changed', desc: `The data service could not be reached. ${err.message}`, kind: 'error' });
    } finally { setBusy(false); }
  };

  return (
    <Card padding="p-0">
      <div className="p-4 border-b border-saf-border">
        <h2 className="text-[15px] font-semibold text-saf-text">Everyone</h2>
        <p className="text-[12px] text-saf-muted mt-0.5">Each tag records who added it and when.</p>
      </div>
      <div className="divide-y divide-saf-border">
        {customers.map(c => (
          <div key={c.id} className="p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-saf-text">{c.displayLabel}</div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <CustomerSourceBadge source={c.source} />
                  <ReachBadge reachable={c.reachable} />
                </div>
              </div>
              <TagPicker customer={c} menu={menu} busy={busy} setBusy={setBusy} toast={toast} profile={profile} />
            </div>

            {c.tags.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {c.tags.map(t => (
                  <li key={t.menuItemId}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-saf-surface border border-saf-border">
                    <span className="text-[12px] text-saf-text font-medium">{t.name}</span>
                    {/* The provenance, on screen. A tag is somebody's judgement
                        and reads as one. */}
                    <span className="text-[11px] text-saf-muted">
                      {t.taggedBy} · {fmtTime(t.taggedAt, { withDate: true })}
                    </span>
                    <button
                      onClick={() => removeTag(c, t)}
                      disabled={busy}
                      aria-label={`Remove the ${t.name} tag from ${c.displayLabel}`}
                      className="text-saf-muted hover:text-saf-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary rounded"
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// Adds one tag. `tagged_by` defaults to the signed-in person's name because
// they are the one making the judgement — it is never blank, and never a
// system label.
function TagPicker({ customer, menu, busy, setBusy, toast, profile }) {
  const [dish, setDish] = React.useState('');
  const untagged = menu.filter(m => !customer.tags.some(t => t.menuItemId === m.id));

  const add = async () => {
    if (!dish || busy) return;
    setBusy(true);
    try {
      await tagCustomer(customer.id, dish, profile ? profile.name : '');
      const name = (menu.find(m => m.id === dish) || {}).name || 'dish';
      toast.push({ title: `Tagged as ${name}`, desc: `Recorded against your name.`, kind: 'success' });
      setDish('');
    } catch (err) {
      toast.push({ title: 'The tag was not saved', desc: `${err.message}`, kind: 'error' });
    } finally { setBusy(false); }
  };

  if (!untagged.length) return <span className="text-[11.5px] text-saf-muted">Tagged with every dish</span>;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <label htmlFor={`tag-${customer.id}`} className="sr-only">Tag {customer.displayLabel} with a dish</label>
      <select
        id={`tag-${customer.id}`}
        value={dish}
        onChange={e => setDish(e.target.value)}
        className="h-8 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[12.5px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20"
      >
        <option value="">Tag a dish…</option>
        {untagged.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <Button size="sm" variant="secondary" disabled={!dish || busy} onClick={add}>Tag</Button>
    </div>
  );
}

// --- add by hand ------------------------------------------------------------

function AddCustomer({ menu, busy, setBusy, toast, profile }) {
  const [label, setLabel] = React.useState('');
  const [dish, setDish] = React.useState('');

  const submit = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      const created = await addStaffCustomer(label.trim());
      if (dish) await tagCustomer(created.id, dish, profile ? profile.name : '');
      toast.push({
        title: `${created.displayLabel} added`,
        desc: 'Added by hand, so they cannot be sent a WhatsApp message.',
        kind: 'success',
      });
      setLabel(''); setDish('');
    } catch (err) {
      toast.push({ title: 'Nothing was saved', desc: `The data service could not be reached. ${err.message}`, kind: 'error' });
    } finally { setBusy(false); }
  };

  return (
    <Card padding="p-4">
      <h2 className="text-[15px] font-semibold text-saf-text">Add someone by hand</h2>

      {/* THE THING THE PERSON FILLING THIS IN MOST NEEDS TO KNOW, above the
          fields rather than under them. Somebody typing a regular's name here
          is reasonably expecting to be able to message them later. */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border mt-2">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">
          This product stores <strong className="text-saf-text">no phone number and no email address</strong>, so
          there is nowhere to put one and <strong className="text-saf-text">somebody added here cannot be sent a
          WhatsApp message</strong>. They will count towards a segment's tagged total and not towards its
          reachable one. Use it to record what you know about a regular — the messaging comes from the
          contact list, when that is connected.
        </p>
      </div>

      <div className="flex items-end gap-2 flex-wrap mt-3">
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="new-customer-label" className="block text-[12px] text-saf-muted mb-1">
            What to call them
          </label>
          <input
            id="new-customer-label"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Thursday regular, table 12"
            maxLength={120}
            className="w-full h-9 px-3 rounded-lg border border-saf-border bg-white text-[13px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20"
          />
        </div>
        <div className="min-w-[190px]">
          <label htmlFor="new-customer-dish" className="block text-[12px] text-saf-muted mb-1">
            Tag a dish (optional)
          </label>
          <select
            id="new-customer-dish"
            value={dish}
            onChange={e => setDish(e.target.value)}
            className="w-full h-9 ps-2.5 pe-7 rounded-lg border border-saf-border bg-white text-[13px] text-saf-text focus:border-saf-primary focus:ring-2 focus:ring-saf-primary/20"
          >
            <option value="">No tag</option>
            {menu.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <Button variant="primary" leadingIcon="UserPlus" disabled={!label.trim() || busy} onClick={submit}>
          Add customer
        </Button>
      </div>
      {dish && (
        <p className="text-[11.5px] text-saf-muted mt-2">
          The tag will be recorded against {profile ? profile.name : 'you'}, with today's date.
        </p>
      )}
    </Card>
  );
}

// --- import -----------------------------------------------------------------

// Blocked on a DECISION, not on a network — so there is no spinner, no retry
// and no optimistic state. The reason is the server's, rendered verbatim from
// /customers/import-status rather than written into this file, so there is one
// place it can be wrong.
function ImportPanel({ status }) {
  const blocked = !status || status.ok === false;
  return (
    <Card padding="p-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-saf-surface border border-saf-border text-saf-muted grid place-items-center shrink-0">
          <Icon name="Upload" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-saf-text">Import your WhatsApp contacts</div>
          {blocked ? (
            <>
              <p className="text-[12.5px] text-saf-muted mt-1 leading-relaxed">
                {status ? status.reason : 'Import status is unavailable.'}
              </p>
              <Tooltip label="Blocked on a decision about your messaging provider, not on a connection." side="top">
                <span className="inline-block mt-2.5">
                  <Button variant="secondary" leadingIcon="Upload" disabled>Import contacts</Button>
                </span>
              </Tooltip>
            </>
          ) : (
            <p className="text-[12.5px] text-saf-muted mt-1">Import is available.</p>
          )}
        </div>
      </div>
    </Card>
  );
}

window.CustomersPage = CustomersPage;
