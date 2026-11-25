(function () {
  'use strict';
  var DC = document;

  // Black 'Add to cart' style for blog cards (double-class beats article CSS)
  if (!DC.getElementById('asyii-addtocart-style')) {
    var st = DC.createElement('style');
    st.id = 'asyii-addtocart-style';
    st.textContent = '.asyii-card .asyii-card__cta.add-to-cart{display:block;width:100%;padding:12px 16px;background:#111;color:#fff;border:0;font:600 13px/1 -apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;letter-spacing:.03em;text-align:center;cursor:pointer;margin-top:.4rem;transition:background .15s}'
      + '.asyii-card .asyii-card__cta.add-to-cart:hover{background:#000}';
    DC.head.appendChild(st);
  }

  function buildUrl(base, campaign, content) {
    var u = new URL(base, location.href);
    u.searchParams.set('utm_source', 'asyii');
    u.searchParams.set('utm_medium', 'onsite');
    u.searchParams.set('utm_campaign', campaign);
    u.searchParams.set('utm_content', content);
    return u.href;
  }

  function money(n, currency) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(n / 100); }
    catch (e) { return (n / 100).toFixed(2) + ' ' + currency; }
  }

  function pushGA4(campaign, content, variantId) {
    if (window.dataLayer) window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: { items: [{ item_id: String(variantId) }] },
      attribution_campaign: campaign,
      attribution_content: content
    });
    try {
      if (window.gtag) window.gtag('event', 'onsite_add_to_cart', {
        attribution_campaign: campaign,
        attribution_content: content,
        item_id: String(variantId)
      });
    } catch (e) {}
  }

  function refreshCartAndOpenDrawer() {
    fetch('/cart.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        try {
          DC.dispatchEvent(new CustomEvent('cart:update', { bubbles: true, detail: {
            resource: cart, sourceId: 'asyii-attribution', data: { source: 'asyii-attribution' }
          } }));
        } catch (e) {}
        var drawer = DC.querySelector('cart-drawer-component');
        if (drawer && typeof drawer.open === 'function') drawer.open();
      })
      .catch(function () {
        var drawer = DC.querySelector('cart-drawer-component');
        if (drawer && typeof drawer.open === 'function') drawer.open();
      });
  }

  function addToCart(variantId, campaign, content) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ id: Number(variantId), quantity: 1, properties: {
        _attribution_campaign: campaign,
        _attribution_content: content
      } })
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        pushGA4(campaign, content, variantId);
        refreshCartAndOpenDrawer();
      })
      .catch(function (err) { console.error('asyii add-to-cart failed', err); });
  }

  // Single delegated listener: covers decision-page buttons AND blog card CTAs.
  DC.addEventListener('click', function (e) {
    var b = e.target.closest('.add-to-cart');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.busy === '1') return;
    b.dataset.busy = '1';
    addToCart(b.dataset.variantId, b.dataset.utmCampaign, b.dataset.utmContent)
      .then(function () { b.dataset.busy = '0'; });
  });

  // ---- blog product cards: UTM + live price + Add to cart ----
  var cards = DC.querySelectorAll('a.asyii-card');
  if (!cards.length) return;
  cards.forEach(function (card) {
    var link = card.getAttribute('href') || '';
    var handle = (link.split('/products/')[1] || '').split(/[?#]/)[0];
    if (!handle) return;
    var campaign = 'blog-' + (location.pathname.split('/blogs/')[1] || 'article').split('/').pop();
    // 1) UTM on whole-card link
    card.setAttribute('href', buildUrl(link, campaign, handle));
    // 2) live price + compare-at + Add to cart (from product JS, current currency)
    fetch('/products/' + encodeURIComponent(handle) + '.js', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var cur = (d.currency) || (window.Shopify && Shopify.currency && Shopify.currency.active) || 'GBP';
        var priceEl = card.querySelector('.asyii-card__price');
        if (priceEl && d.price != null) {
          priceEl.textContent = money(d.price, cur);
          if (d.compare_at_price && d.compare_at_price > d.price) {
            var s = DC.createElement('s');
            s.style.marginRight = '8px';
            s.style.opacity = '.6';
            s.textContent = money(d.compare_at_price, cur);
            priceEl.insertBefore(s, priceEl.firstChild);
          }
        }
        var vid = d.variants && d.variants.length ? d.variants[0].id : null;
        if (!vid) return;
        var cta = card.querySelector('.asyii-card__cta');
        if (!cta) {
          cta = DC.createElement('span');
          cta.className = 'asyii-card__cta';
          var body = card.querySelector('.asyii-card__body') || card;
          body.appendChild(cta);
        }
        cta.setAttribute('data-variant-id', vid);
        cta.setAttribute('data-utm-campaign', campaign);
        cta.setAttribute('data-utm-content', handle);
        cta.classList.add('add-to-cart');
        cta.textContent = 'Add to cart';
      })
      .catch(function () { /* keep static card as fallback */ });
  });
})();
