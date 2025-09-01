// Timeline Story — front-end only (Add/Edit/Delete), localStorage
(() => {
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const entriesWrap = $('.ts-entries');
  const yearsNav    = $('.ts-years');
  const emptyAddBtn = $('#empty-add');

  const TYPE_ICON = {
    role:    '<i class="fa-solid fa-id-badge"></i> Role',
    release: '<i class="fa-solid fa-rocket"></i> Release',
    project: '<i class="fa-solid fa-code-branch"></i> Project',
    award:   '<i class="fa-solid fa-award"></i> Award',
  };

  const STORAGE_KEY = 'ts_custom_entries_v1';

  // ----- utils
  const prettyMonth = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, 1));
    return dt.toLocaleString(undefined, { month: 'short', year: 'numeric' });
  };
  const monthKey = ym => {
    const [y, m] = ym.split('-').map(Number);
    return y * 100 + m;
  };
  const escapeHtml = s => (s || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  const escapeAttr = s => (s || '').replace(/"/g,'&quot;');

  const loadSaved   = () => { try{ const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):[] }catch{ return [] } };
  const saveAll     = (list) => localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  const addSaved    = (obj) => { const l=loadSaved(); l.push(obj); saveAll(l); };
  const updateSaved = (id, patch) => saveAll(loadSaved().map(it => it.id===id ? {...it, ...patch} : it));
  const deleteSaved = (id) => saveAll(loadSaved().filter(it => it.id!==id));
  const findSaved   = (id) => loadSaved().find(it => it.id===id);

  // ----- empty state toggle
  function updateEmptyState(){
    const hasEntries = !!$('.ts-entry', entriesWrap);
    entriesWrap.classList.toggle('is-empty', !hasEntries);
  }

  // ----- dynamic years
  function ensureYearMarker(year) {
    let marker = $(`#y${year}`, entriesWrap);
    if (marker) return marker;

    marker = document.createElement('div');
    marker.id = `y${year}`;
    marker.className = 'ts-marker';
    marker.textContent = String(year);

    // insert by year descending
    const markers = $$('.ts-marker', entriesWrap);
    let inserted = false;
    for (const m of markers) {
      const y = Number(m.id.replace('y',''));
      if (year > y) { entriesWrap.insertBefore(marker, m); inserted = true; break; }
    }
    if (!inserted) entriesWrap.appendChild(marker);

    ensureYearNav(year);
    yearIO && yearIO.observe(marker);
    return marker;
  }
  function ensureYearNav(year) {
    if ($(`.ts-year[href="#y${year}"]`, yearsNav)) return;
    const a = document.createElement('a');
    a.className = 'ts-year';
    a.href = `#y${year}`;
    a.textContent = String(year);

    const links = $$('.ts-year', yearsNav);
    let inserted = false;
    for (const l of links) {
      const y = Number(l.textContent.trim());
      if (year > y) { yearsNav.insertBefore(a, l); inserted = true; break; }
    }
    if (!inserted) yearsNav.appendChild(a);
  }

  // pick left/right if auto
  function decideSide(year, explicit) {
    if (explicit === 'left' || explicit === 'right') return explicit;
    const yearEntries = $$('.ts-entry', entriesWrap).filter(e => Number(e.dataset.year) === year);
    const left  = yearEntries.filter(e => e.classList.contains('side-left')).length;
    const right = yearEntries.filter(e => e.classList.contains('side-right')).length;
    return left <= right ? 'left' : 'right';
  }

  // build entry DOM
  function buildEntryNode({id, type, ym, title, desc, url, urlText, side}) {
    const [year] = ym.split('-');

    const art = document.createElement('article');
    art.className = `ts-entry side-${side} type-${type}`;
    art.dataset.year = year;
    art.dataset.id   = id;

    art.innerHTML = `
      <div class="dot" aria-hidden="true"></div>
      <div class="card tl-card" tabindex="0">
        <div class="entry-actions">
          <button class="icon-btn edit" title="Edit" aria-label="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="icon-btn delete" title="Delete" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
        <header>
          <span class="badge ${type}">${TYPE_ICON[type]}</span>
          <time datetime="${ym}">${prettyMonth(ym)}</time>
        </header>
        <h3>${escapeHtml(title)}</h3>
        ${desc ? `<p>${escapeHtml(desc)}</p>` : ''}
        ${url ? `<a class="cta" href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(urlText || 'Learn more →')}</a>` : ''}
      </div>
    `;
    return art;
  }

  // insert by date (desc)
  function insertEntryNode(node, ym) {
    const year = Number(ym.split('-')[0]);
    const marker = ensureYearMarker(year);

    const newKey = monthKey(ym);
    const siblings = Array.from(entriesWrap.children)
      .filter(el => el.classList && (el.classList.contains('ts-entry') || el.classList.contains('ts-marker')));

    let ref = null;
    for (const el of siblings) {
      if (el.classList.contains('ts-entry')) {
        const key = monthKey(el.querySelector('time')?.getAttribute('datetime') || '0000-00');
        if (newKey >= key) { ref = el; break; }
      }
    }
    if (ref) entriesWrap.insertBefore(node, ref);
    else entriesWrap.appendChild(node);

    // keep marker above the first entry for that year
    const idxNode   = Array.prototype.indexOf.call(entriesWrap.children, node);
    const idxMarker = Array.prototype.indexOf.call(entriesWrap.children, marker);
    if (idxMarker > idxNode) entriesWrap.insertBefore(marker, node);

    attachEntryActions(node);
    observeEntry(node);
    requestAnimationFrame(() => node.classList.add('is-inview'));
  }

  // remove empty year sections
  function tidyYearSections(){
    const markers = $$('.ts-marker', entriesWrap);
    for (const m of markers){
      const year = Number(m.id.replace('y',''));
      const hasEntry = $$('.ts-entry', entriesWrap).some(e => Number(e.dataset.year) === year);
      if (!hasEntry){
        const link = $(`.ts-year[href="#${m.id}"]`, yearsNav);
        link && link.remove();
        m.remove();
      }
    }
  }

  // ----- filters
  const filterBtns = $$('.ts-filters button');
  function applyFilter(kind){
    $$('.ts-entry').forEach(el => {
      el.classList.toggle('is-hidden', kind !== 'all' && !el.classList.contains('type-' + kind));
    });
  }
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      applyFilter(btn.dataset.filter);
    });
  });

  // ----- reveal & year spy
  let revealIO = null, yearIO = null;

  function observeEntry(el){
    if (!revealIO) return el.classList.add('is-inview');
    revealIO.observe(el);
  }

  if ('IntersectionObserver' in window){
    yearIO = new IntersectionObserver((items) => {
      items.forEach(i => {
        if (i.isIntersecting){
          const id = i.target.id;
          $$('.ts-year', yearsNav).forEach(y => y.classList.toggle('is-active', y.getAttribute('href') === '#' + id));
        }
      });
    }, { rootMargin: "-40% 0% -50% 0%", threshold: 0 });

    revealIO = new IntersectionObserver((items, obs) => {
      items.forEach((i, idx) => {
        if (i.isIntersecting){
          i.target.style.transitionDelay = (idx % 6) * 80 + 'ms';
          i.target.classList.add('is-inview');
          obs.unobserve(i.target);
        }
      });
    }, { threshold: 0.25, rootMargin: "0px 0px -10% 0px" });
  }

  // ----- modal
  const modal       = $('#entry-modal');
  const openBtn     = $('#add-entry-btn');
  const form        = $('#entry-form');
  const submitLabel = $('#submit-label');
  const modalTitle  = $('#entryModalTitle');

  let editingId = null;

  function openModal(mode='add', data=null){
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (mode === 'edit' && data){
      modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Entry';
      submitLabel.textContent = 'Save';
      form.type.value  = data.type;
      form.date.value  = data.ym;
      form.title.value = data.title;
      form.side.value  = data.side || 'auto';
      form.desc.value  = data.desc || '';
      form.url.value   = data.url || '';
      form.urlText.value = data.urlText || '';
      editingId = data.id;
    } else {
      modalTitle.innerHTML = '<i class="fa-solid fa-plus"></i> Add Timeline Entry';
      submitLabel.textContent = 'Add';
      form.reset();
      editingId = null;
    }
    form.title.focus();
  }
  function closeModal(){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  openBtn.addEventListener('click', () => openModal('add'));
  emptyAddBtn?.addEventListener('click', () => openModal('add'));
  modal.addEventListener('click', (e) => { if (e.target.matches('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal(); });

  // ----- attach edit/delete
  function attachEntryActions(node){
    const editBtn = $('.icon-btn.edit', node);
    const delBtn  = $('.icon-btn.delete', node);

    editBtn.addEventListener('click', () => {
      const id = node.dataset.id;
      const saved = findSaved(id);
      if (!saved) return;
      openModal('edit', saved);
    });

    delBtn.addEventListener('click', () => {
      const id = node.dataset.id;
      if (!confirm('Delete this entry?')) return;
      deleteSaved(id);
      node.remove();
      tidyYearSections();
      updateEmptyState();
    });
  }

  // ----- load saved entries
  (function hydrate(){
    const saved = loadSaved().sort((a,b)=> monthKey(b.ym) - monthKey(a.ym));
    if (saved.length){
      saved.forEach(e => {
        const side = decideSide(Number(e.ym.split('-')[0]), e.side || 'auto');
        const node = buildEntryNode({...e, side});
        insertEntryNode(node, e.ym);
      });
      // observe current markers
      $$('.ts-marker', entriesWrap).forEach(m => yearIO && yearIO.observe(m));
    }
    updateEmptyState();
  })();

  // ----- submit (add/edit)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const type = String(fd.get('type'));
    const ym = String(fd.get('date')); // YYYY-MM
    const title = String(fd.get('title')).trim();
    const desc = String(fd.get('desc') || '').trim();
    let   url  = String(fd.get('url')  || '').trim();
    let   urlText = String(fd.get('urlText') || '').trim();
    const sideChoice = String(fd.get('side') || 'auto');

    if (!type || !ym || !title){ alert('Please fill in Type, Date, and Title.'); return; }
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    const year = Number(ym.split('-')[0]);
    const side = decideSide(year, sideChoice);

    if (!editingId){
      // ADD
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
        type, ym, title, desc, url, urlText, side
      };
      addSaved(entry);
      const node = buildEntryNode(entry);
      insertEntryNode(node, ym);

      // Show all after adding
      const allBtn = $$('.ts-filters button').find(b => b.dataset.filter === 'all');
      $$('.ts-filters button').forEach(b => b.classList.remove('is-active'));
      allBtn && allBtn.classList.add('is-active');
      applyFilter('all');
    } else {
      // EDIT
      const patch = { type, ym, title, desc, url, urlText, side };
      updateSaved(editingId, patch);

      // Re-render node in sorted position
      const oldNode = $(`.ts-entry[data-id="${editingId}"]`, entriesWrap);
      oldNode && oldNode.remove();
      const node = buildEntryNode({ id: editingId, ...patch });
      insertEntryNode(node, ym);
    }

    updateEmptyState();
    closeModal();
  });
})();
