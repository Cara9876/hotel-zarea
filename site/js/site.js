/* Property data and page interactions. Load after i18n.js and map.js. */
(function () {
  'use strict';

  const i18n = window.ZareaI18n;
  const translate = i18n.t;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const formatInteger = value => Number(value).toLocaleString(i18n.locale);
  const formatDecimal = (value, digits) => Number(value).toLocaleString(i18n.locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  // Auction times stay in Chișinău time, including for visitors abroad.
  const timeZone = 'Europe/Chisinau';
  const formatDate = value => new Date(value).toLocaleDateString(i18n.locale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone
  });
  const formatTime = value => new Date(value).toLocaleTimeString(i18n.locale, {
    hour: '2-digit', minute: '2-digit', timeZone
  });
  const safeUrl = (url, allowLocal) => (
    typeof url === 'string' && (
      /^https:\/\//.test(url) || (allowLocal && /^assets\/[\w./-]+$/.test(url))
    ) ? url : '#'
  );
  const isEmail = email => typeof email === 'string' && /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email);
  const setField = (name, value) => {
    $$('[data-field="' + name + '"]').forEach(element => { element.textContent = value; });
  };

  function distanceKm(from, to) {
    // Coordinates use GeoJSON order: longitude, latitude.
    const earthRadius = 6371;
    const latitudeDelta = (to[1] - from[1]) * Math.PI / 180;
    const longitudeDelta = (to[0] - from[0]) * Math.PI / 180;
    const arc = Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(from[1] * Math.PI / 180) * Math.cos(to[1] * Math.PI / 180) *
      Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadius * Math.asin(Math.sqrt(arc));
  }

  fetch('data/site.json')
    .then(response => response.json())
    .then(data => render(i18n.data(data)))
    .catch(error => console.error('site.json', error));

  function render(data) {
    const { property, transaction, performance, contact } = data;
    setField('status', transaction.status);
    setField('price', formatInteger(transaction.price));
    setField('currency', transaction.currency);
    setField('deadline-date', formatDate(transaction.deadline));
    setField('deadline-time', formatTime(transaction.deadline));
    setField('auction-date', formatDate(transaction.auction));
    setField('auction-time', formatTime(transaction.auction));
    setField('method', transaction.method);
    setField('deposit', formatInteger(transaction.deposit));
    setField('depositNote', transaction.depositNote);
    setField('feeLegal', formatInteger(transaction.feeLegal));
    setField('feeIndividual', formatInteger(transaction.feeIndividual));
    setField('auctionPlace', transaction.auctionPlace);
    setField('valuation', formatInteger(transaction.valuation));
    setField('valuationDate', formatDate(transaction.valuationDate));
    setField('verifiedAt', formatDate(data.verifiedAt));
    setField('levels', property.levels);
    setField('rooms', property.rooms);
    setField('usedArea', formatDecimal(property.usedArea, 1));
    setField('footprint', formatDecimal(property.footprint, 1));
    setField('land', formatDecimal(property.land, 4));
    setField('ownership', property.ownership);
    setField('idno', property.idno);

    const lastYear = performance.years.length - 1;
    setField('revenue2025', formatDecimal(performance.revenue[lastYear] / 1e6, 2));
    setField('stays2025', formatInteger(performance.stays[lastYear]));
    $$('[data-href="sourceUrl"]').forEach(link => { link.href = safeUrl(data.sourceUrl); });

    const emails = contact.emails.filter(isEmail);
    $$('[data-href="visitMail"]').forEach(link => {
      link.href = 'mailto:' + emails.join(',') + '?subject=' + encodeURIComponent(contact.visitSubject);
    });
    if (new Date(transaction.deadline) <= Date.now()) {
      setField('status', translate('Application period closed'));
    }

    $('[data-list="steps"]').innerHTML = transaction.steps.map(([title, detail]) =>
      '<li><div><b>' + escapeHtml(title) + '</b><span>' + escapeHtml(detail) + '</span></div></li>'
    ).join('');
    $$('[data-list="conditions"]').forEach(element => {
      const tag = element.tagName === 'DIV' ? 'p' : 'li';
      element.innerHTML = transaction.conditions.map(condition =>
        '<' + tag + '>' + escapeHtml(condition) + '</' + tag + '>'
      ).join('');
    });

    const submission = transaction.submission;
    if (submission) {
      setField('submission-where', submission.where);
      setField('submission-form', submission.form);
      setField('deposit-iban', submission.depositAccount.iban);
      setField('deposit-beneficiary', submission.depositAccount.beneficiary +
        translate(' · fiscal code ') + submission.depositAccount.fiscalCode);
      setField('fee-iban', submission.feeAccount.iban);
      setField('fee-beneficiary', submission.feeAccount.beneficiary +
        translate(' · fiscal code ') + submission.feeAccount.fiscalCode);
    }

    renderDocuments(data.documents);
    $('[data-list="distances"]').innerHTML = data.landmarks.map(([name, longitude, latitude]) => {
      const distance = distanceKm([property.lng, property.lat], [longitude, latitude]);
      const label = distance < 0.95
        ? Math.round(distance * 100) * 10 + ' m'
        : formatDecimal(distance, 1) + ' km';
      return '<li><b>' + escapeHtml(name) + '</b><span>' + label + '</span></li>';
    }).join('');
    renderContact(contact, emails);
    renderPerformance(performance);

    const mapElement = $('#lmap');
    if (mapElement && window.ZareaMap) {
      const startMap = () => window.ZareaMap.init(property);
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            observer.disconnect();
            startMap();
          }
        }, { rootMargin: '400px' });
        observer.observe(mapElement);
      } else {
        startMap();
      }
    }
  }

  function renderDocuments(documents) {
    $('[data-list="documents"]').innerHTML = documents.map(([title, detail, url, language, bytes]) => {
      const size = Number(bytes) > 1e6
        ? formatDecimal(bytes / 1048576, 1) + ' MB'
        : Math.round(bytes / 1024) + ' KB';
      return '<li><a href="' + escapeHtml(safeUrl(url, true)) +
        '" target="_blank" rel="noopener noreferrer"><span><b>' + escapeHtml(title) +
        '</b><span>' + escapeHtml(detail) + '</span></span><span class="docs__lang">' +
        escapeHtml(language) + '</span><span class="docs__meta">PDF · ' + size + '</span></a></li>';
    }).join('');
  }

  function renderContact(contact, emails) {
    $('[data-block="contact"]').innerHTML =
      '<p><small>' + escapeHtml(contact.organisation) + '</small>' + escapeHtml(contact.unit) +
      '<small>' + escapeHtml(contact.address) + '</small></p>' +
      '<p><small>' + escapeHtml(translate('Phone')) + '</small>' + contact.phones.map(phone =>
        '<a href="tel:' + escapeHtml(String(phone).replace(/[^+\d]/g, '')) + '">' + escapeHtml(phone) + '</a>'
      ).join('') + '</p>' +
      '<p><small>' + escapeHtml(translate('Email')) + '</small>' + emails.map(email =>
        '<a href="mailto:' + escapeHtml(email) + '">' + escapeHtml(email) + '</a>'
      ).join('') + '</p>';
  }

  function renderPerformance(performance) {
    function renderBars(key, container) {
      const values = performance[key].map(Number);
      const maximum = Math.max(...values);
      container.textContent = '';
      values.forEach((value, index) => {
        const bar = document.createElement('i');
        bar.dataset.year = String(performance.years[index]);
        // Set the CSS property directly; an inline style attribute in HTML is blocked by CSP.
        bar.style.height = Math.max(4, Math.round(value / maximum * 100)) + '%';
        container.appendChild(bar);
      });
    }
    renderBars('revenue', $('[data-bars="revenue"]'));
    renderBars('stays', $('[data-bars="stays"]'));

    const row = (label, values, format) => '<tr><td>' + escapeHtml(translate(label)) + '</td>' +
      values.map(value => '<td>' + escapeHtml(format(value)) + '</td>').join('') + '</tr>';
    $('[data-table="performance"]').innerHTML = '<thead><tr><th></th>' +
      performance.years.map(year => '<th>' + escapeHtml(year) + '</th>').join('') + '</tr></thead><tbody>' +
      row('Sales revenue', performance.revenue, formatInteger) +
      row('Net result', performance.netProfit, value => (value < 0 ? '−' : '') + formatInteger(Math.abs(value))) +
      row('Overnight stays', performance.stays, formatInteger) +
      row('Employees', performance.employees, String) + '</tbody>';
  }

  const comparison = $('#compare');
  if (comparison) {
    const frame = $('.compare__frame', comparison);
    const range = $('.compare__range', comparison);
    const setSplit = value => {
      value = Math.min(100, Math.max(0, value));
      frame.style.setProperty('--split', value + '%');
      range.value = value;
      range.setAttribute('aria-valuetext', translate('{percent}% concept', { percent: Math.round(value) }));
    };
    range.addEventListener('input', () => setSplit(Number(range.value)));

    let dragging = false;
    const moveSplit = event => {
      const bounds = frame.getBoundingClientRect();
      setSplit((event.clientX - bounds.left) / bounds.width * 100);
    };
    frame.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      dragging = true;
      frame.setPointerCapture(event.pointerId);
      moveSplit(event);
    });
    frame.addEventListener('pointermove', event => {
      if (dragging) moveSplit(event);
    });
    const stopDragging = () => { dragging = false; };
    frame.addEventListener('pointerup', stopDragging);
    frame.addEventListener('pointercancel', stopDragging);
    setSplit(50);

    const markTouched = () => comparison.classList.add('is-touched');
    frame.addEventListener('pointerdown', markTouched, { once: true });
    range.addEventListener('input', markTouched, { once: true });
    const pairButtons = $$('.pairs button', comparison.parentElement);
    pairButtons.forEach(button => button.addEventListener('click', () => {
      const pair = button.dataset.pair;
      frame.classList.toggle('is-wide', button.dataset.format === 'wide');
      pairButtons.forEach(item => item.setAttribute('aria-pressed', item === button));
      $$('[data-pair-now]', comparison).forEach(image => { image.hidden = image.dataset.pairNow !== pair; });
      $$('[data-pair-after]', comparison).forEach(image => { image.hidden = image.dataset.pairAfter !== pair; });
      setSplit(50);
    }));

    // Demonstrate the slider once, unless the visitor has requested reduced motion.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        const startedAt = performance.now();
        const easeOut = value => 1 - Math.pow(1 - value, 3);
        const animateSplit = now => {
          if (dragging) return;
          const progress = Math.min(1, (now - startedAt) / 1400);
          setSplit(100 - 50 * easeOut(progress));
          if (progress < 1) requestAnimationFrame(animateSplit);
        };
        setSplit(100);
        requestAnimationFrame(animateSplit);
      }, { threshold: 0.5 });
      observer.observe(frame);
    }
  }

  const progressBar = $('.progress span');
  const header = $('.top');
  const updateScrollState = () => {
    const scrollableHeight = document.documentElement.scrollHeight - innerHeight;
    if (progressBar) {
      progressBar.style.transform = 'scaleX(' +
        (scrollableHeight > 0 ? Math.min(1, scrollY / scrollableHeight) : 0) + ')';
    }
    if (header) header.classList.toggle('is-solid', scrollY > 40);
  };
  addEventListener('scroll', updateScrollState, { passive: true });
  addEventListener('resize', updateScrollState);
  updateScrollState();

  const menuToggle = $('.nav-toggle');
  const mobileNav = $('#mobile-nav');
  if (menuToggle && mobileNav) {
    const setMenuOpen = open => {
      menuToggle.setAttribute('aria-expanded', open);
      menuToggle.setAttribute('aria-label', translate(open ? 'Close menu' : 'Open menu'));
      mobileNav.hidden = !open;
    };
    menuToggle.addEventListener('click', () => setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true'));
    $$('a', mobileNav).forEach(link => link.addEventListener('click', () => setMenuOpen(false)));
  }

  const navLinks = $$('.nav a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    navLinks.forEach(link => {
      const section = $(link.getAttribute('href'));
      if (section) observer.observe(section);
    });
  }
})();
