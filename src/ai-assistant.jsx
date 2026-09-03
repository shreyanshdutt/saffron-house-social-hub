// Floating AI Content Assistant.

function AIAssistant({ onCopyToComposer }) {
  const t = useT();
  const toast = useToast();
  const { lang } = React.useContext(AppCtx);

  const [open, setOpen] = React.useState(false);
  const [prompt, setPrompt] = React.useState('');
  const [tone, setTone] = React.useState('warm');
  const [platform, setPlatform] = React.useState('ig');
  const [loading, setLoading] = React.useState(false);
  const [output, setOutput] = React.useState('');
  const [thumb, setThumb] = React.useState(null);

  const presets = [
    { id: 'dish',    label: t.ai.preset.dish,    prompt: 'Write a post announcing the kathal galouti — jackfruit, the same 27-spice mix as our meat galouti, cooked to order on the tawa. ₹545. Do not oversell it; let the dish speak.' },
    { id: 'offer',   label: t.ai.preset.offer,   prompt: 'Announce our weekday lunch set menu: two courses and a cooler for ₹899, 12 to 4pm, walk in or book on WhatsApp.' },
    { id: 'review',  label: t.ai.preset.review,  prompt: 'Draft a public reply to a 1-star Google review from a guest who waited 55 minutes for a booked table and found two dishes unavailable. Own it, no excuses, offer a concrete next step.' },
    { id: 'tags',    label: t.ai.preset.tags,    prompt: 'Suggest 5 relevant hashtags for a post about our monsoon menu launching in Khan Market, New Delhi.' },
    { id: 'festive', label: t.ai.preset.festive, prompt: 'Create a Diwali post for our six-course festive menu — one seating a night, 24 seats, from 18 October. Warm and celebratory without being generic.' },
    { id: 'tone',    label: t.ai.preset.tone,    prompt: 'Improve the tone of this post so it sounds like a restaurant rather than an ad: "Best food in Delhi. Book now. Limited seats."' },
  ];

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setOutput('');
    setThumb(null);
    try {
      const toneLabel = {
        warm:   'warm and hospitable — the voice of a host, not a marketer',
        punchy: 'short and punchy — one strong line, no filler',
        formal: 'measured and precise — suitable for a press or partnership context',
      }[tone];
      const pName = PLATFORM_BY_ID[platform].name;
      const platformHint = {
        ig: 'Instagram — one punchy line plus 3-5 relevant hashtags. Emojis sparingly.',
        gg: 'Google Business Profile — factual and useful. A guest reads this next to our hours and rating, so lead with the concrete detail (what, when, price).',
        zo: 'Zomato — sits directly above an order button. Name the dish, give one reason to tap. No brand poetry.',
        sw: 'Swiggy — same as Zomato but shorter. Delivery context: mention what travels well.',
        di: 'District — an event listing. Lead with date, seating and what the guest actually gets.',
        wa: 'WhatsApp broadcast — write as a message to someone who opted in. Short, personal, no hashtags.',
      }[platform];
      const text = await window.claude.complete({
        messages: [
          { role: 'user', content:
            `You write for Saffron House, a modern-Indian restaurant in Khan Market, New Delhi. The voice is confident and specific: name the dish, name the person, say what actually happens in the kitchen. Never use empty superlatives ("best in Delhi", "culinary journey"), never invent awards, prices or availability, and never promise what the kitchen has not confirmed. Prices are in rupees. Tailor length and format to the channel.\n\nChannel: ${pName}. ${platformHint}\nTone: ${toneLabel}.\n\nRequest:\n${prompt}` },
        ],
      });
      setOutput(text.trim());
    } catch (e) {
      toast.push({ title: 'AI is unavailable', kind: 'error', desc: 'Please try again in a moment.' });
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    if (!output) return;
    onCopyToComposer(output);
    toast.push({ title: t.ai.copied });
    setOpen(false);
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="AI Assistant"
        className="fixed ltr:right-6 rtl:left-6 bottom-6 z-[120] w-14 h-14 rounded-full grid place-items-center text-white animate-floatPulse transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #B4451F 0%, #D99A16 100%)' }}
      >
        <Icon name="Sparkles" size={24} />
      </button>

      {/* Panel */}
      <div
        className={`fixed ltr:right-6 rtl:left-6 bottom-24 z-[120] w-[400px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-pop border border-saf-border overflow-hidden flex flex-col transition-all duration-300 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        style={{ maxHeight: 'calc(100vh - 8rem)' }}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center gap-3 text-white" style={{ background: 'linear-gradient(135deg, #B4451F 0%, #6E2412 100%)' }}>
          <span className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center"><Icon name="Sparkles" size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold leading-tight">{t.ai.title}</div>
            <div className="text-[11px] text-white/80">{t.ai.subtitle}</div>
          </div>
          <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/15 grid place-items-center"><Icon name="X" size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto nice-scroll p-4 space-y-3">
          {/* Presets */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-saf-muted mb-1.5">{t.ai.presets}</div>
            <div className="flex flex-wrap gap-1.5">
              {presets.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPrompt(p.prompt)}
                  className="text-[12px] px-2.5 h-8 rounded-full bg-saf-light text-saf-primary hover:bg-saf-primary hover:text-white transition"
                >{p.label}</button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.ai.describe}
            className="w-full min-h-[80px] p-3 rounded-lg border border-saf-border text-[13px] focus:border-saf-primary focus:ring-4 focus:ring-saf-primary/10 transition"
          />

          {/* Controls */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-saf-muted mb-1">Platform</div>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full h-9 px-2 rounded-lg border border-saf-border bg-white text-[13px]">
                {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <div className="text-[10px] uppercase tracking-wider text-saf-muted mb-1">Tone</div>
              <div className="inline-flex w-full items-center bg-saf-surface border border-saf-border rounded-lg p-0.5">
                {[
                  { v: 'warm',   l: t.ai.tone.warm },
                  { v: 'punchy', l: t.ai.tone.punchy },
                  { v: 'formal', l: t.ai.tone.formal },
                ].map(o => (
                  <button key={o.v} onClick={() => setTone(o.v)} aria-pressed={tone === o.v} className={`flex-1 h-7 text-[11px] font-medium rounded-md transition ${tone === o.v ? 'bg-white text-saf-primary shadow-sm' : 'text-saf-muted hover:text-saf-text'}`}>{o.l}</button>
                ))}
              </div>
            </label>
          </div>

          {/* Generate button */}
          <Button variant="primary" loading={loading} onClick={generate} className="w-full" leadingIcon={loading ? null : 'Sparkles'}>
            {loading ? t.ai.thinking : t.ai.generate}
          </Button>

          {/* Output */}
          {loading && (
            <div className="space-y-2 mt-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-9/12" />
              <Skeleton className="h-3 w-10/12" />
            </div>
          )}
          {output && !loading && (
            <div className="bg-saf-light/50 border border-saf-light rounded-xl p-3 animate-fadeScale">
              <div className="text-[10px] uppercase tracking-wider text-saf-primary font-medium mb-1.5 flex items-center gap-1">
                <Icon name="Sparkles" size={11} /> Suggested content
              </div>
              <div className="text-[13px] text-saf-text whitespace-pre-wrap leading-relaxed">{output}</div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setThumb('up')}
                    className={`w-8 h-8 rounded-lg grid place-items-center transition ${thumb === 'up' ? 'bg-emerald-100 text-emerald-700' : 'text-saf-muted hover:bg-white'}`}
                  ><Icon name="ThumbsUp" size={14} /></button>
                  <button
                    onClick={() => setThumb('down')}
                    className={`w-8 h-8 rounded-lg grid place-items-center transition ${thumb === 'down' ? 'bg-rose-100 text-rose-700' : 'text-saf-muted hover:bg-white'}`}
                  ><Icon name="ThumbsDown" size={14} /></button>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" leadingIcon="RefreshCw" onClick={generate}>{t.ai.regen}</Button>
                  <Button variant="primary" size="sm" leadingIcon="ClipboardCheck" onClick={copy}>{t.ai.copy}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-saf-border bg-saf-surface flex items-center gap-2 text-[10px] text-saf-muted">
          <Icon name="Shield" size={11} />
          <span>Saffron House brand voice applied to every response.</span>
        </div>
      </div>
    </>
  );
}

Object.assign(window, { AIAssistant });
