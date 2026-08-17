/**
 * `ci:db:negative` — suite negativa de privilegios (Plan.md T-H1-04 [CRITICAL]
 * ← Maestro P-II §11.2, §14.4).
 *
 * Cada intento prohibido **debe fallar**. La suite incluye además controles
 * positivos: sin ellos, una base rota (o un rol sin conexión) haría pasar todas
 * las pruebas negativas sin probar nada.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from 'pg';
import {
  FORBIDDEN_SCHEMA_ACCESS,
  OWNER_ROLE,
  PERMISSION_MATRIX,
  SERVICE_ROLES,
  TABLES,
  type SchemaName,
  type ServiceRole,
} from '@profesor-ia/security-policy';
import {
  initializeSessionState,
  restoreSessionStateSnapshot,
  toSessionStatePersistenceRow,
  type SessionStatePersistenceRow,
} from '../../../packages/session-engine/src/index.js';
import { ATOMIC_PROBE_CONSUMPTION_SQL } from '../../../apps/measurement-worker/src/index.js';
import { expectDenied, startHarness, type Harness } from './harness.js';

let h: Harness;
const conns = new Map<ServiceRole, Client>();

beforeAll(async () => {
  h = await startHarness();
  for (const role of SERVICE_ROLES) conns.set(role, await h.connectAs(role));
}, 300_000);

afterAll(async () => {
  await h?.stop();
});

const as = (role: ServiceRole): Client => {
  const c = conns.get(role);
  if (!c) throw new Error(`sin conexión para ${role}`);
  return c;
};

function structuredSessionRow(sessionId: string, participantPseudoId: string): SessionStatePersistenceRow {
  const initialized = initializeSessionState(
    {
      sessionId,
      runId: 'run-1',
      participantPseudoId,
      courseId: 'c1',
      packageVersion: {
        artifactId: 'content-package-test-fixture',
        version: 'test-fixture-v1',
        hash: 'a'.repeat(64),
      },
      plannedDurationSeconds: 3_600,
    },
    { eventId: `event-${sessionId}-0`, occurredAt: '2026-08-16T12:00:00.000Z' },
  );
  return toSessionStatePersistenceRow(initialized.snapshot);
}

async function insertStructuredSession(row: SessionStatePersistenceRow): Promise<void> {
  await h.admin.query(
    `INSERT INTO pedagogy.session_state (
       session_id, run_id, participant_pseudo_id, course_id, state, pedagogical_mode,
       selected_strategy, assistance_level, structured_state, projection_hash, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     ON CONFLICT DO NOTHING`,
    [
      row.session_id,
      row.run_id,
      row.participant_pseudo_id,
      row.course_id,
      row.state,
      row.pedagogical_mode,
      row.selected_strategy,
      row.assistance_level,
      row.structured_state,
      row.projection_hash,
      row.updated_at,
    ],
  );
}

describe('los siete esquemas exactos (P-II §9.2)', () => {
  it('existen exactamente los siete, sin un octavo', async () => {
    const { rows } = await h.admin.query<{ nspname: string }>(
      `SELECT nspname FROM pg_namespace
        WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema', 'public')
        ORDER BY nspname`,
    );
    expect(rows.map((r) => r.nspname)).toEqual([
      'audit',
      'evidence',
      'identity',
      'measurement',
      'operations',
      'pedagogy',
      'private_solutions',
    ]);
  });
});

describe('consumo atómico de sondas (T-H6-06)', () => {
  it('dos reclamos concurrentes consumen e insertan exactamente una vez', async () => {
    const opportunityId = 'opportunity-atomic-fixture';
    const itemId = 'probe-item-atomic-fixture';
    await h.admin.query(
      `INSERT INTO measurement.probe_opportunity (
         opportunity_id, probe_round_id, experimental_set, phase, measure_kind, planned_items
       ) VALUES ($1, NULL, 'A', 'intervention', 'transfer_measurement', 1)`,
      [opportunityId],
    );
    await h.admin.query(
      `INSERT INTO measurement.probe_reserve_item (
         item_id, reserve, experimental_set, item_family_id, structural_signature
       ) VALUES ($1, 'TRANSFER_MEASUREMENT', 'A', 'family-atomic-fixture', 'signature-atomic-fixture')`,
      [itemId],
    );
    const second = await h.connectAs('svc_measurement');
    try {
      const [firstResult, secondResult] = await Promise.all([
        as('svc_measurement').query(ATOMIC_PROBE_CONSUMPTION_SQL, [
          'consumption-atomic-a',
          opportunityId,
          itemId,
          'TRANSFER_MEASUREMENT',
          'A',
          1,
        ]),
        second.query(ATOMIC_PROBE_CONSUMPTION_SQL, [
          'consumption-atomic-b',
          opportunityId,
          itemId,
          'TRANSFER_MEASUREMENT',
          'A',
          1,
        ]),
      ]);
      expect([firstResult.rowCount, secondResult.rowCount].sort()).toEqual([0, 1]);
      const { rows } = await h.admin.query<{ consumed: boolean; consumption_count: string }>(
        `SELECT r.consumed,
                (SELECT count(*)::text FROM measurement.probe_consumption c WHERE c.item_id = r.item_id)
                  AS consumption_count
           FROM measurement.probe_reserve_item r
          WHERE r.item_id = $1`,
        [itemId],
      );
      expect(rows).toEqual([{ consumed: true, consumption_count: '1' }]);
    } finally {
      await second.end();
    }
  });
});

describe('atributos de los roles runtime (P-II §11.2)', () => {
  it('ninguno es SUPERUSER, BYPASSRLS, CREATEROLE ni hereda privilegios', async () => {
    const { rows } = await h.admin.query<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreaterole: boolean;
      rolinherit: boolean;
    }>(
      `SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolinherit
         FROM pg_roles WHERE rolname LIKE 'svc_%' ORDER BY rolname`,
    );
    expect(rows).toHaveLength(SERVICE_ROLES.length);
    for (const r of rows) {
      expect(r.rolsuper, `${r.rolname} es SUPERUSER`).toBe(false);
      expect(r.rolbypassrls, `${r.rolname} es BYPASSRLS`).toBe(false);
      expect(r.rolcreaterole, `${r.rolname} puede crear roles`).toBe(false);
      expect(r.rolinherit, `${r.rolname} hereda privilegios`).toBe(false);
    }
  });

  it('ningún rol runtime es miembro de otro (sin escalada por SET ROLE)', async () => {
    const { rows } = await h.admin.query(
      `SELECT m.member::regrole::text AS member, m.roleid::regrole::text AS grantee
         FROM pg_auth_members m
        WHERE m.member::regrole::text LIKE 'svc_%'`,
    );
    expect(rows).toEqual([]);
  });

  it('un intento explícito de SET ROLE hacia otro servicio falla', async () => {
    const err = await expectDenied(as('svc_session'), 'SET ROLE svc_background');
    expect(err, 'svc_session pudo convertirse en svc_background').toBeTruthy();
  });

  it('el rol de migraciones existe y no se usa para conectar (NOLOGIN)', async () => {
    const { rows } = await h.admin.query<{ rolcanlogin: boolean }>(
      `SELECT rolcanlogin FROM pg_roles WHERE rolname = '${OWNER_ROLE}'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rolcanlogin).toBe(false);
  });
});

describe('PUBLIC no otorga privilegios (P-II §11.2)', () => {
  it('PUBLIC no tiene privilegios sobre ninguna tabla de los siete esquemas', async () => {
    const { rows } = await h.admin.query(
      `SELECT table_schema, table_name, privilege_type
         FROM information_schema.table_privileges
        WHERE grantee = 'PUBLIC'
          AND table_schema IN ('identity','pedagogy','evidence','private_solutions','measurement','audit','operations')`,
    );
    expect(rows).toEqual([]);
  });
});

describe('fronteras duras por esquema (I-2, I-4)', () => {
  for (const role of SERVICE_ROLES) {
    const forbidden = FORBIDDEN_SCHEMA_ACCESS[role] ?? [];
    for (const schema of forbidden) {
      for (const table of TABLES[schema as SchemaName]) {
        it(`${role} NO puede leer ${schema}.${table}`, async () => {
          const err = await expectDenied(as(role), `SELECT 1 FROM ${schema}.${table} LIMIT 1`);
          expect(err, `${role} leyó ${schema}.${table}`).toBeTruthy();
        });
      }
    }
  }
});

describe('la ruta de sesión nunca alcanza soluciones ni sondas (I-2, I-4)', () => {
  it('svc_session no lee soluciones', async () => {
    expect(
      await expectDenied(as('svc_session'), 'SELECT * FROM private_solutions.solution'),
    ).toBeTruthy();
  });

  it('svc_api no lee sondas futuras ni semillas', async () => {
    expect(
      await expectDenied(as('svc_api'), 'SELECT * FROM measurement.probe_reserve_item'),
    ).toBeTruthy();
    expect(await expectDenied(as('svc_api'), 'SELECT * FROM measurement.probe_seed')).toBeTruthy();
  });

  it('la ruta de sesión no resuelve identidad real', async () => {
    expect(
      await expectDenied(as('svc_session'), 'SELECT * FROM identity.identity_link'),
    ).toBeTruthy();
    expect(await expectDenied(as('svc_api'), 'SELECT * FROM identity.identity_link')).toBeTruthy();
  });

  it('el verificador no accede a ningún dato (función pura)', async () => {
    for (const schema of Object.keys(TABLES) as SchemaName[]) {
      for (const table of TABLES[schema]) {
        const err = await expectDenied(as('svc_verifier'), `SELECT 1 FROM ${schema}.${table}`);
        expect(err, `svc_verifier leyó ${schema}.${table}`).toBeTruthy();
      }
    }
  });

  it('la métrica sombra no es legible desde la ruta de sesión (DEC-BKT-001)', async () => {
    expect(
      await expectDenied(as('svc_session'), 'SELECT * FROM pedagogy.shadow_metric'),
    ).toBeTruthy();
  });
});

describe('evidencia append-only (I-6, DEC-LEDGER-001)', () => {
  const insert = (
    streamId: string,
    seq: number,
    prev: string,
    hash: string,
    id: string,
    correctionOf?: string,
  ) =>
    `INSERT INTO evidence.event (
        event_id, schema_version, stream_id, sequence_number, correlation_id, run_id,
        participant_pseudo_id, session_id, event_type, payload, decision_maker, autonomy_status,
        versions, occurred_at, previous_hash, hash, validity, correction_of_event_id
     ) VALUES (
        '${id}', '1', '${streamId}', ${seq}, 'corr-1', 'run-1', 'pseudo-1', 'sess-1',
        'session.started', '{}'::jsonb, 'engine', 'autonomous', '{}'::jsonb, now(),
        '${prev}', '${hash}', 'valid', ${correctionOf ? `'${correctionOf}'` : 'NULL'})`;

  it('ningún rol runtime tiene UPDATE o DELETE concedido sobre evidence.event', async () => {
    const { rows } = await h.admin.query(
      `SELECT grantee, privilege_type FROM information_schema.table_privileges
        WHERE table_schema = 'evidence' AND table_name = 'event'
          AND privilege_type IN ('UPDATE', 'DELETE')
          AND grantee LIKE 'svc_%'`,
    );
    expect(rows).toEqual([]);
  });

  it('la base impide UPDATE y DELETE incluso con el rol propietario', async () => {
    await h.admin.query(insert('stream-owner', 0, 'GENESIS', 'h-owner-0', 'ev-owner-0'));
    const upd = await expectDenied(
      h.admin,
      "UPDATE evidence.event SET validity = 'invalid' WHERE event_id = 'ev-owner-0'",
    );
    expect(upd).toContain('append-only');
    const del = await expectDenied(
      h.admin,
      "DELETE FROM evidence.event WHERE event_id = 'ev-owner-0'",
    );
    expect(del).toContain('append-only');
  });

  it('rechaza una secuencia no monótona', async () => {
    await h.admin.query(insert('stream-seq', 0, 'GENESIS', 'h-seq-0', 'ev-seq-0'));
    const err = await expectDenied(h.admin, insert('stream-seq', 5, 'h-seq-0', 'h-seq-5', 'ev-seq-5'));
    expect(err).toContain('secuencia no monótona');
  });

  it('rechaza una cadena rota de hashes', async () => {
    await h.admin.query(insert('stream-chain', 0, 'GENESIS', 'h-chain-0', 'ev-chain-0'));
    const err = await expectDenied(
      h.admin,
      insert('stream-chain', 1, 'hash-inventado', 'h-chain-1', 'ev-chain-1'),
    );
    expect(err).toContain('cadena rota');
  });

  it('una corrección es un evento nuevo enlazado que conserva el original', async () => {
    await h.admin.query(insert('stream-corr', 0, 'GENESIS', 'h-corr-0', 'ev-corr-0'));
    await h.admin.query(
      insert('stream-corr', 1, 'h-corr-0', 'h-corr-1', 'ev-corr-1', 'ev-corr-0'),
    );
    const { rows } = await h.admin.query(
      "SELECT event_id FROM evidence.event WHERE stream_id = 'stream-corr' ORDER BY sequence_number",
    );
    expect(rows.map((r) => r.event_id)).toEqual(['ev-corr-0', 'ev-corr-1']);
  });
});

describe('los costos no se reescriben (P-II §9.5)', () => {
  it('ningún rol tiene UPDATE/DELETE sobre cost_event ni sobre los manifiestos de tarifas', async () => {
    const { rows } = await h.admin.query(
      `SELECT table_name, grantee, privilege_type FROM information_schema.table_privileges
        WHERE table_schema = 'operations'
          AND table_name IN ('cost_event', 'pricing_manifest', 'pricing_entry')
          AND privilege_type IN ('UPDATE', 'DELETE')
          AND grantee LIKE 'svc_%'`,
    );
    expect(rows).toEqual([]);
  });
});

describe('controles positivos (la suite negativa no pasa por vacío)', () => {
  it('cada concesión de la matriz funciona de verdad para SELECT', async () => {
    for (const role of SERVICE_ROLES) {
      for (const entry of PERMISSION_MATRIX[role] ?? []) {
        if (!entry.operations.includes('SELECT')) continue;
        const err = await expectDenied(
          as(role),
          `SELECT 1 FROM ${entry.schema}.${entry.table} LIMIT 1`,
        );
        expect(err, `${role} NO pudo leer ${entry.schema}.${entry.table} pese a la matriz`).toBeNull();
      }
    }
  });

  it('svc_session puede insertar evidencia (append) aunque no pueda modificarla', async () => {
    const client = as('svc_session');
    const err = await expectDenied(
      client,
      `INSERT INTO evidence.event (
          event_id, schema_version, stream_id, sequence_number, correlation_id, run_id,
          participant_pseudo_id, session_id, event_type, payload, decision_maker, autonomy_status,
          versions, occurred_at, previous_hash, hash, validity
       ) VALUES ('ev-sess-0', '1', 'stream-sess', 0, 'corr', 'run-1', 'pseudo-1', 'sess-1',
          'session.started', '{}'::jsonb, 'engine', 'autonomous', '{}'::jsonb, now(),
          'GENESIS', 'h-sess-0', 'valid')`,
    );
    expect(err).toBeNull();

    const upd = await expectDenied(
      client,
      "UPDATE evidence.event SET validity = 'invalid' WHERE event_id = 'ev-sess-0'",
    );
    expect(upd).toBeTruthy();
  });
});

describe('supresión de artefactos sin romper la cadena (T-H10-07)', () => {
  it('borrar un artefacto suprimible conserva el evento y su cadena', async () => {
    await h.admin.query(
      `INSERT INTO evidence.suppressible_artifact (artifact_id, kind, content, content_hash)
       VALUES ('art-1', 'free_text', '\\x00'::bytea, 'hash-art-1')`,
    );
    await h.admin.query(
      `INSERT INTO evidence.event (
          event_id, schema_version, stream_id, sequence_number, correlation_id, run_id,
          participant_pseudo_id, session_id, event_type, payload, artifact_refs, decision_maker,
          autonomy_status, versions, occurred_at, previous_hash, hash, validity
       ) VALUES ('ev-art-0', '1', 'stream-art', 0, 'corr', 'run-1', 'pseudo-1', 'sess-1',
          'stt.committed', '{"artifactRef":"art-1"}'::jsonb, ARRAY['art-1'], 'engine',
          'autonomous', '{}'::jsonb, now(), 'GENESIS', 'h-art-0', 'valid')`,
    );

    const background = as('svc_background');
    expect(
      await expectDenied(background, "DELETE FROM evidence.suppressible_artifact WHERE artifact_id = 'art-1'"),
    ).toBeNull();

    const { rows } = await h.admin.query(
      "SELECT artifact_refs, hash FROM evidence.event WHERE event_id = 'ev-art-0'",
    );
    expect(rows[0]?.hash).toBe('h-art-0');
    expect(rows[0]?.artifact_refs).toEqual(['art-1']);
  });

  it('la ruta de sesión no puede suprimir artefactos', async () => {
    expect(
      await expectDenied(as('svc_session'), 'DELETE FROM evidence.suppressible_artifact'),
    ).toBeTruthy();
  });
});

describe('RLS como segunda capa (P-II §11.2)', () => {
  beforeAll(async () => {
    await h.admin.query(
      `INSERT INTO pedagogy.course (course_id, course_type, title)
       VALUES ('c1', 'VALIDATED_LOGIC_COURSE', 'Deducción natural')
       ON CONFLICT DO NOTHING`,
    );
    for (const [id, pseudo] of [
      ['s-alpha', 'pseudo-alpha'],
      ['s-beta', 'pseudo-beta'],
    ]) {
      await insertStructuredSession(structuredSessionRow(id, pseudo));
    }
  });

  it('persiste y restaura el estado íntegro con el hash calculado por el motor', async () => {
    const { rows } = await h.admin.query<SessionStatePersistenceRow>(
      `SELECT session_id, run_id, participant_pseudo_id, course_id, state, pedagogical_mode,
              selected_strategy, assistance_level, structured_state, projection_hash, updated_at
         FROM pedagogy.session_state WHERE session_id = 's-alpha'`,
    );
    const row = rows[0];
    expect(row).toBeDefined();
    const restored = restoreSessionStateSnapshot(row!);
    expect(restored.state.sessionId).toBe('s-alpha');
    expect(restored.state.primaryState).toBe('preparada');
    expect(restored.projectionHash).toBe(row?.projection_hash);
  });

  it('la BD rechaza columnas escalares que contradicen la proyección', async () => {
    const row = structuredSessionRow('s-inconsistent', 'pseudo-inconsistent');
    await expect(
      h.admin.query(
        `INSERT INTO pedagogy.session_state (
           session_id, run_id, participant_pseudo_id, course_id, state, pedagogical_mode,
           selected_strategy, assistance_level, structured_state, projection_hash, updated_at
         ) VALUES ($1, $2, $3, $4, 'diagnostico', $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          row.session_id,
          row.run_id,
          row.participant_pseudo_id,
          row.course_id,
          row.pedagogical_mode,
          row.selected_strategy,
          row.assistance_level,
          row.structured_state,
          row.projection_hash,
          row.updated_at,
        ],
      ),
    ).rejects.toThrow(/session_state_structured_scalar_match/u);
  });

  it('la BD también prohíbe masteryProbabilityShadow mientras BKT esté OFF', async () => {
    const row = structuredSessionRow('s-bkt-forbidden', 'pseudo-bkt-forbidden');
    const withInventedBkt = {
      ...(row.structured_state as object),
      masteryProbabilityShadow: 0.8,
    };
    await expect(
      h.admin.query(
        `INSERT INTO pedagogy.session_state (
           session_id, run_id, participant_pseudo_id, course_id, state, pedagogical_mode,
           selected_strategy, assistance_level, structured_state, projection_hash, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
        [
          row.session_id,
          row.run_id,
          row.participant_pseudo_id,
          row.course_id,
          row.state,
          row.pedagogical_mode,
          row.selected_strategy,
          row.assistance_level,
          withInventedBkt,
          row.projection_hash,
          row.updated_at,
        ],
      ),
    ).rejects.toThrow(/session_state_bkt_shadow_absent/u);
  });

  it('FORCE ROW LEVEL SECURITY está activo en las tablas por participante', async () => {
    const { rows } = await h.admin.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname IN ('session_state', 'attempt')
          AND relnamespace = 'pedagogy'::regnamespace`,
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.relrowsecurity, `${r.relname} sin RLS`).toBe(true);
      expect(r.relforcerowsecurity, `${r.relname} sin FORCE RLS`).toBe(true);
    }
  });

  it('un servicio de sesión solo ve las filas del participante declarado', async () => {
    const client = as('svc_session');
    await client.query("SELECT set_config('app.participant_pseudo_id', 'pseudo-alpha', false)");
    const visible = await client.query('SELECT session_id FROM pedagogy.session_state');
    expect(visible.rows.map((r) => r.session_id)).toEqual(['s-alpha']);
  });

  it('sin participante declarado no ve ninguna fila', async () => {
    const client = as('svc_session');
    await client.query("SELECT set_config('app.participant_pseudo_id', '', false)");
    const visible = await client.query('SELECT session_id FROM pedagogy.session_state');
    expect(visible.rows).toEqual([]);
  });

  it('RLS es segunda capa: measurement y private_solutions se protegen por privilegios', async () => {
    const { rows } = await h.admin.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class
        WHERE relnamespace IN ('measurement'::regnamespace, 'private_solutions'::regnamespace)
          AND relkind = 'r'`,
    );
    // No dependen de RLS; la denegación ya está probada arriba por privilegios.
    for (const r of rows) expect(r.relrowsecurity).toBe(false);
  });
});
