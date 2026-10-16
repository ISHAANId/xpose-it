(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $('#view');

  /* ---------- storage ---------- */
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('xpose.' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('xpose.' + k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- data ---------- */
  const MODES = {
    photo: { icon: 'image', big: 'lens_blur', title: 'Photo & Image', kind: 'Image Bitmap', accept: 'image/jpeg,image/png,image/webp', limit: 'JPEG, PNG, WEBP • Up to 25MB', max: 25 * 1048576, verb: 'Verify Photo',
      short: 'Check for AI-generated or edited images.', desc: 'Inspect pixel artifacts, AI generative features, diffusion signatures, and EXIF/metadata consistency.',
      signals: { high: 'Diffusion-like texture, inconsistent lighting', mid: 'Compression masks edges; metadata missing', low: 'Sensor noise pattern uniformly distributed' } },
    audio: { icon: 'graphic_eq', big: 'graphic_eq', title: 'Audio & Voice Note', kind: 'Audio Stream', accept: 'audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac', limit: 'MP3, WAV, M4A, AAC • Up to 10 min', max: 100 * 1048576, verb: 'Verify Audio',
      short: 'Check for cloned or synthetic voices.', desc: 'Detect synthetic speech patterns, voice cloning markers, vocoder acoustics, and splice boundaries.',
      signals: { high: 'Unnatural formant transitions, synthetic pitch', mid: 'Possible splice boundary near 00:12', low: 'Natural breath and room-tone variance' } },
    video: { icon: 'videocam', big: 'videocam', title: 'Video & Deepfake', kind: 'Video Stream', accept: 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm', limit: 'MP4, MOV, WEBM • Up to 60 sec', max: 200 * 1048576, verb: 'Verify Video',
      short: 'Check for deepfakes and altered footage.', desc: 'Examine temporal face coherence, lip-sync alignment, frame flickering, and generative motion defects.',
      signals: { high: 'Blink anomaly, jawline warp synthesis', mid: 'Minor lip-sync drift across frames', low: 'Temporal face coherence stable' } }
  };
  const SAMPLES = [
    { id: 's1', name: 'campus_speech_clip.wav', mode: 'audio', size: '4.2 MB', when: 'Today, 14:22', score: 92, signals: 'Unnatural formant transitions, synthetic pitch (92%)', sample: true },
    { id: 's2', name: 'class_group_photo_edit.jpg', mode: 'photo', size: '1.8 MB', when: 'Yesterday, 18:05', score: 48, signals: 'Artifacts mask boundaries; missing EXIF', sample: true },
    { id: 's3', name: 'seminar_announcement_poster.png', mode: 'photo', size: '820 KB', when: '3 days ago', score: 8, signals: 'Sensor noise pattern uniformly distributed', sample: true },
    { id: 's4', name: 'hall_debate_video.mp4', mode: 'video', size: '18.4 MB', when: '5 days ago', score: 87, signals: 'Blink anomaly, jawline warp synthesis', sample: true }
  ];
  const BASE_USED = 14, QUOTA = 20;

  const getRuns = () => store.get('runs', []);
  const getAll = () => [...getRuns(), ...SAMPLES];
  const used = () => Math.min(QUOTA, BASE_USED + getRuns().length);
  const settings = () => ({ autopurge: true, notify: true, share: false, ...store.get('settings', {}) });

  const cat = s => s >= 66
    ? { label: 'High Risk', cls: 'bg-error-container/40 text-error', dot: 'bg-error', col: '#ffb4ab' }
    : s >= 33
      ? { label: 'Caution', cls: 'bg-surface-container-highest text-secondary-fixed', dot: 'bg-secondary-fixed', col: '#e8ddff' }
      : { label: 'No Anomaly', cls: 'bg-tertiary-container/30 text-tertiary', dot: 'bg-tertiary', col: '#45dfa4' };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  const when = t => { const d = new Date(t); return 'Today, ' + d.toTimeString().slice(0, 5); };

  /* ---------- shared fragments ---------- */
  const chip = (txt, cls = 'bg-surface-container-highest text-outline') => `<span class="px-space-xs py-0.5 ${cls} font-label-sm text-label-sm uppercase">${txt}</span>`;
  const badge = s => { const c = cat(s); return `<span class="inline-flex items-center gap-1 px-space-xs py-0.5 ${c.cls} font-label-sm text-label-sm uppercase font-semibold whitespace-nowrap"><span class="w-1.5 h-1.5 ${c.dot} rounded-full"></span>${c.label}</span>`; };
  const meter = pct => { const on = Math.round(pct / 5), c = cat(pct).col; return `<div class="seg" role="img" aria-label="${pct}% synthetic likelihood">${Array.from({ length: 20 }, (_, i) => `<i style="${i < on ? 'background:' + c : ''}"></i>`).join('')}</div>`; };
  const page = (inner, eyebrow = '') => `<div class="relative w-full px-gutter lg:px-gutter-lg py-margin-md flex flex-col gap-space-lg overflow-hidden">
    ${eyebrow}${inner}</div>`;
  const head = (title, sub) => `<div class="flex flex-col gap-space-xs"><h1 class="font-headline-lg text-headline-lg">${title}</h1><p class="text-on-surface-variant max-w-2xl">${sub}</p></div>`;
  const btn = (href, txt, icon, primary) => `<a href="${href}" class="h-10 px-space-md ${primary ? 'bg-primary text-on-primary hover:bg-primary-fixed font-bold' : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'} font-label-md text-label-md uppercase tracking-wider inline-flex items-center gap-space-xs transition-colors"><span class="material-symbols-outlined text-base">${icon}</span>${txt}</a>`;

  function rows(list) {
    if (!list.length) return `<tr><td colspan="4" class="py-space-lg px-space-md text-outline">No reports found.</td></tr>`;
    return list.map(r => {
      const m = MODES[r.mode];
      return `<tr class="border-t border-outline-variant/30 hover:bg-surface-container transition-colors">
        <td class="py-space-md px-space-md"><div class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-secondary">${m.icon}</span><span class="font-semibold break-all">${esc(r.name)}</span></div></td>
        <td class="py-space-md px-space-sm whitespace-nowrap text-outline">${esc(r.when)}</td>
        <td class="py-space-md px-space-sm">${badge(r.score)}</td>
        <td class="py-space-md px-space-md text-right"><a href="#/report/${r.id}" class="text-primary hover:underline">View</a></td></tr>`;
    }).join('');
  }
  const table = (list, title, extra = '') => `<div class="bg-surface-container-low min-w-0">
    <div class="p-space-md flex items-center justify-between gap-space-sm"><h2 class="font-headline-sm text-headline-sm">${title}</h2>${extra}</div>
    <div class="overflow-x-auto"><table class="w-full text-left border-collapse min-w-[480px]"><tbody>${rows(list)}</tbody></table></div></div>`;

  /* ---------- chrome ---------- */
  const NAV1 = [['overview', 'home', 'Overview'], ['photo-analysis', 'image', 'Photo'], ['audio-analysis', 'graphic_eq', 'Audio'], ['video-analysis', 'videocam', 'Video'], ['verification-history', 'history', 'History'], ['safety-centre', 'verified_user', 'Safety Centre']];
  const NAV2 = [['safety-centre', 'verified_user', 'Safety Centre', 'ACTION GUIDE', 'bg-tertiary-container text-on-tertiary'], ['digital-literacy-faq', 'menu_book', 'Digital Literacy & FAQ'], ['institutional-portal', 'school', 'Institutional Portal']];
  const NAV3 = [['settings-privacy', 'tune', 'Settings & Privacy'], ['help-support', 'support', 'Help & Support']];
  const navLink = ([p, ic, t, tag, tc]) => `<a href="#/${p}" data-nav="${p}" class="flex items-center justify-between gap-space-sm px-space-sm py-space-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors font-label-md text-label-md">
    <span class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-base">${ic}</span>${t.replace('&', '&amp;')}</span>${tag ? `<span class="px-space-xs py-0.5 ${tc} font-label-sm text-label-sm">${tag}</span>` : ''}</a>`;

  function renderSidebar() {
    $('#sidebar').innerHTML = `<div class="flex flex-col gap-space-md p-space-md">
      <a href="#/overview" class="font-headline-md text-headline-md text-primary py-space-sm">xpose.it</a>
      <nav class="flex flex-col gap-1">${NAV1.map(navLink).join('')}</nav></div>`;
  }
  function markActive(route) {
    const key = route === 'report' ? 'verification-history' : route;
    $$('[data-nav]').forEach(a => {
      const on = a.dataset.nav === key;
      a.className = a.className.replace(/ ?(bg-secondary-container text-on-secondary-container font-bold)/g, '');
      if (on) { a.className += ' bg-secondary-container text-on-secondary-container font-bold'; a.setAttribute('aria-current', 'page'); } else a.removeAttribute('aria-current');
    });
  }

  /* ---------- views ---------- */
  const V = {};

  V['overview'] = () => {
    const tile = k => { const m = MODES[k];
      return `<a href="#/${k}-analysis" class="group bg-surface-container-low hover:bg-surface-container transition-colors flex flex-col gap-space-md p-space-lg">
        <span class="w-12 h-12 bg-secondary-container text-on-secondary-container flex items-center justify-center"><span class="material-symbols-outlined text-2xl">${m.big}</span></span>
        <div><h2 class="font-headline-sm text-headline-sm">${m.title.replace('&', '&amp;')}</h2><p class="font-body-sm text-body-sm text-on-surface-variant mt-1">${m.short}</p></div>
        <span class="mt-auto text-primary font-label-md text-label-md uppercase font-bold group-hover:translate-x-1 transition-transform">${m.verb} →</span></a>`; };
    return page(`
      ${head('Check media before you share it', 'Upload a photo, audio clip or video to see whether it shows signs of manipulation.')}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">${['photo', 'audio', 'video'].map(tile).join('')}</div>
      ${table(getAll().slice(0, 4), 'Recent checks', '<a href="#/verification-history" class="text-primary hover:underline">View all</a>')}
      <p class="text-outline font-body-sm text-body-sm">Results are one source of evidence, not proof. If something targets you or a classmate, see the <a href="#/safety-centre" class="text-primary underline">Safety Centre</a>.</p>`);
  };

  function protocolCard() {
    const steps = [['bg-error-container text-on-error', 'Do not repost or circulate', 'Even forwarding to “debunk” content increases reach and algorithmic traction within campus groups.'], ['bg-secondary-container text-on-secondary-container', 'Preserve metadata & source', 'Take full uncropped screen captures including timestamps, group headers, and original download files.'], ['bg-tertiary-container text-on-tertiary', 'Consult an advisor first', 'Reach out to your designated academic counselor or student rights office before making public statements.']];
    return `<div class="bg-surface-container-low p-space-md flex flex-col gap-space-md"><div class="flex justify-between"><span class="flex items-center gap-space-xs font-label-sm text-label-sm font-bold text-error uppercase tracking-wider"><span class="material-symbols-outlined text-lg">crisis_alert</span>Protocol Guidance</span>${chip('Emergency', 'bg-surface-container text-outline')}</div>
      <div><h3 class="font-headline-sm text-headline-sm">What to do when something feels off</h3><p class="font-body-sm text-body-sm text-on-surface-variant mt-1">When encountering potentially weaponized synthetic media or harassment, follow the student protection checklist:</p></div>
      <div class="flex flex-col gap-space-sm">${steps.map((s, i) => `<div class="flex items-start gap-space-sm p-space-sm bg-surface-container-lowest"><span class="flex items-center justify-center w-6 h-6 ${s[0]} font-label-sm text-label-sm font-bold shrink-0">${i + 1}</span><div><span class="font-label-md text-label-md font-semibold">${s[1].replace('&', '&amp;')}</span><p class="font-body-sm text-body-sm text-outline mt-0.5">${s[2]}</p></div></div>`).join('')}</div>
      <a href="#/safety-centre" class="h-10 w-full bg-secondary-container hover:bg-primary hover:text-on-primary text-on-secondary-container font-label-md text-label-md font-bold uppercase tracking-wider flex items-center justify-center gap-space-xs transition-colors"><span class="material-symbols-outlined text-base">support_agent</span>Open Student Safety Centre</a></div>`;
  }

  V['new-verification'] = () => page(`${head('New verification', 'Choose the type of media you want to check.')}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">${Object.entries(MODES).map(([k, m]) => `<a href="#/${k}-analysis" class="bg-surface-container-low hover:bg-surface-container p-space-lg flex flex-col gap-space-md transition-colors"><span class="w-12 h-12 bg-secondary-container text-on-secondary-container flex items-center justify-center"><span class="material-symbols-outlined text-2xl">${m.big}</span></span><h2 class="font-headline-sm text-headline-sm">${m.title.replace('&', '&amp;')}</h2><p class="text-on-surface-variant font-body-sm text-body-sm">${m.desc}</p><span class="text-primary font-label-md text-label-md uppercase font-bold">${m.verb} →</span></a>`).join('')}</div>`);

  const verifyView = k => () => {
    const m = MODES[k];
    return page(`${head(m.title.replace('&', '&amp;'), m.short)}
      <div class="grid grid-cols-1 gap-space-md max-w-3xl">
        <div class="flex flex-col gap-space-md">
          <label id="dz" for="file" class="min-h-[240px] border border-dashed border-outline-variant bg-surface-container-low hover:border-primary-container transition-colors flex flex-col items-center justify-center gap-space-sm text-center p-space-lg cursor-pointer">
            <span class="material-symbols-outlined text-5xl text-primary">upload_file</span>
            <span class="font-label-md text-label-md uppercase font-bold tracking-wider">Drop a file or click to browse</span>
            <span class="text-outline font-body-sm text-body-sm">${m.limit}</span>
            <input id="file" type="file" accept="${m.accept}" class="sr-only"/></label>
          <div id="status" class="text-error font-body-sm text-body-sm" role="alert"></div>
          <div id="result"></div></div>
        <p class="text-outline font-body-sm text-body-sm">Demo only: scores are illustrative, and files stay in your browser.</p></div></div>`);
  };

  function hookVerify(k) {
    const m = MODES[k], dz = $('#dz'), input = $('#file'), status = $('#status'), out = $('#result');
    const run = file => {
      status.textContent = ''; out.innerHTML = '';
      const okType = m.accept.split(',').some(a => a.startsWith('.') ? file.name.toLowerCase().endsWith(a) : file.type === a);
      if (!okType) return status.textContent = `Unsupported file type. Accepted: ${m.limit.split('•')[0].trim()}.`;
      if (file.size > m.max) return status.textContent = `File is too large for ${m.title}.`;
      if (used() >= QUOTA) return status.textContent = 'Monthly allowance reached.';
      out.innerHTML = `<div class="bg-surface-container-low p-space-md flex flex-col gap-space-sm"><span class="font-label-md text-label-md uppercase tracking-wider">Analysing ${esc(file.name)}…</span><div id="prog">${meter(0)}</div></div>`;
      let p = 0;
      const t = setInterval(() => {
        p += 5; $('#prog').innerHTML = meter(p).replace(/background:#[0-9a-f]+/g, 'background:#a078ff');
        if (p >= 100) { clearInterval(t); finish(file); }
      }, 90);
    };
    const finish = async file => {
      let h = 0; for (const c of file.name + file.size) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const score = h % 100, s = m.signals, sig = score >= 66 ? s.high : score >= 33 ? s.mid : s.low;
      let sha = '';
      try { const b = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); sha = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); } catch {}
      const rec = { id: 'r' + Date.now(), name: file.name, mode: k, size: fmtSize(file.size), when: when(Date.now()), score, signals: sig, sha, saved: false };
      store.set('runs', [rec, ...getRuns()]);
      renderSidebar(); markActive(k + '-analysis');
      out.innerHTML = reportCard(rec) + `<div class="mt-space-sm">${btn('#/report/' + rec.id, 'Open full report', 'description', true)}</div>`;
    };
    input.addEventListener('change', () => input.files[0] && run(input.files[0]));
    ['dragenter', 'dragover'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.add('dz-active'); }));
    ['dragleave', 'drop'].forEach(e => dz.addEventListener(e, ev => { ev.preventDefault(); dz.classList.remove('dz-active'); }));
    dz.addEventListener('drop', ev => ev.dataTransfer.files[0] && run(ev.dataTransfer.files[0]));
  }

  function reportCard(r) {
    const c = cat(r.score), m = MODES[r.mode];
    return `<div class="bg-surface-container-low p-space-md flex flex-col gap-space-md" style="border:1px solid ${c.col}55">
      <div class="flex flex-wrap items-center justify-between gap-space-sm"><div class="flex items-center gap-space-sm"><span class="material-symbols-outlined text-secondary">${m.icon}</span><span class="font-label-md text-label-md font-semibold break-all">${esc(r.name)}</span></div>${badge(r.score)}</div>
      <div><div class="flex justify-between font-label-sm text-label-sm text-outline uppercase mb-1"><span>Synthetic likelihood</span><span>${r.score}%</span></div>${meter(r.score)}</div>
      <div class="grid sm:grid-cols-2 gap-space-sm font-body-sm text-body-sm">
        <div class="bg-surface-container-lowest p-space-sm"><span class="text-outline font-label-sm text-label-sm uppercase block">Observed signals</span>${esc(r.signals)}</div>
        <div class="bg-surface-container-lowest p-space-sm"><span class="text-outline font-label-sm text-label-sm uppercase block">What this means</span>${r.score >= 66 ? 'Strong indicators of manipulation. Do not share; follow the Safety Centre guide.' : r.score >= 33 ? 'Inconclusive. Seek the original source before sharing.' : 'No anomaly found — this does not prove authenticity.'}</div></div></div>`;
  }

  V['photo-analysis'] = verifyView('photo');
  V['audio-analysis'] = verifyView('audio');
  V['video-analysis'] = verifyView('video');

  V['verification-history'] = (q = '') => {
    const ql = q.toLowerCase();
    const list = getAll().filter(r => !ql || (r.name + r.signals + cat(r.score).label + (r.sha || '')).toLowerCase().includes(ql));
    return page(`${head('History', 'Your past checks.')}${table(list, 'All checks',
      getRuns().length ? '<button id="clear" class="text-error hover:underline">Clear my runs</button>' : '')}`);
  };

  V['saved-reports'] = () => {
    const list = getAll().filter(r => r.saved);
    return page(`${head('Saved reports', 'Reports you bookmarked from the history view.')}${list.length ? `<div class="grid gap-space-md lg:grid-cols-2">${list.map(reportCard).join('')}</div>` : `<div class="bg-surface-container-low p-space-lg text-on-surface-variant">Nothing saved yet. Open a report and choose “Save report”.</div>`}`);
  };

  V['report'] = id => {
    const r = getAll().find(x => x.id === id);
    if (!r) return page(`${head('Report not found', 'It may have been cleared.')}${btn('#/verification-history', 'Back to history', 'history')}`);
    const saved = r.saved || store.get('savedSamples', []).includes(r.id);
    return page(`${head('Assessment report', 'Review the evidence and uncertainty before acting.')}<div class="max-w-3xl">${reportCard(r)}</div>
      <div class="flex gap-space-sm flex-wrap"><button id="save" data-id="${r.id}" class="h-10 px-space-md bg-primary text-on-primary font-label-md text-label-md font-bold uppercase tracking-wider">${saved ? 'Unsave report' : 'Save report'}</button>${btn('#/verification-history', 'Back to history', 'history')}</div>`);
  };

  const faq = items => `<div class="flex flex-col gap-1 max-w-3xl">${items.map(([q, a]) => `<details class="bg-surface-container-low"><summary class="p-space-md flex justify-between gap-space-md font-label-md text-label-md font-semibold">${q}<span class="material-symbols-outlined chev text-outline">expand_more</span></summary><p class="px-space-md pb-space-md text-on-surface-variant">${a}</p></details>`).join('')}</div>`;

  V['safety-centre'] = () => page(`${head('Student Safety Centre', 'Calm, practical steps if synthetic media targets you or someone you know.', 'ACTION GUIDE')}
    <div class="grid lg:grid-cols-2 gap-space-md items-start">${protocolCard()}<div class="flex flex-col gap-space-md">
      ${[['Document', 'Screenshot the whole screen with timestamps and usernames, and keep the original files.'], ['Report', 'Use the platform’s report tools for impersonation or non-consensual imagery.'], ['Support', 'Talk with a trusted friend, counsellor or student rights office. You are not at fault.'], ['Escalate', 'If you feel unsafe or the content is sexual or threatening, contact campus security or local authorities.']].map(([t, d]) => `<div class="bg-surface-container-low p-space-md"><span class="font-label-md text-label-md text-primary font-bold uppercase">${t}</span><p class="text-on-surface-variant mt-1">${d}</p></div>`).join('')}</div></div>`);

  V['digital-literacy-faq'] = () => page(`${head('Digital literacy & FAQ', 'How synthetic media works and how to reason about it.', 'KNOWLEDGE')}${faq([
    ['Can a tool prove media is fake?', 'No. Tools produce probabilities. Treat a result as one signal alongside source checks and context.'],
    ['What does “No Anomaly” mean?', 'Only that no signal crossed a threshold. Skilled edits and new generators can evade detection.'],
    ['What is EXIF metadata?', 'Camera and edit details stored in a photo. Missing EXIF is common after social uploads and is not suspicious alone.'],
    ['How do I check a source?', 'Look for the original upload, reverse-image search, and see whether reputable outlets or people involved confirm it.'],
    ['Is my file uploaded?', 'In this demo build, no. Files are read in your browser and only metadata is kept locally.']])}`);

  V['institutional-portal'] = () => page(`${head('Institutional portal', 'For educators and academic integrity officers.', 'INSTITUTIONAL')}
    <div class="grid md:grid-cols-3 gap-space-md">${[['groups', 'Cohort dashboards', 'Aggregate, anonymised trends across a class or department.'], ['gavel', 'Integrity workflows', 'Evidence packets with hashes and uncertainty statements for review boards.'], ['school', 'Curriculum kit', 'Lesson plans on synthetic media literacy.']].map(([i, t, d]) => `<div class="bg-surface-container-low p-space-lg flex flex-col gap-space-sm"><span class="material-symbols-outlined text-primary text-3xl">${i}</span><h2 class="font-headline-sm text-headline-sm">${t}</h2><p class="text-on-surface-variant">${d}</p></div>`).join('')}</div>
    <p class="text-outline">Institutional features are not available in this demo.</p>`);

  V['settings-privacy'] = () => {
    const s = settings();
    const row = (k, t, d) => `<label class="flex items-center justify-between gap-space-md p-space-md bg-surface-container-low cursor-pointer"><span><span class="font-label-md text-label-md font-semibold block">${t}</span><span class="text-outline font-body-sm text-body-sm">${d}</span></span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''} class="w-5 h-5 accent-[#a078ff]"/></label>`;
    return page(`${head('Settings & privacy', 'Preferences are stored only in this browser.', 'SETTINGS')}<div class="flex flex-col gap-1 max-w-3xl">
      ${row('autopurge', 'Auto-purge history after 48h', 'Remove local reports automatically.')}${row('notify', 'Result notifications', 'Show a notice when an analysis finishes.')}${row('share', 'Share anonymised telemetry', 'Off by default.')}</div>
      <button id="wipe" class="self-start h-10 px-space-md border border-error text-error hover:bg-error/10 font-label-md text-label-md uppercase font-bold tracking-wider">Delete all local data</button>`);
  };

  V['help-support'] = () => page(`${head('Help & support', 'Quick answers and ways to reach us.', 'SUPPORT')}${faq([
    ['My file will not analyse', 'Check the type and size limit shown on the upload page, then try again.'],
    ['Why did my allowance change?', 'Each completed verification uses one credit. Allowance renews each cycle.'],
    ['How do I delete my data?', 'Open Settings & Privacy and choose “Delete all local data”.']])}
    <div class="bg-surface-container-low p-space-md max-w-3xl">Still stuck? Email <span class="text-primary">support@xpose.it</span> <span class="text-outline">(placeholder address)</span>.</div>`);

  /* ---------- router ---------- */
  const TITLES = { overview: 'Overview', 'new-verification': 'New Verification', 'photo-analysis': 'Photo Analysis', 'audio-analysis': 'Audio Analysis', 'video-analysis': 'Video Analysis', 'verification-history': 'History', 'saved-reports': 'Saved Reports', 'safety-centre': 'Safety Centre', 'digital-literacy-faq': 'Digital Literacy & FAQ', 'institutional-portal': 'Institutional Portal', 'settings-privacy': 'Settings & Privacy', 'help-support': 'Help & Support', report: 'Report' };

  function purge() {
    if (!settings().autopurge) return;
    store.set('runs', getRuns().filter(r => Date.now() - Number(r.id.slice(1)) < 48 * 3600e3));
  }

  function route() {
    const [, name = 'overview', arg] = location.hash.split('/');
    const key = V[name] ? name : 'overview';
    const q = $('#search').value.trim();
    view.innerHTML = V[key](key === 'report' ? arg : key === 'verification-history' ? q : undefined);
    $('#crumb').textContent = TITLES[key];
    document.title = `${TITLES[key]} — xpose.it`;
    markActive(key); renderSidebar(); markActive(key);
    closeMenu(); window.scrollTo(0, 0);
    if (/-analysis$/.test(key) && MODES[key.split('-')[0]]) hookVerify(key.split('-')[0]);
    bind(key, arg);
  }

  function bind(key, arg) {
    $('#clear')?.addEventListener('click', () => { store.set('runs', []); route(); });
    $('#wipe')?.addEventListener('click', () => { if (confirm('Delete all local xpose.it data?')) { ['runs', 'settings', 'savedSamples'].forEach(k => { try { localStorage.removeItem('xpose.' + k); } catch {} }); route(); } });
    $$('[data-set]').forEach(c => c.addEventListener('change', () => store.set('settings', { ...settings(), [c.dataset.set]: c.checked })));
    $('#save')?.addEventListener('click', e => {
      const id = e.target.dataset.id, runs = getRuns();
      if (runs.some(r => r.id === id)) store.set('runs', runs.map(r => r.id === id ? { ...r, saved: !r.saved } : r));
      else { const s = store.get('savedSamples', []); store.set('savedSamples', s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
      route();
    });
  }

  // sample records honour the saved flag
  SAMPLES.forEach(r => Object.defineProperty(r, 'saved', { get: () => store.get('savedSamples', []).includes(r.id) }));

  function closeMenu() { $('#sidebar').classList.remove('open'); $('#scrim').classList.add('hidden'); }
  $('#menuBtn').addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#scrim').classList.remove('hidden'); });
  $('#scrim').addEventListener('click', closeMenu);
  $('#search').addEventListener('input', () => { if (!location.hash.startsWith('#/verification-history')) location.hash = '#/verification-history'; else route(); });
  $('#search').addEventListener('keydown', e => { if (e.key === 'Enter') location.hash = '#/verification-history'; });
  window.addEventListener('hashchange', route);

  purge();
  route();
})();
