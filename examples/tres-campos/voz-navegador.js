// ⚠️ ADAPTADOR DE EJEMPLO, NO EL ADAPTADOR DE LA BIBLIOTECA.
//
// Este archivo NO implementa SPEC-011: no lleva ninguno de sus catorce
// parches, no se ha medido contra Safari ni Blink, y no cierra la ventana
// de compatibilidad de ADR-011. Existe sólo para mostrar la costura: cómo
// un consumidor conecta el motor del navegador a los puertos de SPEC-004.
// El adaptador real, medido y con sus parches por síntoma, es etapa propia
// del proyecto (docs/specs/SPEC-011-adaptador-web-speech-y-parches.md).
// Desviación declarada de su parte: este listener puede resolver su promesa
// después de cancel() (lo prohíbe CANCEL_CONTRACT.settlesPromise); el núcleo
// lo tolera porque la disciplina de turno descarta el resultado tardío.

const LANG = 'es-MX';

function crearVozNavegador() {
  return typeof window.SpeechRecognition !== 'undefined'
    ? window.SpeechRecognition
    : window.webkitSpeechRecognition;
}

export function crearPuertosVozNavegador() {
  const Motor = crearVozNavegador();
  if (Motor === undefined) {
    throw new Error('Este navegador no trae SpeechRecognition.');
  }

  let reconocimiento = null;

  return {
    speaker: {
      say(texto) {
        return new Promise((resolve) => {
          const locucion = new SpeechSynthesisUtterance(texto);
          locucion.lang = LANG;
          locucion.onend = () => resolve('done');
          locucion.onerror = () => resolve('error');
          window.speechSynthesis.speak(locucion);
        });
      },
      cancel() {
        try { window.speechSynthesis.cancel(); } catch (error) { /* best-effort */ }
      },
    },

    listener: {
      listen(request, callbacks) {
        return new Promise((resolve) => {
          let resuelto = false;
          let final = null;
          const entrega = (resultado) => {
            if (resuelto) return;
            resuelto = true;
            reconocimiento = null;
            resolve(resultado);
          };
          const escucha = new Motor();
          escucha.lang = LANG;
          escucha.continuous = false;
          escucha.interimResults = true;
          escucha.maxAlternatives = 1;
          escucha.onresult = (evento) => {
            for (const resultado of evento.results) {
              if (resultado.isFinal) {
                final = {
                  type: 'speech',
                  text: resultado[0].transcript,
                  confidence: resultado[0].confidence,
                };
              }
            }
          };
          escucha.onerror = (evento) => {
            // Ingenuo a propósito: todo error entrega recognition_failed;
            // el adaptador real mapea por síntoma (SPEC-011).
            void evento;
            entrega({ type: 'recognition_failed' });
          };
          escucha.onend = () => {
            entrega(final !== null
              ? final
              : { type: 'no_speech' });
          };
          if (request.signal.aborted) {
            entrega({ type: 'recognition_failed' });
            return;
          }
          request.signal.addEventListener('abort', () => {
            try { escucha.stop(); } catch (error) { /* best-effort */ }
          }, { once: true });
          reconocimiento = escucha;
          escucha.start();
        });
      },
      cancel() {
        if (reconocimiento !== null) {
          try { reconocimiento.stop(); } catch (error) { /* best-effort */ }
        }
      },
    },
  };
}
