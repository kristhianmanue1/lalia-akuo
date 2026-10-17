// Vista mínima del ejemplo: consume los eventos de la sesión y nada más.
//
// El núcleo nunca toca el DOM (CAPABILITIES.touchesDom = false): esta vista
// es un consumidor más. Los cinco elementos y el anuncio por cambio de
// estado son la interfaz mínima de SPEC-009, vista desde el consumidor.

import { createCatalog, PACK_ES } from '../../src/index.js';
import { crearFlujo } from './flujo.js';
import { crearPuertosVozNavegador } from './voz-navegador.js';

const catalogo = createCatalog(PACK_ES);
const $ = (id) => document.getElementById(id);
const dialogo = $('dialogo');
let flujo = null;

function dice(texto, clase) {
  const linea = document.createElement('p');
  linea.className = clase;
  linea.textContent = texto;
  dialogo.appendChild(linea);
}

function anuncia(estado) {
  try {
    $('indicador').textContent = catalogo.text('announce.state.' + estado);
  } catch (error) {
    $('indicador').textContent = estado;
  }
}

function habilitaTexto(on) {
  $('texto').disabled = !on;
  $('entrada-texto').querySelector('button[type="submit"]').disabled = !on;
  if (on) $('texto').focus();
}

function pintar(evento) {
  if (evento.type === 'state_changed') anuncia(evento.state);
  if (evento.type === 'text_output') dice(evento.displayText, 'agente');
  if (evento.type === 'confirmation_requested') {
    dice(evento.displayText + ' (responde o escribe «sí»/«no»)', 'agente');
  }
  if (evento.type === 'manual_input_required') {
    dice(evento.displayText, 'aviso');
    habilitaTexto(true);
  }
  if (evento.type === 'value_confirmed') {
    dice(evento.fieldId + ' = ' + String(evento.value), 'guardado');
  }
}

$('iniciar').addEventListener('click', async () => {
  if (flujo !== null) return;
  const conVoz = typeof window.SpeechRecognition !== 'undefined'
    || typeof window.webkitSpeechRecognition !== 'undefined';
  flujo = crearFlujo(conVoz
    ? { voz: true, puertosVoz: crearPuertosVozNavegador(), observar: pintar }
    : { observar: pintar });
  habilitaTexto(true);
  anuncia('idle');
  dice(conVoz
    ? 'Voz del navegador detectada: adaptador de ejemplo, sin medir.'
    : 'Sin motor de voz: el flujo continúa por texto.', 'aviso');
  await flujo.session.start();
});

$('entrada-texto').addEventListener('submit', (evento) => {
  evento.preventDefault();
  if (flujo === null) return;
  const texto = $('texto').value;
  $('texto').value = '';
  if (texto === '') return;
  dice(texto, 'persona');
  flujo.session.submitText(texto);
});

$('silenciar-micro').addEventListener('click', (evento) => {
  if (flujo === null) return;
  const boton = evento.currentTarget;
  const activo = boton.getAttribute('aria-pressed') !== 'true';
  boton.setAttribute('aria-pressed', String(activo));
  flujo.session.setMicrophoneMuted(activo);
});

$('silenciar-voz').addEventListener('click', (evento) => {
  if (flujo === null) return;
  const boton = evento.currentTarget;
  const activo = boton.getAttribute('aria-pressed') !== 'true';
  boton.setAttribute('aria-pressed', String(activo));
  flujo.session.setSpeechMuted(activo);
});
