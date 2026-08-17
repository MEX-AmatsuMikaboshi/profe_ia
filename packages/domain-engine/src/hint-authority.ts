/** Hechos estructurados sobre una ayuda; el texto generativo no decide dominio. */
export interface MasteryHintFacts {
  readonly level: 1 | 2 | 3 | 4 | 5;
  readonly levelOneReminderOnly: boolean;
  readonly selectsRuleOrNextStep: boolean;
  readonly containsDecisiveContent: boolean;
}

/**
 * Autoridad literal de DEC-HINT-AUTHORITY-001.
 *
 * Nivel 1 solo conserva elegibilidad si recuerda objetivo/definición y no
 * selecciona regla ni paso. Niveles 2–5 y cualquier contenido decisivo siempre
 * descalifican. No acepta la propuesta del generador como entrada.
 */
export function masteryDisqualifying(facts: MasteryHintFacts): boolean {
  if (facts.containsDecisiveContent) return true;
  if (facts.level >= 2) return true;
  return !facts.levelOneReminderOnly || facts.selectsRuleOrNextStep;
}
