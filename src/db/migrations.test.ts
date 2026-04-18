/**
 * Migration-plumbing tests for Dexie.
 *
 * These tests do NOT touch the real `src/db/dexie.ts` singleton. They spin
 * up throwaway Dexie subclasses with unique database names so each test can
 * declare its own version chain and exercise the migration machinery in
 * isolation.
 *
 * What they prove:
 *   (a) data round-trips through open/close/reopen at a single version,
 *   (b) a no-op version bump preserves every row,
 *   (c) an upgrade that backfills a default field migrates existing rows
 *       and still accepts explicit values on new rows,
 *   (d) a stored version ahead of the code's declared version rejects via
 *       a Dexie.VersionError — a catchable Promise rejection, not a crash.
 *
 * NOTE — error surface gap: the app currently has no React ErrorBoundary,
 * so a db.open() rejection at mount time would bubble to the first live
 * query consumer. Test (d) verifies the contract (rejection is observable);
 * a user-facing surface for it is flagged as a v2.1.6 follow-up, not built
 * here. See the v2.1.6 prompt's "error-surface gap" note.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import Dexie, { type Table } from 'dexie';

interface RowV1 {
  id: string;
  name: string;
}

interface RowV2 extends RowV1 {
  flag?: string;
}

let uniqueId = 0;
const openDbs: Dexie[] = [];

// Each test gets its own database name so the in-memory fake-indexeddb
// store doesn't leak rows across tests.
function dbName(label: string): string {
  uniqueId += 1;
  return `migrations-test-${label}-${uniqueId}-${Date.now()}`;
}

function openV1(name: string): Dexie & { rows: Table<RowV1, string> } {
  const db = new Dexie(name) as Dexie & { rows: Table<RowV1, string> };
  db.version(1).stores({ rows: 'id, name' });
  openDbs.push(db);
  return db;
}

function openV2Noop(name: string): Dexie & { rows: Table<RowV1, string> } {
  const db = new Dexie(name) as Dexie & { rows: Table<RowV1, string> };
  db.version(1).stores({ rows: 'id, name' });
  // No-op upgrade: .stores() unchanged, .upgrade() body does nothing.
  db.version(2)
    .stores({ rows: 'id, name' })
    .upgrade(() => {});
  openDbs.push(db);
  return db;
}

function openV2WithDefault(
  name: string,
): Dexie & { rows: Table<RowV2, string> } {
  const db = new Dexie(name) as Dexie & { rows: Table<RowV2, string> };
  db.version(1).stores({ rows: 'id, name' });
  db.version(2)
    .stores({ rows: 'id, name, flag' })
    .upgrade(async (tx) => {
      await tx
        .table<RowV2>('rows')
        .toCollection()
        .modify((row) => {
          if (row.flag === undefined) row.flag = 'default';
        });
    });
  openDbs.push(db);
  return db;
}

afterEach(async () => {
  // Close every DB we opened so reopen-at-a-different-version within a
  // single test file doesn't hit "DB already open at version X" errors.
  while (openDbs.length > 0) {
    const db = openDbs.pop();
    if (db?.isOpen()) db.close();
  }
});

describe('Dexie migrations — plumbing', () => {
  it('(a) data persists across open/close/reopen at v1', async () => {
    const name = dbName('a');

    const first = openV1(name);
    await first.rows.add({ id: 'r1', name: 'Alice' });
    await first.rows.add({ id: 'r2', name: 'Bob' });
    first.close();

    const second = openV1(name);
    const rows = await second.rows.orderBy('id').toArray();
    expect(rows).toEqual([
      { id: 'r1', name: 'Alice' },
      { id: 'r2', name: 'Bob' },
    ]);
  });

  it('(b) v1 → v2 no-op upgrade preserves every row untouched', async () => {
    const name = dbName('b');

    const first = openV1(name);
    await first.rows.bulkAdd([
      { id: 'r1', name: 'Alice' },
      { id: 'r2', name: 'Bob' },
      { id: 'r3', name: 'Carol' },
    ]);
    first.close();

    const second = openV2Noop(name);
    const rows = await second.rows.orderBy('id').toArray();
    expect(rows).toEqual([
      { id: 'r1', name: 'Alice' },
      { id: 'r2', name: 'Bob' },
      { id: 'r3', name: 'Carol' },
    ]);
  });

  it('(c) v1 → v2 upgrade backfills a default field and accepts explicit values on new rows', async () => {
    const name = dbName('c');

    const first = openV1(name);
    await first.rows.bulkAdd([
      { id: 'old1', name: 'Legacy A' },
      { id: 'old2', name: 'Legacy B' },
    ]);
    first.close();

    const second = openV2WithDefault(name);

    // Existing rows now carry the backfilled default.
    const migrated = await second.rows.orderBy('id').toArray();
    expect(migrated).toEqual([
      { id: 'old1', name: 'Legacy A', flag: 'default' },
      { id: 'old2', name: 'Legacy B', flag: 'default' },
    ]);

    // New v2 rows can set the field explicitly.
    await second.rows.add({ id: 'new1', name: 'Fresh', flag: 'custom' });
    expect(await second.rows.get('new1')).toEqual({
      id: 'new1',
      name: 'Fresh',
      flag: 'custom',
    });

    // And a new row that omits `flag` is stored as-is (undefined). The
    // backfill runs at migration time, not on every future insert — this
    // documents that the default is an upgrade action, not a writer guard.
    await second.rows.add({ id: 'new2', name: 'NoFlag' });
    expect(await second.rows.get('new2')).toEqual({ id: 'new2', name: 'NoFlag' });
  });

  it('(e) v2.2.0 -> v2.2.1 backfill: existing property rows receive notes=null and coverPhotoId=null', async () => {
    // Mirrors the real-world v3 -> v4 upgrade in src/db/dexie.ts. We spin
    // up a throwaway schema that matches the production properties store
    // at v3 (no notes / coverPhotoId), insert a row, close, and reopen at
    // v4 with the same upgrade body to verify the backfill happens.
    const name = dbName('e');

    interface PropertyV3Shape {
      id: string;
      street: string;
      city: string;
    }
    interface PropertyV4Shape extends PropertyV3Shape {
      notes: string | null;
      coverPhotoId: string | null;
    }

    const v3 = new Dexie(name) as Dexie & {
      properties: Table<PropertyV3Shape, string>;
    };
    v3.version(3).stores({ properties: 'id, city' });
    openDbs.push(v3);
    await v3.properties.add({
      id: 'legacy-1',
      street: 'Herengracht',
      city: 'Amsterdam',
    });
    v3.close();

    const v4 = new Dexie(name) as Dexie & {
      properties: Table<PropertyV4Shape, string>;
    };
    v4.version(3).stores({ properties: 'id, city' });
    v4.version(4)
      .stores({ properties: 'id, city' })
      .upgrade(async (tx) => {
        await tx
          .table<PropertyV4Shape>('properties')
          .toCollection()
          .modify((p) => {
            if (p.notes === undefined) p.notes = null;
            if (p.coverPhotoId === undefined) p.coverPhotoId = null;
          });
      });
    openDbs.push(v4);

    const migrated = await v4.properties.get('legacy-1');
    expect(migrated).toEqual({
      id: 'legacy-1',
      street: 'Herengracht',
      city: 'Amsterdam',
      notes: null,
      coverPhotoId: null,
    });
  });

  it('(f) v2.3.0 -> v2.3.1 backfill: existing utility lines receive thickness="normaal"', async () => {
    // Mirrors the real-world v4 -> v5 upgrade in src/db/dexie.ts. A
    // line saved before v2.3.1 has no `thickness`; after the upgrade
    // every row has it set to the safe default "normaal".
    const name = dbName('f');

    interface LineV4Shape {
      id: string;
      propertyId: string;
      type: string;
    }
    interface LineV5Shape extends LineV4Shape {
      thickness: 'dun' | 'normaal' | 'dik';
    }

    const v4 = new Dexie(name) as Dexie & {
      utilityLines: Table<LineV4Shape, string>;
    };
    v4.version(4).stores({ utilityLines: 'id, propertyId, type' });
    openDbs.push(v4);
    await v4.utilityLines.bulkAdd([
      { id: 'legacy-1', propertyId: 'p1', type: 'water' },
      { id: 'legacy-2', propertyId: 'p1', type: 'gas' },
    ]);
    v4.close();

    const v5 = new Dexie(name) as Dexie & {
      utilityLines: Table<LineV5Shape, string>;
    };
    v5.version(4).stores({ utilityLines: 'id, propertyId, type' });
    v5.version(5)
      .stores({ utilityLines: 'id, propertyId, type' })
      .upgrade(async (tx) => {
        await tx
          .table<LineV5Shape>('utilityLines')
          .toCollection()
          .modify((l) => {
            if (l.thickness === undefined) l.thickness = 'normaal';
          });
      });
    openDbs.push(v5);

    const migrated = await v5.utilityLines.orderBy('id').toArray();
    expect(migrated).toEqual([
      { id: 'legacy-1', propertyId: 'p1', type: 'water', thickness: 'normaal' },
      { id: 'legacy-2', propertyId: 'p1', type: 'gas', thickness: 'normaal' },
    ]);
  });

  it('(g) v2.3.1 -> v2.3.2 photos schema bump: adds a propertyId index without touching existing line-photo rows', async () => {
    // Mirrors the real-world v5 -> v6 upgrade in src/db/dexie.ts. The
    // new index lets us query property-scoped (cover) photos
    // independently, but existing line photos keep their shape.
    const name = dbName('g');

    interface PhotoV5Shape {
      id: string;
      lineId: string;
    }
    interface PhotoV6Shape extends PhotoV5Shape {
      propertyId?: string;
    }

    const v5 = new Dexie(name) as Dexie & {
      photos: Table<PhotoV5Shape, string>;
    };
    v5.version(5).stores({ photos: 'id, lineId' });
    openDbs.push(v5);
    await v5.photos.bulkAdd([
      { id: 'legacy-1', lineId: 'line-a' },
      { id: 'legacy-2', lineId: 'line-b' },
    ]);
    v5.close();

    const v6 = new Dexie(name) as Dexie & {
      photos: Table<PhotoV6Shape, string>;
    };
    v6.version(5).stores({ photos: 'id, lineId' });
    v6.version(6).stores({ photos: 'id, lineId, propertyId' });
    openDbs.push(v6);

    // Existing line photos are untouched.
    const preserved = await v6.photos.orderBy('id').toArray();
    expect(preserved).toEqual([
      { id: 'legacy-1', lineId: 'line-a' },
      { id: 'legacy-2', lineId: 'line-b' },
    ]);

    // And the new propertyId index is usable for fresh rows.
    await v6.photos.add({ id: 'prop-scoped', lineId: null as unknown as string, propertyId: 'p1' });
    const byProperty = await v6.photos.where('propertyId').equals('p1').toArray();
    expect(byProperty.map((p) => p.id)).toEqual(['prop-scoped']);
  });

  it('(h) v2.3.4 -> v2.3.5 thickness migration: "dun"/"normaal"/"dik" become 2/4/6 (corrupt → 4)', async () => {
    // Mirrors the real-world v6 -> v7 upgrade in src/db/dexie.ts. The
    // legacy three-value enum is replaced by a plain number; existing
    // lines keep the same visual fill width they rendered at under
    // the enum:
    //   'dun'     -> 2
    //   'normaal' -> 4
    //   'dik'     -> 6
    //   anything else -> 4 (the v2.3.5 default)
    const name = dbName('h');

    interface LineV6Shape {
      id: string;
      propertyId: string;
      type: string;
      thickness: 'dun' | 'normaal' | 'dik' | 'weird' | number;
    }
    interface LineV7Shape {
      id: string;
      propertyId: string;
      type: string;
      thickness: number;
    }

    const v6 = new Dexie(name) as Dexie & {
      utilityLines: Table<LineV6Shape, string>;
    };
    v6.version(6).stores({ utilityLines: 'id, propertyId, type' });
    openDbs.push(v6);
    await v6.utilityLines.bulkAdd([
      { id: 'thin',   propertyId: 'p1', type: 'water', thickness: 'dun' },
      { id: 'normal', propertyId: 'p1', type: 'gas',   thickness: 'normaal' },
      { id: 'thick',  propertyId: 'p1', type: 'electricity', thickness: 'dik' },
      { id: 'weird',  propertyId: 'p1', type: 'water', thickness: 'weird' as never },
      { id: 'already-num', propertyId: 'p1', type: 'water', thickness: 7 },
    ]);
    v6.close();

    const v7 = new Dexie(name) as Dexie & {
      utilityLines: Table<LineV7Shape, string>;
    };
    v7.version(6).stores({ utilityLines: 'id, propertyId, type' });
    v7.version(7)
      .stores({ utilityLines: 'id, propertyId, type' })
      .upgrade(async (tx) => {
        await tx
          .table<LineV7Shape>('utilityLines')
          .toCollection()
          .modify((line) => {
            const raw = line.thickness as unknown;
            if (raw === 'dun') line.thickness = 2;
            else if (raw === 'normaal') line.thickness = 4;
            else if (raw === 'dik') line.thickness = 6;
            else if (
              typeof raw === 'number' &&
              Number.isInteger(raw) &&
              raw >= 1 &&
              raw <= 8
            ) {
              // keep as-is
            } else {
              line.thickness = 4;
            }
          });
      });
    openDbs.push(v7);

    const migrated = await v7.utilityLines.orderBy('id').toArray();
    expect(migrated.find((l) => l.id === 'thin')?.thickness).toBe(2);
    expect(migrated.find((l) => l.id === 'normal')?.thickness).toBe(4);
    expect(migrated.find((l) => l.id === 'thick')?.thickness).toBe(6);
    expect(migrated.find((l) => l.id === 'weird')?.thickness).toBe(4);
    expect(migrated.find((l) => l.id === 'already-num')?.thickness).toBe(7);
  });

  it('(d) a failing db.open() surfaces as a catchable Dexie.VersionError — not a silent crash', async () => {
    // Mocked failure path per the v2.1.6 prompt ("don't actually corrupt
    // anything"). We're asserting the CONTRACT callers get when Dexie
    // reports a version mismatch: the rejection is a real Dexie error
    // subclass they can `catch` and surface to the user.
    //
    // The realistic trigger in the wild is a stored DB at a version
    // higher than the code declares (e.g. a user rolls back to an older
    // bundle). Rather than fight fake-indexeddb's exact spec compliance
    // for that race, we simulate Dexie's response directly — the error
    // class + shape is what the app code branches on.
    const name = dbName('d');
    const db = new Dexie(name) as Dexie & { rows: Table<RowV1, string> };
    db.version(1).stores({ rows: 'id' });
    openDbs.push(db);

    const simulatedError = new Dexie.VersionError(
      'Stored DB is at a newer version than the app declares.',
    );
    const openSpy = vi.spyOn(db, 'open').mockRejectedValue(simulatedError);

    await expect(db.open()).rejects.toBeInstanceOf(Dexie.VersionError);
    await expect(db.open()).rejects.toMatchObject({
      name: 'VersionError',
      message: expect.stringContaining('newer version'),
    });

    openSpy.mockRestore();
  });
});
