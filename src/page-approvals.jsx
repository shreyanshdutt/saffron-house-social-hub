// Approvals — replaces the old History screen with a workflow-tabbed
// queue. Six tabs: Draft / In Review / Approved / Sent Back / Rejected /
// Templates. Per-row action buttons are role-gated:
//   Approve   → Manager only (draft.approve)
//   Publish   → Manager only (post.publish)
//   Send back → SrExec+ (draft.review)
//   Flag      → SrExec+ (draft.flag)
//   Comment   → SrExec+ (draft.comment)
//   Submit    → Exec+ (draft.submit) — only on Draft rows owned by user
// Disabled buttons retain their layout slot but receive a tooltip
// explaining the gate. Hidden actions are reserved only for items truly
// outside a role's scope (e.g. Templates).

// WHY EVERY ACTION ON THIS SCREEN IS OFF, said once at the top of the screen
// rather than eight times on eight hovers. Same pattern as the Settings connect
// buttons (c0e54f1), Channel Health (688c020), the Composer (760ec7b) and the
// Reviews escalate control (8ce1c20).
//
// THE REASON IS NOT THE COMPOSER'S AND MUST NOT BE WORDED LIKE IT. The Composer
// cannot publish because no channel is connected and there is nowhere to store
// a post. This screen cannot approve because there is no approval state
// anywhere — no server table, no client state, nothing that remembers a
// decision. Connecting Instagram would not make Approve work, and a panel that
// implied otherwise would send someone off to fix the wrong thing.
const NO_APPROVAL_STATE_REASON =
  'Approving, publishing, sending back, commenting, flagging and submitting are all switched ' +
  'off. Nothing here can record a decision — no approval status is stored anywhere, so a post ' +
  'cannot move between these tabs and a decision would be forgotten the moment you left the ' +
  'page. This is not about a channel being connected: connecting Instagram would not make ' +
  'Approve work. Reading the queue, switching tabs, searching and opening a post all still work.';

// The short form for a hover. The panel carries the full sentence.
const NO_APPROVAL_STATE_TIP =
  'Off: there is nowhere to record an approval decision yet.';

const APPROVAL_TABS = [
  { id: 'draft',     label: 'Draft',     icon: 'FileEdit',   tone: 'bg-slate-100 text-slate-700' },
  { id: 'in_review', label: 'In Review', icon: 'Eye',         tone: 'bg-amber-50 text-amber-700' },
  { id: 'approved',  label: 'Approved',  icon: 'CheckCircle2',tone: 'bg-emerald-50 text-emerald-700' },
  { id: 'sent_back', label: 'Sent Back', icon: 'Undo2',       tone: 'bg-rose-50 text-rose-700' },
  { id: 'rejected',  label: 'Rejected',  icon: 'XCircle',     tone: 'bg-rose-50 text-rose-700' },
  { id: 'templates', label: 'Templates', icon: 'BookTemplate',tone: 'bg-saf-light text-saf-primary' },
];

const STATUS_TONE = {
  draft:     'gray',
  in_review: 'amber',
  approved:  'green',
  sent_back: 'red',
  rejected:  'red',
  published: 'blue',
  scheduled: 'blue',
  failed:    'red',
};

