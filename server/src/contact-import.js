// Importing the client's WhatsApp contact list. A STUB, and it must stay one.
//
// THIS FILE IS THE SEAM, the way `publish-adapters.js` is for publishing: when
// the gate below lifts, exactly one function changes and the tables, the
// derivations and the tests are already real.
//
// ---------------------------------------------------------------------------
// GATE — BLOCKED, pending the client's WhatsApp provider. CONVENTIONS.md §11.
//
// The identifier §11 decision 2 depends on MAY NOT EXIST. On Meta's Cloud API
// the contact identifier IS the phone number: `wa_id` is E.164, and there is no
// opaque handle to store instead. Business Solution Providers issue their own
// internal contact IDs, and against one of those §11 decisions 1 and 2 both
// hold as written. Against Cloud API direct they cannot both hold — one has to
// give, and which one is an owner decision, not an implementation detail.
//
// So until the client names their provider AND that provider is confirmed to
// issue a non-phone contact identifier that it also ACCEPTS AS A SEND TARGET,
// no commit may import a contact or populate `contact_ref` with a real value.
//
// A HASH OF A PHONE NUMBER IS NOT A WAY AROUND THIS, and it is the obvious
// wrong idea, so it is named here rather than left to be re-proposed: it
// satisfies decision 1 on paper and breaks the send path in fact, because no
// provider accepts a hash as a recipient. It would buy a table that cannot do
// the one thing it exists to do.
//
// Staff-created rows are unaffected and may be built and used — they never had
// a contact reference to begin with.
// ---------------------------------------------------------------------------

export const IMPORT_BLOCKED_REASON =
  'Contact import is not available. It needs the restaurant\'s WhatsApp provider to be known ' +
  'first, because what that provider issues as a contact reference decides whether this can be ' +
  'done at all: on Meta\'s Cloud API the reference IS the phone number, and this product does not ' +
  'store phone numbers. A provider that issues its own contact ID — and accepts it as a send ' +
  'target — is what this is waiting on. Customers added by hand are unaffected.';

// One entry point, one shape, no network call, no row written.
//
// It REFUSES rather than throwing, for the same reason the publish adapters
// report `not_implemented` instead of raising: "we are blocked on a decision"
// is an OUTCOME a caller should record and show, not an exception to swallow.
export async function importContacts() {
  return {
    ok: false,
    blockedBy: 'provider_unknown',
    reason: IMPORT_BLOCKED_REASON,
    imported: 0,
  };
}
