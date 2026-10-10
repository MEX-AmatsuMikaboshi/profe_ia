'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { interruptPlayback, type Playback } from '@profesor-ia/speech-gateway';

import { CLASE_COPY } from '../copy';
import { fallbackToText, prepareSpeech } from '../speech';
import type { ProfessorTurn } from '../turn';

/**
 * Salida de voz del Profesor IA (T-H8-02 ← P-I §8.10, `voiceOutput`).
 *
 * ## Por qué sólo salida
 *
 * `voiceInput` exige decidir por dónde va el STT, y esa decisión tiene
 * consecuencias de privacidad que no son de este componente: el audio del alumno
 * es dato del sujeto experimental (UI-CORR-08). Aquí sólo suena **texto del
 * profesor que ya pasó el filtro de egreso**, así que no sale de la máquina nada
 * del alumno. El micrófono llega cuando su canal esté decidido.
 *
 * ## El sintetizador es adaptador, no política
 *
 * `speech-gateway` dice que «los adaptadores de proveedor viven fuera de este
 * paquete». `speechSynthesis` del navegador es uno de ellos, y el más barato:
 * no gasta, no necesita credencial y no manda el audio a nadie. Lo que decide
 * **qué** se dice y en qué orden es el guion canónico, que viene ya construido.
 *
 * ## Una caída de audio no toca la decisión
 *
 * Cualquier fallo del sintetizador pasa por `degradeToText()`, que devuelve el
 * texto byte a byte y `decisionChanged: false`. La UI lo dice con esas palabras:
 * el alumno tiene que poder distinguir «el profesor se calló» de «el profesor
 * cambió de idea».
 */

export interface VozProfesorProps {
  readonly turn: ProfessorTurn;
  /** Inyectable para prueba; por omisión, el del navegador. */
  readonly synthesis?: SpeechSynthesis | null;
}

type EstadoVoz =
  | { readonly kind: 'listo' }
  | { readonly kind: 'hablando' }
  | { readonly kind: 'sin_soporte' }
  | { readonly kind: 'nada_que_decir' }
  | { readonly kind: 'degradado'; readonly texto: string };

export function VozProfesor({ synthesis, ...props }: VozProfesorProps) {
  const [estado, setEstado] = useState<EstadoVoz>({ kind: 'listo' });
  const reproduccion = useRef<Playback | null>(null);

  const motor =
    synthesis ?? (typeof window === 'undefined' ? null : (window.speechSynthesis ?? null));

  // Una locución en curso no puede sobrevivir al desmontaje: el alumno cambia de
  // pantalla y la voz seguiría sonando sobre otra vista.
  useEffect(() => {
    return () => {
      if (motor !== null && reproduccion.current?.state === 'speaking') {
        motor.cancel();
      }
    };
  }, [motor]);

  const degradar = useCallback((playback: Playback, razon: string) => {
    const { fallback } = fallbackToText(playback, razon);
    reproduccion.current = null;
    setEstado({ kind: 'degradado', texto: fallback.canonicalText });
  }, []);

  const hablar = useCallback(() => {
    if (motor === null) {
      setEstado({ kind: 'sin_soporte' });
      return;
    }
    const preparado = prepareSpeech(props.turn);
    if (preparado === null) {
      setEstado({ kind: 'nada_que_decir' });
      return;
    }

    reproduccion.current = preparado.playback;
    setEstado({ kind: 'hablando' });

    // Las pausas no llevan texto; se saltan aquí y no en el guion, porque el
    // guion es lo que se registra y una pausa **es** parte de la decisión.
    const partes = preparado.spoken.filter((segmento) => segmento.spoken.trim() !== '');
    if (partes.length === 0) {
      setEstado({ kind: 'nada_que_decir' });
      reproduccion.current = null;
      return;
    }

    let pendientes = partes.length;
    try {
      partes.forEach((segmento) => {
        const locucion = new SpeechSynthesisUtterance(segmento.spoken);
        locucion.lang = 'es-MX';
        locucion.onerror = () => {
          const actual = reproduccion.current;
          if (actual !== null && actual.state === 'speaking') {
            degradar(actual, 'el sintetizador del navegador falló al reproducir');
          }
        };
        locucion.onend = () => {
          pendientes -= 1;
          if (pendientes === 0 && reproduccion.current?.state === 'speaking') {
            reproduccion.current = null;
            setEstado({ kind: 'listo' });
          }
        };
        motor.speak(locucion);
      });
    } catch {
      degradar(preparado.playback, 'el sintetizador del navegador no aceptó la locución');
    }
  }, [degradar, motor, props.turn]);

  const detener = useCallback(() => {
    const actual = reproduccion.current;
    if (motor === null || actual === null || actual.state !== 'speaking') return;
    motor.cancel();
    // `interruptPlayback` conserva el texto **entero**, no el trozo que sonó:
    // recortarlo registraría una explicación que el profesor nunca decidió dar.
    const { playback } = interruptPlayback(actual, -1);
    reproduccion.current = playback;
    setEstado({ kind: 'listo' });
  }, [motor]);

  return (
    <section className="clase-voz" aria-label={CLASE_COPY.voice.title} data-testid="voz-profesor">
      <p className="clase-voz-nota">{CLASE_COPY.voice.notice}</p>
      <div className="clase-voz-controles">
        <button
          className="btn btn-secondary"
          type="button"
          data-testid="voz-hablar"
          onClick={estado.kind === 'hablando' ? detener : hablar}
          aria-pressed={estado.kind === 'hablando'}
        >
          {estado.kind === 'hablando' ? CLASE_COPY.voice.stop : CLASE_COPY.voice.speak}
        </button>
      </div>
      {estado.kind === 'sin_soporte' ? (
        <p role="status" data-testid="voz-sin-soporte">
          {CLASE_COPY.voice.unavailable}
        </p>
      ) : null}
      {estado.kind === 'nada_que_decir' ? (
        <p role="status" data-testid="voz-nada">
          {CLASE_COPY.voice.nothingToSay}
        </p>
      ) : null}
      {estado.kind === 'degradado' ? (
        <div role="status" data-testid="voz-degradada" data-decision-changed="false">
          <p>{CLASE_COPY.voice.degraded}</p>
          <p className="clase-voz-texto">{estado.texto}</p>
        </div>
      ) : null}
    </section>
  );
}
