# YNAB SDK integration

Transaction-list methods in `src/lib/api-client.ts` use the SDK's typed named
request objects through `getTransactionsRaw` and its account, category, and
payee variants. Call `.value()` on the returned SDK response to retain its
normal JSON decoding. Optional filters must be mapped by name: positional SDK
signatures can insert optional parameters between existing arguments.

The dependency floor and `bun.lock` select SDK 4.5.0 or later. Keep the lockfile
aligned with the supported SDK so typechecking and tests exercise its actual
request interfaces.

`src/lib/api-client.transactions.test.ts` exercises all four transaction-list
paths through the real SDK with only global fetch mocked. A synthetic API token
is supplied by a test subclass to avoid credential lookup. Assertions cover the
outgoing endpoint and complete query, including type filtering, delta knowledge,
and omission of `until_date`. SDK method mocks cannot detect argument-order
errors in the SDK's URL serialization.

Run the full suite with `bun run test --run`, which uses Vitest's isolated module
mocks. Bun's native test runner does not implement the same Vitest APIs or mock
isolation. Authentication tests keep the real config implementation but redirect
its storage to a temporary directory so they cannot modify user preferences.