// Augmented mock with the 6-tab statuses (the base POSTS only had 4).
const APPROVAL_POSTS = [
  ...POSTS,
  { id: 'a-rev-1', platforms: ['ig','gg'], status: 'in_review', date: '2026-09-04T08:30:00+05:30', author: 'Ananya Rao', content: 'Diwali menu — six courses, one seating a night, 24 seats, from 18 October. ₹4,500 per head. Bookings open Monday 9am on WhatsApp.', tags: ['#Diwali','#SaffronHouse'], media: { kind: 'image', label: 'Festive table setting, marigold and brass', tone: 'warm' }, metrics: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, rate: 0 } },
  { id: 'a-rev-2', platforms: ['gg'], status: 'in_review', date: '2026-09-04T07:45:00+05:30', author: 'Rohit Malhotra', content: 'Saffron House will host the Delhi Restaurant Week opening dinner on 12 October — Chef Meera cooking alongside three guest kitchens.', tags: ['#DelhiRestaurantWeek','#SaffronHouse'], metrics: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, rate: 0 } },
  { id: 'a-back-1', platforms: ['ig','gg'], status: 'sent_back', date: '2026-09-03T15:00:00+05:30', author: 'Ananya Rao', content: 'Free dessert with every booking this weekend…', sendBackReason: 'The kitchen has not signed off on covering this and the floor is already behind on Saturdays. Confirm with Vikram before this goes anywhere.', sendBackBy: 'Priya Menon', tags: ['#SaffronHouse','#WeekendOffer'], metrics: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, rate: 0 } },
  { id: 'a-rej-1', platforms: ['ig'], status: 'rejected', date: '2026-09-02T11:00:00+05:30', author: 'Ananya Rao', content: 'Voted the best restaurant in Delhi 🏆', rejectedReason: 'We were listed in the Delhi Top 50 — we did not win anything. Claiming an award we did not receive is the fastest way to lose the listing.', rejectedBy: 'Priya Menon', tags: ['#SaffronHouse'], metrics: { views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, rate: 0 } },
];

const APPROVAL_TEMPLATES = [
  { id: 'tpl-1', name: 'New dish — launch post',      platforms: ['ig','gg'],      useCount: 24, lastUsed: '28 Aug' },
  { id: 'tpl-2', name: 'Chef / team story',           platforms: ['ig'],           useCount: 11, lastUsed: '22 Aug' },
  { id: 'tpl-3', name: 'Festive menu — full kit',     platforms: ['ig','gg'],      useCount: 18, lastUsed: '14 Aug' },
  { id: 'tpl-4', name: 'Set menu / offer',            platforms: ['ig'],           useCount: 6,  lastUsed: '9 Aug' },
  { id: 'tpl-5', name: 'Review reply — negative',     platforms: ['gg'],           useCount: 92, lastUsed: 'today' },
];

