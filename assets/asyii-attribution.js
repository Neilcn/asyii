(function () {
  'use strict';
  var DC = document;
  function params(url) {
    try { return new URL(url, location.href).searchParams; } catch (e) { return new URLSearchParams(); }
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
    try { return new Intl.NumberFormat(undefined, {style:'currency', currency:currency}).format(n/100); }
    catch (e) { return (n/100).toFixed(2) + ' ' + currency; }
  }
  function pushGA4(campaign, content, variantId) {
    if (window.dataLayer) window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: { items: [{ item_id: String(variantId) }] },
      attribution_campaign: campaign,
      attribution_content: content
    });
  }
  function addToCart(variantId, campaign, content) {
    return fetch('/cart/add.js', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ id: Number(variantId), quantity: 1, properties: {
        _attribution_campaign: campaign,
        _attribution_content: content
      }})
    }).then(function(r){ return r.json(); }).then(function(){
      pushGA4(campaign, content, variantId);
      // Refresh cart + open the theme cart drawer.
      // NOTE: the custom element tag is 'cart-drawer-component' (not 'cart-drawer'),
      // and the theme refreshes cart items on ThemeEvents.cartUpdate ('cart:update').
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
        }).catch(function () {
          var drawer = DC.querySelector('cart-drawer-component');
          if (drawer && typeof drawer.open === 'function') drawer.open();
        });
      }
    }).catch(function(err){ console.error('asyii add-to-cart failed', err); });
  }

  // ---- decision-page Add to bag buttons (already have data attributes) ----
  DC.addEventListener('click', function (e) {
    var b = e.target.closest('.add-to-bag');
    if (!b) return;
    e.preventDefault();
    addToCart(b.dataset.variantId, b.dataset.utmCampaign, b.dataset.utmContent);
  });

  // ---- blog product cards: UTM + live price + Add to bag ----
  var cards = DC.querySelectorAll('.asyii-card');
  if (!cards.length) return;
  cards.forEach(function (card) {
    var link = card.getAttribute('href') || '';
    var handle = (link.split('/products/')[1] || '').split(/[?#]/)[0];
    if (!handle) return;
    // campaign = blog handle from page path
    var campaign = 'blog-' + (location.pathname.split('/blogs/')[1] || 'article').split('/').pop();
    // 1) UTM on whole-card link
    card.setAttribute('href', buildUrl(link, campaign, handle));
    // 2) live price + compare-at (from product JS, current currency)
    fetch('/products/' + encodeURIComponent(handle) + '.js', {headers:{'Accept':'application/json'}})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d) return;
        var cur = d.currency || (window.Shopify && Shopify.currency && Shopify.currency.active) || 'GBP';
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
        // 3) Add to bag button (card is an <a>, so use a sibling button overlay)
        if (d.variants && d.variants.length) {
          var vid = d.variants[0].id;
          var cta = card.querySelector('.asyii-card__cta');
          if (cta) {
            cta.setAttribute('data-variant-id', vid);
            cta.setAttribute('data-utm-campaign', campaign);
            cta.setAttribute('data-utm-content', handle);
            cta.classList.add('asyii-card__cta--add');
            cta.textContent = 'Add to bag';
            cta.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              addToCart(vid, campaign, handle);
            });
          }
        }
      }).catch(function(){ /* keep static card as fallback */ });
  });
})();
