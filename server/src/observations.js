// The observation series, in the shape the client already derives from.
//
// mock.jsx's changeFromSeries() filters a series to samples that carry the
// field it needs, and treats "field absent" as NOT OBSERVED. SQL NULL is the
// same statement, so the mapping is: NULL column -> omitted key. It has to be
// omitted rather than emitted as null, because `Number.isFinite(null)` is
// false but `null` in JSON reads to a human as a recorded zero.

export const SELF_SUBJECT = 'saf-self';

// One DB row -> one client-shaped sample. Keys absent where the column is NULL.
export function rowToSample(row) {
  const s = { at: row.observed_at, source: row.source };
  if (row.review_count !== null && row.review_count !== undefined) s.reviews = row.review_count;
  if (row.rating !== null && row.rating !== undefined) s.rating = row.rating;
  if (row.followers !== null && row.followers !== undefined) s.followers = row.followers;
  if (row.media_count !== null && row.media_count !== undefined) s.mediaCount = row.media_count;
  if (row.avg_interactions !== null && row.avg_interactions !== undefined) s.avgInteractions = row.avg_interactions;
  return s;
}

// Oldest -> newest, which is the order every derivation in the client assumes.
export function seriesFor(db, subject) {
  const rows = db.prepare(
    `SELECT observed_at, source, review_count, rating, followers, media_count, avg_interactions
       FROM observations WHERE subject = ? ORDER BY observed_at ASC, id ASC`
  ).all(subject);
  return rows.map(rowToSample);
}

export function insertObservation(db, o) {
  return db.prepare(
    `INSERT INTO observations
       (subject, observed_at, source, review_count, rating, followers, media_count, avg_interactions, is_sample)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    o.subject, o.observedAt, o.source,
    o.reviewCount ?? null, o.rating ?? null, o.followers ?? null,
    o.mediaCount ?? null, o.avgInteractions ?? null,
    o.isSample ? 1 : 0
  );
}