function ApprovalsPage({ role, openedPost, onCloseDrawer }) {
  const t = useT();
  const [tab, setTab] = React.useState('in_review');
  const [drawerPost, setDrawerPost] = React.useState(null);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => { if (openedPost) setDrawerPost(openedPost); }, [openedPost]);

  // Counts per tab (drives the small numeric pill on each tab button)
  const counts = React.useMemo(() => {
    const c = { draft: 0, in_review: 0, approved: 0, sent_back: 0, rejected: 0, templates: APPROVAL_TEMPLATES.length };
    APPROVAL_POSTS.forEach(p => { if (c[p.status] !== undefined) c[p.status] += 1; });
    return c;
  }, []);

  const rows = React.useMemo(() => {
    if (tab === 'templates') return APPROVAL_TEMPLATES;
    return APPROVAL_POSTS
      .filter(p => p.status === tab)
      .filter(p => !search || p.content.toLowerCase().includes(search.toLowerCase()));
  }, [tab, search]);

  const canApprove = hasPerm(role, 'draft.approve');
  const canPublish = hasPerm(role, 'post.publish');
  const canReview  = hasPerm(role, 'draft.review');
  const canSubmit  = hasPerm(role, 'draft.submit');

  // ALWAYS RENDERS THE DISABLED FORM. Every one of these was an inline
  // toast.push and nothing else — no state write, no side effect — so there is
  // no local half worth leaving enabled the way drafting a reply was in
  // 8ce1c20. `enabled` is kept because the permission distinction is real and
  // demoable: a Social Coordinator genuinely cannot approve, and a draft of a
  // screen that hides that is less honest, not more.
  //
  // The build reason LEADS and the permission reason follows, because the build
  // reason is the unfixable half — being granted `draft.approve` would still
  // record nothing. Same precedence `server/src/channels.js` uses when a
  // platform limit and an account limit both say no, and the same order
  // 8ce1c20's escalate tooltip uses.
  function ActionBtn({ enabled, label, leadingIcon, variant = 'primary', size = 'sm', permissionReason }) {
    return (
      <Tooltip label={enabled ? NO_APPROVAL_STATE_TIP : `${NO_APPROVAL_STATE_TIP} ${permissionReason}`} side="top">
        <span className={`inline-flex items-center justify-center gap-2 h-8 px-3 rounded-lg font-medium select-none whitespace-nowrap text-[13px]
          opacity-60 cursor-not-allowed
          ${variant === 'primary' ? 'bg-saf-primary text-white' :
            variant === 'danger'  ? 'bg-saf-danger text-white' :
            variant === 'dark'    ? 'bg-saf-dark text-white' :
                                    'bg-white text-saf-text border border-saf-border'}`}
          aria-disabled="true">
          <Icon name={leadingIcon} size={14} />{label}
        </span>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-saf-text">Approvals</h1>
          <p className="text-sm text-saf-muted mt-1">Workflow queue for every post moving through review.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" leadingIcon="Filter">Filters</Button>
          <ActionBtn
            enabled={canSubmit}
            label="Submit new for approval"
            leadingIcon="Send"
            variant="primary"
            permissionReason="Requires draft.submit — Executive, Sr. Exec or Manager"
          />
        </div>
      </div>

      {/* Stated once, above the tabs, so it is on screen whichever tab is open
          and whether or not a row happens to carry an action. */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-saf-surface border border-saf-border">
        <Icon name="Info" size={14} className="text-saf-muted mt-0.5 shrink-0" />
        <p className="text-[12px] text-saf-muted leading-relaxed">{NO_APPROVAL_STATE_REASON}</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-saf-border overflow-x-auto nice-scroll" role="tablist">
        {APPROVAL_TABS.map(tb => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.id)}
              className={`relative tab-underline ${active ? 'active text-saf-primary font-medium' : 'text-saf-muted hover:text-saf-text'}
                inline-flex items-center gap-2 px-3 h-11 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saf-primary focus-visible:ring-offset-2 rounded-md`}
            >
              <Icon name={tb.icon} size={14} />
              <span className="text-[13px]">{tb.label}</span>
              <span className={`px-1.5 h-5 min-w-[20px] grid place-items-center text-[10px] rounded-full font-semibold ${active ? 'bg-saf-primary text-white' : 'bg-saf-surface text-saf-muted'}`}>
                {counts[tb.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      {tab !== 'templates' && (
        <div className="flex items-center bg-white border border-saf-border rounded-lg h-10 px-3 gap-2 max-w-md focus-within:border-saf-primary focus-within:ring-4 focus-within:ring-saf-primary/10 transition">
          <Icon name="Search" size={14} className="text-saf-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by keyword…" className="flex-1 bg-transparent text-[13px]" />
        </div>
      )}

      {/* Rows */}
      {tab === 'templates' ? (
        <Card padding="p-0">
          <div className="divide-y divide-saf-border">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-xl bg-saf-light text-saf-primary grid place-items-center"><Icon name="BookTemplate" size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-medium text-saf-text">{r.name}</div>
                  <div className="text-[12px] text-saf-muted mt-0.5">Used {r.useCount} times · last on {r.lastUsed}</div>
                </div>
                <div className="flex -space-x-1.5 rtl:space-x-reverse">
                  {r.platforms.map((pi, i) => (
                    <span key={pi} className="w-6 h-6 rounded-full grid place-items-center text-white ring-2 ring-white" style={{ background: PLATFORM_BY_ID[pi].color, zIndex: 10 - i }}>
                      <PlatformGlyph id={pi} size={11} />
                    </span>
                  ))}
                </div>
                <ActionBtn
                  enabled={canSubmit}
                  label="Use template"
                  leadingIcon="Plus"
                  variant="secondary"
                  permissionReason="Requires draft.submit — Executive, Sr. Exec or Manager"
                />
              </div>
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card padding="p-10" className="text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-saf-light grid place-items-center text-saf-primary"><Icon name="Inbox" size={26} /></div>
          <div className="mt-3 text-[15px] font-medium text-saf-text">Nothing in {APPROVAL_TABS.find(x => x.id === tab).label.toLowerCase()}</div>
          <div className="text-[13px] text-saf-muted mt-1">When a post moves into this status, it'll appear here.</div>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map(p => {
            const tabDef = APPROVAL_TABS.find(x => x.id === p.status);
            return (
              <Card key={p.id} padding="p-4" className="hover:shadow-pop transition-all">
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {p.media ? <MockImage tone={p.media.tone} kind={p.media.kind} label="" className="w-20 h-20" />
                             : <div className="w-20 h-20 rounded-lg bg-saf-light grid place-items-center text-saf-primary"><Icon name="FileText" size={24} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Pill tone={STATUS_TONE[p.status]}><Icon name={tabDef.icon} size={10} />{tabDef.label}</Pill>
                      <div className="flex -space-x-1.5 rtl:space-x-reverse">
                        {p.platforms.map((pi, i) => (
                          <span key={pi} className="w-5 h-5 rounded-full grid place-items-center text-white ring-1 ring-white" style={{ background: PLATFORM_BY_ID[pi].color, zIndex: 10 - i }}>
                            <PlatformGlyph id={pi} size={9} />
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-saf-muted">{fmtTime(p.date, { withDate: true })} · {p.author}</span>
                    </div>
                    <div className="text-[14px] text-saf-text line-clamp-2">{p.content}</div>

                    {/* Send-back reason callout */}
                    {p.sendBackReason && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-[12px] text-rose-700 ltr:border-l-4 rtl:border-r-4 border-rose-500">
                        <div className="font-medium">Sent back by {p.sendBackBy}</div>
                        <div className="text-rose-600">{p.sendBackReason}</div>
                      </div>
                    )}
                    {p.rejectedReason && (
                      <div className="mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-[12px] text-rose-700 ltr:border-l-4 rtl:border-r-4 border-rose-500">
                        <div className="font-medium">Rejected by {p.rejectedBy}</div>
                        <div className="text-rose-600">{p.rejectedReason}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action row — varies by tab */}
                <div className="mt-4 pt-3 border-t border-saf-border flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" leadingIcon="Eye" onClick={() => setDrawerPost(p)}>View details</Button>
                  {p.status === 'in_review' && (
                    <>
                      <ActionBtn
                        enabled={canApprove}
                        label="Approve"
                        leadingIcon="CheckCircle2"
                        variant="primary"
                        permissionReason="Approve requires the Manager role"
                      />
                      <ActionBtn
                        enabled={canReview}
                        label="Send back"
                        leadingIcon="Undo2"
                        variant="secondary"
                        permissionReason="Send back requires Sr. Exec or Manager"
                      />
                      <ActionBtn
                        enabled={canReview}
                        label="Comment"
                        leadingIcon="MessageCircle"
                        variant="secondary"
                        permissionReason="Commenting requires Sr. Exec or Manager"
                      />
                      <ActionBtn
                        enabled={canReview}
                        label="Flag"
                        leadingIcon="Flag"
                        variant="secondary"
                        permissionReason="Flagging requires Sr. Exec or Manager"
                      />
                    </>
                  )}
                  {p.status === 'approved' && (
                    <ActionBtn
                      enabled={canPublish}
                      label="Publish now"
                      leadingIcon="Send"
                      variant="primary"
                      permissionReason="Publish requires the Manager role"
                    />
                  )}
                  {p.status === 'sent_back' && (
                    <Button variant="secondary" size="sm" leadingIcon="PenSquare">Edit & resubmit</Button>
                  )}
                  {p.status === 'draft' && (
                    <ActionBtn
                      enabled={canSubmit}
                      label="Submit for approval"
                      leadingIcon="Send"
                      variant="primary"
                      permissionReason="Submitting requires Executive, Sr. Exec or Manager"
                    />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PostDetailDrawer post={drawerPost} onClose={() => { setDrawerPost(null); onCloseDrawer && onCloseDrawer(); }} />
    </div>
  );
}

window.ApprovalsPage = ApprovalsPage;
// Backwards alias — anything still referencing HistoryPage gets the new
// screen.
window.HistoryPage = ApprovalsPage;
