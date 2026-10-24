'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const gallery = byId('gallery');
  const search = byId('search');
  const category = byId('category');
  const filters = byId('filters');
  const dialog = byId('image-dialog');
  const original = byId('original-image');
  const previous = byId('previous-image');
  const next = byId('next-image');
  let characters = [];
  let visible = [];
  let viewing = [];
  let position = 0;
  let opener = null;

  // Keep every asset inside this static gallery, including on a Pages subpath.
  function localPath(value) {
    if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\')) throw new Error('Invalid asset path');
    const url = new URL(value, document.baseURI);
    const base = new URL('.', document.baseURI);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('Invalid asset path');
    return value;
  }

  function makeCard(character) {
    const figure = document.createElement('figure');
    figure.className = 'image-card';
    figure.dataset.key = character.key;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'image-open';
    button.setAttribute('aria-label', `放大${character.name}的样张`);
    button.dataset.key = character.key;
    const img = document.createElement('img');
    img.src = character.preview;
    img.alt = `${character.name}的生成样张`;
    img.width = character.width || 768;
    img.height = character.height || 1152;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => {
      img.hidden = true;
      const note = document.createElement('span');
      note.className = 'image-failed';
      note.textContent = '缩略图未能加载，点击查看原图';
      button.append(note);
    }, { once: true });
    button.append(img);
    button.addEventListener('click', () => {
      opener = button;
      viewing = [...visible];
      position = viewing.findIndex(item => item.key === character.key);
      showOriginal();
      if (!dialog.open) dialog.showModal();
    });
    const caption = document.createElement('figcaption');
    caption.className = 'image-caption';
    const name = document.createElement('h3');
    name.textContent = character.name;
    const faction = document.createElement('p');
    faction.textContent = character.category || '未分类';
    caption.append(name, faction);
    figure.append(button, caption);
    return figure;
  }

  function render() {
    const term = search.value.trim().toLocaleLowerCase();
    const subject = filters.elements.subject.value;
    visible = characters.filter(character =>
      (!term || character.name.toLocaleLowerCase().includes(term) || character.key.toLocaleLowerCase().includes(term)) &&
      (!category.value || character.category === category.value) &&
      (!subject || character.subject === subject)
    );
    gallery.replaceChildren(...visible.map(makeCard));
    byId('empty-state').hidden = visible.length !== 0;
    byId('result-count').textContent = visible.length === characters.length
      ? `共 ${characters.length} 位角色`
      : `显示 ${visible.length} / ${characters.length} 位角色`;
    byId('reset-filters').hidden = !term && !category.value && !subject;
  }

  function showOriginal() {
    const character = viewing[position];
    if (!character) return;
    byId('dialog-title').textContent = character.name;
    byId('dialog-category').textContent = character.category || '未分类';
    byId('image-position').textContent = `${position + 1} / ${viewing.length}`;
    byId('original-error').hidden = true;
    original.alt = `${character.name}的原始生成样张`;
    original.width = character.width || 768;
    original.height = character.height || 1152;
    // No original PNG is requested until a viewer is opened or explicitly navigated.
    original.src = character.original;
    const download = byId('download-original');
    download.href = character.original;
    download.download = character.original.split('/').pop();
    previous.disabled = position === 0;
    next.disabled = position === viewing.length - 1;
    byId('image-dialog').dataset.key = character.key;
  }

  function move(delta) {
    const target = position + delta;
    if (target < 0 || target >= viewing.length) return;
    position = target;
    showOriginal();
  }

  filters.addEventListener('submit', event => event.preventDefault());
  search.addEventListener('input', render);
  category.addEventListener('change', render);
  filters.querySelectorAll('[name="subject"]').forEach(input => input.addEventListener('change', render));
  byId('reset-filters').addEventListener('click', () => { filters.reset(); render(); search.focus(); });
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  byId('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
  });
  let backdropPointer = false;
  dialog.addEventListener('pointerdown', event => { backdropPointer = event.target === dialog; });
  dialog.addEventListener('click', event => {
    if (backdropPointer && event.target === dialog) dialog.close();
    backdropPointer = false;
  });
  dialog.addEventListener('close', () => {
    original.removeAttribute('src');
    original.alt = '';
    if (opener?.isConnected) opener.focus();
  });
  original.addEventListener('error', () => {
    if (original.hasAttribute('src')) byId('original-error').hidden = false;
  });

  async function init() {
    try {
      const response = await fetch('data.json');
      if (!response.ok) throw new Error('Could not load gallery');
      const data = await response.json();
      if (!Array.isArray(data.characters)) throw new Error('Invalid gallery');
      characters = data.characters.map(character => ({
        ...character,
        key: String(character.key),
        name: String(character.name),
        category: String(character.category || ''),
        original: localPath(character.original),
        preview: localPath(character.preview)
      }));
      const title = data.title || 'NovelAI × 绝区零';
      document.title = title;
      byId('page-title').textContent = title;
      byId('gallery-date').textContent = data.date || '';
      byId('sample-info').textContent = `${data.model || 'NovelAI V5 Full'} / ${data.size || '768 × 1152'} / 每位角色单次样张`;
      byId('download-all').href = localPath(data.zip || 'all-images.zip');
      for (const faction of new Set(characters.map(character => character.category).filter(Boolean))) {
        const option = document.createElement('option');
        option.value = faction;
        option.textContent = faction;
        category.append(option);
      }
      render();
    } catch (error) {
      byId('load-error').hidden = false;
      byId('result-count').textContent = '样张信息加载失败';
      console.error('Gallery data could not be loaded.');
    }
  }
  init();
})();
