(function(){
  const API_URL = (window.DP_SHIP && DP_SHIP.apiUrl) || '';

  function onReady(fn){
    if(document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function debounce(fn, ms){
    let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn.apply(this,args), ms); };
  }

  function parseAmount(text){
    if(!text) return 0; return Number((text+'').replace(/[^0-9.]/g,'')||0);
  }

  function getSubtotal(){
    const el = document.querySelector('.cart_totals .cart-subtotal .amount, .cart_totals .order-total .amount');
    return parseAmount(el?.textContent||'0');
  }

  function ensureUI(){
    if(document.getElementById('dp-cart-ship')) return;
    const totals = document.querySelector('.cart_totals, .woocommerce-checkout-review-order');
    if(!totals) return;
    const block = document.createElement('div');
    block.id='dp-cart-ship';
    block.style.margin='16px 0';
    block.innerHTML = '\n      <label style="display:block;margin-bottom:6px;font-weight:600;">Enter PIN Code</label>\n      <input id="dp-cart-pincode" type="text" inputmode="numeric" maxlength="6" style="padding:8px;width:180px;border:1px solid #ddd;border-radius:4px;">\n      <span id="dp-cart-msg" style="margin-left:10px;color:#666;"></span>\n    ';
    totals.prepend(block);
    const defaultShip = document.querySelector('.woocommerce-shipping-totals, .shipping');
    if(defaultShip) defaultShip.style.display='none';
  }

  function upsertShippingRow(label, amount){
    const table = document.querySelector('.cart_totals .shop_table, .woocommerce-checkout-review-order-table');
    if(!table) return;
    let row = document.getElementById('dp-shipping-row');
    if(!row){
      row = document.createElement('tr');
      row.id='dp-shipping-row';
      row.innerHTML = '\n        <th>Shipping</th>\n        <td data-title="Shipping"><span class="amount"></span><div class="dp-ship-note" style="font-size:12px;color:#666;margin-top:4px;"></div></td>\n      ';
      const before = table.querySelector('.order-total') || table.querySelector('tr:last-child');
      (before?.parentNode||table.tBodies?.[0]||table).insertBefore(row, before);
    }
    row.querySelector('.amount').textContent = `₹${Number(amount||0).toFixed(2)}`;
    row.querySelector('.dp-ship-note').textContent = label||'';
  }

  function updateOrderTotal(shipping){
    const table = document.querySelector('.cart_totals .shop_table, .woocommerce-checkout-review-order-table');
    const totalCell = table?.querySelector('.order-total .amount');
    if(!table || !totalCell) return;
    const subtotalEl = table.querySelector('.cart-subtotal .amount') || totalCell;
    const subtotal = parseAmount(subtotalEl.textContent);
    totalCell.textContent = `₹${Math.max(0, subtotal + Number(shipping||0)).toFixed(2)}`;
  }

  async function calculate(pincode){
    const msg = document.getElementById('dp-cart-msg');
    if(msg) msg.textContent='Calculating...';
    try{
      const payload = { postCode: pincode, weight: 500, orderAmount: getSubtotal(), paymentMode: 'prepaid', items: [] };
      const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const json = await res.json();
      if(!json?.success || !json?.data?.shipping_options?.length){
        upsertShippingRow('No courier available for this pincode', 0); updateOrderTotal(0); if(msg) msg.textContent='No shipping options'; return;
      }
      const opt = json.data.shipping_options[0];
      const cost = Number(opt.shipping_cost||0), cod = Number(opt.cod_charge||0), total = cost+cod;
      upsertShippingRow(`${opt.courier_name||'Courier'} ${opt.estimated_delivery?`(${opt.estimated_delivery})`:''}`, total);
      updateOrderTotal(total);
      if(msg) msg.textContent = `Shipping via ${opt.courier_name||'Courier'}: ₹${total.toFixed(2)}`;
    }catch(err){
      console.error('DP cart shipping error:', err);
      upsertShippingRow('Shipping calculation failed', 0); updateOrderTotal(0); if(msg) msg.textContent='Error calculating shipping';
    }
  }

  onReady(()=>{
    if(!(document.body.classList.contains('woocommerce-cart') || document.body.classList.contains('woocommerce-checkout'))) return;
    if(!API_URL){ console.warn('DP_SHIP.apiUrl missing'); return; }
    ensureUI();
    const input = document.getElementById('dp-cart-pincode'); if(!input) return;
    const handler = debounce(()=>{ const p=(input.value||'').trim(); if(p.length===6) calculate(p); }, 500);
    input.addEventListener('input', handler);
    // prefill from any existing postcode in page
    const existing = document.querySelector('#calc_shipping_postcode, input[name="s_postcode"], input[name="postcode"]');
    const preset = (existing?.value||'').trim();
    if(preset.length===6){ input.value=preset; calculate(preset); }
  });
})();









