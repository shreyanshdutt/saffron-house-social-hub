// The customer model: who can be reached, and who was tagged with what.
// Derivation only — nothing here is persisted.
//
// CONVENTIONS.md §11 is the specification. The two facts it turns on:
//
//   1. THE PRODUCT STORES NO CONTACT DETAILS. There is no phone number, email
//      or address in `customers`, and reachability is therefore not a property
//      of a person — it is a property of whether a PROVIDER-ISSUED reference
//      exists for them.
//   2. A SEGMENT SHOWS TWO NUMBERS, NEVER ONE. "40 tagged · 31 reachable."
//      One figure beside a broadcast button tells a restaurant it can reach
//      nine people it cannot, and it finds out by paying ₹0.8631 each to
//      discover otherwise.

// Reachable means: this row came from the client's contact list AND still
// carries the reference that list issued.
//
// DERIVED ON READ, never stored. A `reachable` column would be a second copy
// of a fact the row already states, free to disagree with it the moment either
// changes — the same reason `summarisePost()` derives an outcome from targets
// rather than writing one onto the post.
export function isReachable(customer) {
  if (!customer) return false;
  return customer.source === 'imported' && !!customer.contactRef;
}

// The shape a segment is allowed to be described in.
//
// IT RETURNS ALL THREE NUMBERS, ALWAYS, and there is deliberately no variant
// that returns a total on its own. That is not defensiveness about types; it
// is the §11 decision expressed in the only place that can enforce it. A
// caller wanting "how big is this segment" has to take `reachable` alongside
// it and is thereby unable to put the wrong number next to a Send button.
//
// `tagged` always equals `reachable + unreachable` — asserted in the tests,
// because the day it does not, one of the three is lying.
export function summariseSegment(rows = []) {
  let reachable = 0;
  for (const r of rows) if (isReachable(r)) reachable += 1;
  return {
    tagged: rows.length,
    reachable,
    unreachable: rows.length - reachable,
  };
}

// Everyone tagged with one dish, WITH the provenance of each tag.
//
// `taggedBy` and `taggedAt` travel all the way to the caller because a staff
// tag is one person's judgement, and evidence that loses its provenance on the
// way out is not evidence — it becomes indistinguishable from something the
// system worked out, which is precisely the confusion §11 exists to prevent.
//
// Note what this does NOT do: it never touches `guest_texts`. A dish mention
// is a guest's own words and a customer tag is a staff judgement; §11 forbids
// joining them, and an Instagram handle is not a phone number in any case.
export function customersForDish(db, menuItemId) {
  return db.prepare(
    `SELECT c.id, c.source, c.contact_ref, c.display_label, c.created_at, c.is_sample,
            t.tagged_by, t.tagged_at
       FROM customer_tags t
       JOIN customers c ON c.id = t.customer_id
      WHERE t.menu_item_id = ?
      ORDER BY c.display_label`
  ).all(menuItemId).map(toCustomer);
}

// One row, in the shape the rest of the server speaks.
export function toCustomer(r) {
  const customer = {
    id: r.id,
    source: r.source,
    contactRef: r.contact_ref ?? null,
    displayLabel: r.display_label,
    createdAt: r.created_at,
    isSample: !!r.is_sample,
  };
  if (r.tagged_by !== undefined) {
    customer.taggedBy = r.tagged_by;
    customer.taggedAt = r.tagged_at;
  }
  customer.reachable = isReachable(customer);
  return customer;
}
