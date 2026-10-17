// Prueba de humo del ejemplo «tres campos» (PLAN-002, T-02).
//
// Ejerce el cableo público del ejemplo —no casos de spec de la biblioteca—
// por eso no cita identificadores C-*: las specs 009/010/011 siguen
// pendientes y la trazabilidad leería cualquier cita como caso probado.
//
// Camino declarado: sin motor de voz, la sesión degrada a entrada manual y
// los tres campos se completan por submitText con su confirmación leída.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearFlujo } from '../examples/tres-campos/flujo.js';
import { flush } from './helpers/session-harness.js';

test('el ejemplo degrada a manual sin motor y completa tres campos por texto', async () => {
  const { session, events } = crearFlujo();
  await session.start();
  await flush();

  const manual = events.filter((event) => event.type === 'manual_input_required');
  const fallos = events.filter((event) => event.type === 'failure');
  assert.ok(manual.length >= 1, 'la sesión no degradó a entrada manual');
  assert.ok(fallos.length >= 1, 'la degradación llegó sin fallo visible');
  assert.ok(manual[0].displayText !== null, 'el aviso visible no salió');

  await session.submitText('34');
  await session.submitText('sí');
  await session.submitText('70');
  await session.submitText('sí');
  await session.submitText('15');
  await session.submitText('sí');
  await flush();

  const confirmados = events.filter((event) => event.type === 'value_confirmed');
  const leidos = events.filter((event) => event.type === 'confirmation_requested');
  assert.equal(confirmados.length, 3, 'no se confirmaron los tres campos');
  assert.equal(leidos.length, 3, 'faltan readbacks antes de confirmar');
  assert.equal(session.values.edad.value, 34);
  assert.equal(session.values.peso.value, 70);
  assert.equal(session.values.minutos.value, 15);
  assert.equal(session.state, 'idle');
});
