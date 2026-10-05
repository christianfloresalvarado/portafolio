// Utilidades de interfaz compartidas por las vistas.
import { PERFILES, ROLES, NIVELES, EVENTOS } from './data.js';
import { rolDeTarea, moduloDeRol, estadoSLA, relojTotal, aDias, nombreNodo, TAREA } from './flow.js';

// Contexto de la app (lo llena ui.js al iniciar).
export const ctx = { store: null, engine: null, audit: null };

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ESC[ch]);

export const usd = (x) => (x == null || Number.isNaN(x) ? '—' : `USD ${Number(x).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
export const pct = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d).replace('.', ',')} %`);
export const num = (x, d = 2) => (x == null ? '—' : Number(x).toLocaleString('es-EC', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const horas = (h) => `${num(h, 2)} h`;
export const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'medium' }) : '—');

export function anunciar(msg) {
  const el = document.getElementById('live');
  if (!el) return;
  el.textContent = '';
  setTimeout(() => { el.textContent = msg; }, 30);
}

export function chipNivel(nivel) {
  if (!nivel) return '';
  return `<span class="chip nivel-${esc(nivel)}" title="${esc(NIVELES[nivel])}">${esc(nivel)}</span>`;
}

export function badgeSLA(c) {
  const s = estadoSLA(c, ctx.store.politica());
  const icon = { verde: '●', ambar: '▲', rojo: '■', 'sin-sla': '○', cerrado: '✓' }[s.estado];
  const detalle = s.limite != null ? ` · ${horas(s.transcurrido)} de ${horas(s.limite)}` : '';
  return `<span class="sla sla-${s.estado}"><span aria-hidden="true">${icon}</span> ${esc(s.texto)}${esc(detalle)}</span>`;
}

export function estadoCaso(c) {
  if (c.status === 'cerrado') return `<span class="chip fin fin-${esc(c.fin.id)}">Fin: ${esc(c.fin.nombre)}</span>`;
  if (c.running) return '<span class="chip run"><span class="spin" aria-hidden="true"></span> Plataforma ejecutando</span>';
  if (c.error) return `<span class="chip err">Error: ${esc(c.error)}</span>`;
  return `<span class="chip abierto">En ${esc(TAREA[c.node]?.cod || '')} · ${esc(moduloDeRol(rolDeTarea(c)))}</span>`;
}

export function tareaActualTexto(c) {
  if (c.status === 'cerrado') return c.fin.nombre;
  if (c.subestado === 'confirmar-campos') return '2.1 · Revisión humana de campos bajo umbral';
  if (c.activos?.length) return c.activos.map(nombreNodo).join(' ‖ ');
  return nombreNodo(c.node);
}

export const perfilTxt = (p) => PERFILES[p]?.etiqueta || p;
export const rolTxt = (r) => ROLES[r]?.modulo || r;
export const relojTxt = (c) => `${horas(relojTotal(c))} · ${num(aDias(relojTotal(c)), 2)} días hábiles`;
export const finTxt = (id) => EVENTOS[id]?.nombre || id;

export function descargar(nombre, contenido, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function jsonCorto(o) {
  if (o == null) return '—';
  const s = JSON.stringify(o);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}
