/* Reservas ÁMBAR — 5 mesas x 4 personas, bloqueo por fecha + hora + mesa.
   Con AMBAR_DB.url y .key (Supabase) las reservas son compartidas entre todos los visitantes.
   Sin configurar, funciona en modo demostración (localStorage, solo este navegador). */
window.AMBAR_DB = window.AMBAR_DB || { url: '', key: '' };

(() => {
  const MESAS = 5, MAX_PAX = 4, DIAS = 14, REFRESH_MS = 8000, TZ = 'America/Lima';
  const $ = id => document.getElementById(id);
  const DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // ---------- Fechas en hora de Lima ----------
  const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const horaLima = () => +new Date().toLocaleString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }) % 24;
  const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
  // Lun–Vie 08:00–19:00 · Sáb–Dom 09:00–20:00 (última reserva una hora antes del cierre)
  const horarios = iso => {
    const finde = [0, 6].includes(diaSemana(iso));
    const [a, b] = finde ? [9, 20] : [8, 19];
    return Array.from({ length: b - a + 1 }, (_, i) => String(a + i).padStart(2, '0') + ':00');
  };
  const fechaLarga = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${DIA[d.getUTCDay()]} ${d.getUTCDate()} ${MES[d.getUTCMonth()]}`; };

  // ---------- Capa de datos ----------
  const cfg = window.AMBAR_DB;
  const remoto = !!(cfg.url && cfg.key);
  const LS = 'ambar_reservas_v1';

  const api = async (fn, body) => {
    const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (cfg.key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + cfg.key; // llaves anon antiguas (JWT)
    const r = await fetch(`${cfg.url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await r.json().catch(() => null);
    if (!r.ok) throw new Error((data && (data.message || data.hint)) || 'error_red');
    return data;
  };
  const local = {
    all: () => { try { return JSON.parse(localStorage.getItem(LS)) || []; } catch { return []; } },
    save: list => { try { localStorage.setItem(LS, JSON.stringify(list)); } catch {} }
  };

  const DB = {
    async ocupacion(desde, hasta) {
      if (remoto) return (await api('ocupacion', { p_desde: desde, p_hasta: hasta })).map(r => ({ fecha: r.fecha, hora: r.hora.slice(0, 5), mesa: r.mesa }));
      return local.all().filter(r => r.fecha >= desde && r.fecha <= hasta);
    },
    async reservar(r) {
      if (remoto) return api('reservar', { p_fecha: r.fecha, p_hora: r.hora, p_mesa: r.mesa, p_personas: r.personas, p_nombre: r.nombre, p_telefono: r.telefono, p_email: r.email || null });
      const list = local.all();
      if (list.some(x => x.fecha === r.fecha && x.hora === r.hora && x.mesa === r.mesa)) throw new Error('mesa_ocupada');
      const id = list.length + 1;
      list.push({ id, fecha: r.fecha, hora: r.hora, mesa: r.mesa });
      local.save(list);
      return id;
    }
  };

  // ---------- Estado ----------
  const hoy = hoyLima();
  const dias = Array.from({ length: DIAS }, (_, i) => sumarDias(hoy, i));
  const sel = { fecha: null, hora: null, mesa: null, personas: 2 };
  let ocupadas = new Map(); // "fecha hora" -> Set(mesa)
  let enviando = false;

  const ocupadasEn = (f, h) => ocupadas.get(`${f} ${h}`) || new Set();
  const pasado = (f, h) => f === hoy && +h.slice(0, 2) <= horaLima();
  const libresEn = (f, h) => pasado(f, h) ? 0 : MESAS - ocupadasEn(f, h).size;
  const libresDia = f => horarios(f).reduce((s, h) => s + libresEn(f, h), 0);

  // ---------- Render ----------
  function pintarDias() {
    $('bkDays').innerHTML = dias.map(f => {
      const lleno = libresDia(f) === 0;
      const [d, n, m] = fechaLarga(f).split(' ');
      return `<button type="button" class="day${f === sel.fecha ? ' is-sel' : ''}" data-f="${f}" ${lleno ? 'disabled' : ''}>
        <small>${f === hoy ? 'Hoy' : d}</small><b>${n}</b><small>${lleno ? 'Completo' : m}</small></button>`;
    }).join('');
  }
  function pintarHoras() {
    if (!sel.fecha) { $('bkSlots').innerHTML = '<p class="bk-hint">Primero elige una fecha.</p>'; return; }
    $('bkSlots').innerHTML = horarios(sel.fecha).map(h => {
      const libres = libresEn(sel.fecha, h), past = pasado(sel.fecha, h);
      const txt = past ? 'Pasado' : libres === 0 ? 'Completo' : `${libres} ${libres === 1 ? 'mesa' : 'mesas'}`;
      return `<button type="button" class="slot${h === sel.hora ? ' is-sel' : ''}${libres === 1 ? ' is-last' : ''}" data-h="${h}" ${libres === 0 ? 'disabled' : ''}>
        <b>${h}</b><small>${txt}</small></button>`;
    }).join('');
  }
  function pintarMesas() {
    const busy = sel.fecha && sel.hora ? ocupadasEn(sel.fecha, sel.hora) : new Set();
    const activo = !!(sel.fecha && sel.hora);
    $('bkFloor').innerHTML = Array.from({ length: MESAS }, (_, i) => {
      const n = i + 1, ocupada = busy.has(n), mia = sel.mesa === n;
      const sillas = Array.from({ length: MAX_PAX }, (_, s) => `<i class="seat s${s}${mia && s < sel.personas ? ' on' : ''}"></i>`).join('');
      return `<button type="button" class="table t${n}${ocupada ? ' is-busy' : ''}${mia ? ' is-sel' : ''}" data-m="${n}" ${!activo || ocupada ? 'disabled' : ''}
        aria-label="Mesa ${n}${ocupada ? ', reservada' : ''}">${sillas}<span>${n}</span></button>`;
    }).join('');
    $('bkFloor').classList.toggle('is-off', !activo);
  }
  function pintarResumen() {
    const ok = sel.fecha && sel.hora && sel.mesa;
    $('bkSum').innerHTML = ok
      ? `<b>${fechaLarga(sel.fecha)}</b> · ${sel.hora} · Mesa ${sel.mesa} · ${sel.personas} ${sel.personas === 1 ? 'persona' : 'personas'}`
      : 'Selecciona fecha, hora y mesa.';
    $('bkSubmit').disabled = !ok || enviando;
    $('bkPax').textContent = sel.personas;
    $('bkMinus').disabled = sel.personas <= 1;
    $('bkPlus').disabled = sel.personas >= MAX_PAX;
  }
  function pintar() {
    // Si lo seleccionado dejó de estar disponible (otra persona lo tomó), se libera
    if (sel.fecha && sel.hora && (libresEn(sel.fecha, sel.hora) === 0)) { sel.hora = null; sel.mesa = null; }
    if (sel.mesa && ocupadasEn(sel.fecha, sel.hora).has(sel.mesa)) {
      sel.mesa = null; error('Esa mesa acaba de ser reservada por otra persona. Elige otra.');
    }
    pintarDias(); pintarHoras(); pintarMesas(); pintarResumen();
  }
  const error = msg => { $('bkErr').textContent = msg || ''; };

  async function cargar() {
    try {
      const rows = await DB.ocupacion(dias[0], dias[dias.length - 1]);
      const m = new Map();
      rows.forEach(r => { const k = `${r.fecha} ${r.hora}`; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(+r.mesa); });
      ocupadas = m;
      pintar();
    } catch (e) {
      error('No pudimos actualizar la disponibilidad. Reintentando…');
    }
  }

  // ---------- Eventos ----------
  $('bkDays').addEventListener('click', e => {
    const b = e.target.closest('.day'); if (!b || b.disabled) return;
    sel.fecha = b.dataset.f; sel.hora = null; sel.mesa = null; error(); pintar();
  });
  $('bkSlots').addEventListener('click', e => {
    const b = e.target.closest('.slot'); if (!b || b.disabled) return;
    sel.hora = b.dataset.h; sel.mesa = null; error(); pintar();
  });
  $('bkFloor').addEventListener('click', e => {
    const b = e.target.closest('.table'); if (!b || b.disabled) return;
    sel.mesa = +b.dataset.m; error(); pintar();
  });
  $('bkMinus').addEventListener('click', () => { sel.personas = Math.max(1, sel.personas - 1); pintarMesas(); pintarResumen(); });
  $('bkPlus').addEventListener('click', () => { sel.personas = Math.min(MAX_PAX, sel.personas + 1); pintarMesas(); pintarResumen(); });

  $('bkForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, nombre = f.nombre.value.trim(), telefono = f.telefono.value.trim(), email = f.email.value.trim();
    if (nombre.length < 2) return error('Escribe tu nombre.');
    if (!/^[+0-9 ]{6,20}$/.test(telefono)) return error('Escribe un número de celular válido.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error('El email no es válido.');
    if (!sel.fecha || !sel.hora || !sel.mesa) return error('Selecciona fecha, hora y mesa.');

    enviando = true; pintarResumen(); $('bkSubmit').textContent = 'Reservando…'; error();
    const r = { ...sel, nombre, telefono, email };
    try {
      const id = await DB.reservar(r);
      $('bkOkTxt').textContent = `${nombre.split(' ')[0]}, tu mesa ${r.mesa} para ${r.personas} ${r.personas === 1 ? 'persona' : 'personas'} está reservada el ${fechaLarga(r.fecha)} a las ${r.hora}.`;
      $('bkOkCode').textContent = 'Código AMB-' + String(id).padStart(4, '0');
      $('bkOk').hidden = false;
      f.reset(); sel.hora = null; sel.mesa = null;
    } catch (err) {
      const m = String(err.message);
      error(m.includes('mesa_ocupada') ? 'Esa mesa acaba de ser reservada por otra persona. Elige otra.'
        : m.includes('fecha_pasada') ? 'Ese horario ya pasó. Elige otro.'
        : 'No se pudo completar la reserva. Inténtalo de nuevo.');
    } finally {
      enviando = false; $('bkSubmit').textContent = 'Confirmar reserva';
      await cargar();
    }
  });
  $('bkOkClose').addEventListener('click', () => { $('bkOk').hidden = true; });

  // ---------- Arranque + refresco en vivo ----------
  $('bkDemo').hidden = remoto;
  sel.fecha = dias.find(f => libresDia(f) > 0) || dias[0];
  pintar();
  cargar();
  setInterval(() => { if (!document.hidden) cargar(); }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(); });
  addEventListener('storage', e => { if (e.key === LS) cargar(); }); // modo demo: sincroniza pestañas
})();
