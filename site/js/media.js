/* Playback and galleries for property photographs, films and architectural concepts. */
(function () {
  'use strict';
  const I = window.ZareaI18n, t = I.t;
  const hero = document.querySelector('.hero');
  const heroVideo = document.querySelector('.hero__video');
  const heroMedia = document.querySelector('.hero__media');
  const heroButton = document.querySelector('.hero__playback');
  const dialog = document.querySelector('#property-gallery');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let heroVisible = true, userPaused = false, userRequested = false;

  function updateHero() {
    if (!heroVideo) return;
    const automatic = !motion.matches && !navigator.connection?.saveData;
    const shouldPlay = heroVisible && !document.hidden && !dialog?.open &&
      !userPaused && (automatic || userRequested);
    if (!shouldPlay) { heroVideo.pause(); return; }
    if (!heroVideo.getAttribute('src')) heroVideo.src = heroVideo.dataset.src;
    heroVideo.play().catch(() => {
      heroButton.textContent = t('Play film');
      heroButton.setAttribute('aria-label', t('Play the architectural concept film'));
    });
  }

  if (heroVideo && heroButton) {
    heroButton.hidden = false;
    heroVideo.muted = true;
    heroButton.addEventListener('click', () => {
      if (heroVideo.paused) { userPaused = false; userRequested = true; }
      else { userPaused = true; userRequested = false; }
      updateHero();
    });
    heroVideo.addEventListener('playing', () => {
      heroMedia.classList.add('has-video');
      heroButton.textContent = t('Pause film');
      heroButton.setAttribute('aria-label', t('Pause the architectural concept film'));
    });
    heroVideo.addEventListener('pause', () => {
      heroButton.textContent = t('Play film');
      heroButton.setAttribute('aria-label', t('Play the architectural concept film'));
    });
    heroVideo.addEventListener('timeupdate', () => {
      heroMedia.classList.toggle('is-looping', heroVideo.duration - heroVideo.currentTime < 0.5);
    });
    heroVideo.addEventListener('error', () => {
      heroMedia.classList.remove('has-video');
      heroButton.hidden = true;
    });
    motion.addEventListener('change', () => {
      userRequested = false;
      if (motion.matches) heroMedia.classList.remove('has-video');
      updateHero();
    });
    document.addEventListener('visibilitychange', updateHero);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
        updateHero();
      }, { threshold: 0.15 }).observe(hero);
    } else updateHero();
  }

  /* The existing map remains the initial view. The film loads on selection. */
  const location = document.querySelector('#lmap');
  const locationVideo = document.querySelector('.location__film video');
  const locationButtons = [...document.querySelectorAll('[data-location-view]')];
  locationButtons.forEach(button => button.addEventListener('click', () => {
    const film = button.dataset.locationView === 'film';
    locationButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    location.classList.toggle('is-film', film);
    document.querySelector('.location__film').hidden = !film;
    if (film) {
      if (!locationVideo.getAttribute('src')) locationVideo.src = locationVideo.dataset.src;
      locationVideo.play().catch(() => {});
    } else {
      locationVideo.pause();
      window.dispatchEvent(new Event('resize'));
    }
  }));
  if (locationVideo) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) locationVideo.pause();
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) locationVideo.pause();
    }).observe(location);
  }

  const localMedia = value => typeof value === 'string' && /^assets\/(img|video)\/[\w.-]+$/.test(value);
  const validItem = item => /^[\w-]+$/.test(item.id) && /^[\w-]+$/.test(item.group) &&
    ['image', 'video'].includes(item.type) && localMedia(item.src) &&
    localMedia(item.poster) && localMedia(item.thumbnail);
  const description = item => item.caption + (item.date ? ' ' + item.date + '.' : '');
  const pauseOthers = current => document.querySelectorAll('video').forEach(video => {
    if (video !== current) video.pause();
  });

  /* Enlargement is optional. The full gallery can be used directly on the page. */
  const image = dialog.querySelector('.media-viewer__image');
  const video = dialog.querySelector('.media-viewer__video');
  const title = dialog.querySelector('#media-title');
  const caption = dialog.querySelector('#media-caption');
  const counter = dialog.querySelector('.media-viewer__count');
  const thumbnails = dialog.querySelector('.media-viewer__thumbnails');
  const fileLink = dialog.querySelector('.media-viewer__file');
  const status = dialog.querySelector('.media-viewer__status');
  let activeItems = [], active = 0, opener = null;

  function showItem(index) {
    active = (index + activeItems.length) % activeItems.length;
    const item = activeItems[active];
    video.pause();
    video.removeAttribute('src');
    video.load();
    image.hidden = item.type !== 'image';
    video.hidden = item.type !== 'video';
    status.hidden = true;
    title.textContent = item.title;
    caption.textContent = description(item);
    counter.textContent = (active + 1) + ' / ' + activeItems.length;
    fileLink.href = item.src;
    fileLink.textContent = item.type === 'video' ? t('Open film') : t('Open photograph');
    if (item.type === 'video') {
      image.removeAttribute('src');
      video.poster = item.poster;
      video.setAttribute('aria-label', item.title);
      video.src = item.src;
      video.play().catch(() => {});
    } else {
      image.alt = item.title + '. ' + item.caption;
      image.src = item.src;
    }
    [...thumbnails.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === active)));
    const selected = thumbnails.children[active];
    if (selected) thumbnails.scrollLeft = Math.max(0, selected.offsetLeft - thumbnails.clientWidth / 2 + selected.clientWidth / 2);
  }

  function openGallery(collection, index, trigger, kind) {
    activeItems = collection;
    opener = trigger;
    dialog.querySelector('.media-viewer__kind').textContent = kind === 'concept' ? t('Architectural concept') : t('The property today');
    thumbnails.replaceChildren();
    collection.forEach((item, position) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', item.title);
      const thumbnail = document.createElement('img');
      thumbnail.src = item.thumbnail;
      thumbnail.alt = '';
      thumbnail.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = item.title;
      button.append(thumbnail, label);
      button.addEventListener('click', () => showItem(position));
      thumbnails.append(button);
    });
    pauseOthers(null);
    dialog.showModal();
    document.body.classList.add('media-open');
    updateHero();
    showItem(index);
  }

  dialog.querySelector('[data-media-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    document.body.classList.remove('media-open');
    opener?.focus({ preventScroll: true });
    updateHero();
  });
  dialog.addEventListener('keydown', event => {
    if (event.target === video) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); showItem(active - 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showItem(active + 1); }
  });
  dialog.querySelector('[data-media-previous]').addEventListener('click', () => showItem(active - 1));
  dialog.querySelector('[data-media-next]').addEventListener('click', () => showItem(active + 1));
  image.addEventListener('error', () => { if (dialog.open) status.hidden = false; });
  video.addEventListener('error', () => { if (dialog.open && video.getAttribute('src')) status.hidden = false; });

  function initialiseLibrary(panel, items) {
    const kind = panel.dataset.library;
    const tabs = [...panel.querySelectorAll('[data-media-group]')];
    const list = panel.querySelector('.media-library__list');
    const player = panel.querySelector('.media-library__video');
    const picture = panel.querySelector('.media-library__image');
    const play = panel.querySelector('.media-library__play');
    const enlarge = panel.querySelector('.media-library__enlarge');
    const heading = panel.querySelector('.media-library__title');
    const detail = panel.querySelector('.media-library__description');
    let filtered = [], selected = null;

    function choose(item) {
      selected = item;
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.controls = false;
      player.hidden = item.type !== 'video';
      picture.hidden = item.type !== 'image';
      play.hidden = item.type !== 'video';
      play.disabled = false;
      heading.textContent = item.title;
      detail.textContent = description(item);
      if (item.type === 'video') {
        player.poster = item.poster;
        player.setAttribute('aria-label', item.title);
      } else {
        picture.alt = item.title + '. ' + item.caption;
        picture.src = item.src;
      }
      [...list.children].forEach(button => button.setAttribute('aria-pressed', String(button.dataset.item === item.id)));
    }

    function group(key) {
      filtered = items.filter(item => item.group === key);
      tabs.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mediaGroup === key)));
      list.replaceChildren();
      filtered.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.item = item.id;
        button.setAttribute('aria-label', item.title + (item.type === 'video' ? t(', film') : t(', photograph')));
        const thumb = document.createElement('img');
        thumb.src = item.thumbnail;
        thumb.alt = '';
        thumb.loading = 'lazy';
        thumb.width = 112;
        thumb.height = 70;
        const words = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = item.title;
        const type = document.createElement('small');
        type.textContent = item.type === 'video' ? 'Film · ' + Math.round(item.duration) + ' sec' : kind === 'concept' ? t('Architectural concept') : t('Photograph');
        words.append(name, type);
        button.append(thumb, words);
        button.addEventListener('click', () => choose(item));
        list.append(button);
      });
      if (filtered.length) choose(filtered[0]);
    }

    tabs.forEach(button => button.addEventListener('click', () => group(button.dataset.mediaGroup)));
    play.addEventListener('click', () => {
      if (!selected || selected.type !== 'video') return;
      pauseOthers(player);
      player.controls = true;
      if (!player.getAttribute('src')) player.src = selected.src;
      if (player.ended) player.currentTime = 0;
      player.play().catch(() => { play.hidden = false; });
    });
    player.addEventListener('playing', () => { play.hidden = true; });
    player.addEventListener('pause', () => { if (selected?.type === 'video') play.hidden = false; });
    player.addEventListener('error', () => {
      if (player.getAttribute('src')) detail.textContent = t('This film could not be loaded. Choose Enlarge to open the file.');
    });
    enlarge.addEventListener('click', () => {
      const index = filtered.indexOf(selected);
      if (index >= 0) openGallery(filtered, index, enlarge, kind);
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) player.pause();
    }).observe(player);
    group(tabs[0].dataset.mediaGroup);
    panel.dataset.ready = 'true';
  }

  document.querySelectorAll('[data-library]').forEach(panel => {
    const url = panel.dataset.library === 'concept' ? 'data/concept-media.json' : 'data/media.json';
    fetch(url).then(response => {
      if (!response.ok) throw new Error('Media list unavailable');
      return response.json();
    }).then(items => {
      if (!Array.isArray(items) || !items.length || !items.every(validItem)) throw new Error('Invalid media list');
      initialiseLibrary(panel, I.data(items));
    }).catch(error => { panel.querySelector('.media-library__description').textContent = t('The gallery could not be loaded. Please refresh the page.'); console.warn('Gallery:', error.message); });
  });
})();
