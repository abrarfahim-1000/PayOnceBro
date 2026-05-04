# Member 1 — Live Order Tracking: Unit Test Suite

**Course:** CSE 470 — Software Quality Assurance
**Assignment:** Backend Unit Testing Integration
**Student ID:** 22299064
**Feature under test:** Live Order Tracking (Member 1, Feature 5 from the SRS)

---

## What this submission contains

```
22299064.zip
├── README.md                                              ← you are here
├── backend/
│   ├── tests/
│   │   └── 22299064_live_order_tracking.test.js           ← the test file
│   ├── jest.config.cjs                                    ← Jest configuration
│   ├── scripts/
│   │   └── seed-test-users.js                             ← idempotent test-user seed
│   └── .env.test.example                                  ← env template (no secrets)
└── screenshots/
    └── tests-passing.png                                  ← terminal screenshot (add yours)
```

The intended placement inside the project repo mirrors this `backend/` subtree, matching the structure required in §2 of the assignment.

---

## Why this feature

The assignment requires tests for **one specific feature** the student developed. The feature chosen is **Live Order Tracking**, one of Member 1's five SRS features. It owns two dedicated API endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /api/order-tracking/:id` | Returns the full tracking payload (order row, line items, cluster info, rider info) for one order. |
| `GET /api/order-tracking/:id/history` | Returns the chronological list of status changes for one order, used to render the customer-side status timeline. |

Both endpoints live in `backend/controllers/orderTrackingController.js` and `backend/routes/orderTrackingRoutes.js`. Both require an authenticated user, and both must reject any attempt to read an order the caller does not own.

The suite tests **all** endpoints associated with this feature, fulfilling §3.2 of the assignment.

---

## Module-system note (important)

The PayOnceBro backend's `package.json` sets `"type": "module"`, which makes every `.js` file an ES module. The test file and seed script in this submission therefore use `import`/`export` syntax (not CommonJS `require`). Jest itself doesn't natively support ESM yet, so the `test` script below passes the `--experimental-vm-modules` flag.

The Jest config is named `jest.config.cjs` (not `.js`) so it stays CommonJS even though the rest of the package is ESM.

---

## How to run the suite (step by step)

### Step 1 — Install Jest, Supertest, and dotenv in the backend

From the backend folder of the project repo:

```bash
cd backend
npm install --save-dev jest supertest dotenv
```

`@supabase/supabase-js` is already a dependency of the project, so nothing extra is needed for it.

### Step 2 — Drop the test files into the repo

Copy these files from this submission into the matching paths inside the repo:

| File from this zip | Path in repo |
|---|---|
| `backend/tests/22299064_live_order_tracking.test.js` | `backend/tests/22299064_live_order_tracking.test.js` |
| `backend/jest.config.cjs` | `backend/jest.config.cjs` |
| `backend/scripts/seed-test-users.js` | `backend/scripts/seed-test-users.js` |
| `backend/.env.test.example` | `backend/.env.test.example` |

### Step 3 — Add the `test` and `seed:test` scripts to `backend/package.json`

Open `backend/package.json` and add these two entries to the `"scripts"` block:

```json
"scripts": {
  "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand",
  "seed:test": "node scripts/seed-test-users.js"
}
```

- `--experimental-vm-modules` enables Jest's ESM mode so `import` works inside tests.
- `--runInBand` forces sequential execution, which avoids races when multiple suites hit the same Supabase project at once.

> If your existing `package.json` already has a `"test"` script (e.g., the default placeholder Node generates), replace it with the line above.

### Step 4 — Create `.env.test` from the template

```bash
cp .env.test.example .env.test
```

(On Windows PowerShell: `Copy-Item .env.test.example .env.test`.)

Open `.env.test` and fill in the real values:

- `SUPABASE_URL` — same URL the dev backend uses
- `SUPABASE_SERVICE_ROLE_KEY` — the service-role key from your Supabase dashboard (Settings → API)
- `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` — any test credentials you choose; the seed script will create the account
- `TEST_FOREIGN_EMAIL`, `TEST_FOREIGN_PASSWORD` — same, for the second user

> **Make sure `.env.test` is in `.gitignore`.** This is the only file that holds credentials. The test source never embeds them.

### Step 5 — Seed the two test users (one time only)

```bash
npm run seed:test
```

Expected output:

```
Created user:   test.member1@payoncebro.test
Created user:   test.foreign@payoncebro.test

Seed complete. You can now run: npm test
```

The script is idempotent — running it again just refreshes both passwords.

### Step 6 — Run the test suite

```bash
npm test
```

Expected: **10 tests, all passing, in green ticks.** A screenshot of this output is the second deliverable per §6 of the assignment.

---

## What each test is doing

The suite is split into two `describe` blocks, one per endpoint. Inside each block the tests follow the assignment's three categories: positive flow (Case A), negative flow (Case B), and security/boundary (Case C).

### `beforeAll` — programmatic authentication and setup

Runs once before any test:

1. Calls `POST /api/auth/login` with the test user's credentials from `.env.test`. Captures the Supabase access token from the response and stores it in `authToken`. **No token is hardcoded** — this satisfies §3.3 of the assignment.
2. Looks up the foreign user's profile ID via the service-role Supabase client (so the suite knows whose order to insert as the "other person's" order).
3. Inserts two rows directly into the `orders` table — one owned by the test user (used for happy-path tests) and one owned by the foreign user (used to prove the ownership check rejects cross-user reads). Doing this in setup keeps the tracking tests deterministic; they don't depend on `POST /api/orders` also being green.
4. Inserts one row into `order_status_history` so the history endpoint has something non-empty to return.

### `afterAll` — cleanup

Deletes the seeded `order_status_history` rows first (FK child) and then the `orders` rows so the database returns to its prior state.

### Endpoint 1 — `GET /api/order-tracking/:id`

| # | Test name | What it verifies |
|---|---|---|
| 1 | should return 200 and the order details for the owner | **Positive flow.** Sends a valid bearer token + the test user's own order ID. Asserts status 200, that the response carries `order`, `items`, `cluster`, `rider` keys, and that `order.id` and `order.user_id` match what was seeded. |
| 2 | should return 404 when the order ID does not exist | **Negative — not found.** Sends a syntactically valid UUID that no row has. Asserts status 404 and that the response carries a `message` containing "not found". |
| 3 | should return 400 when the order ID is not a valid UUID | **Negative — validation error.** Sends a malformed string (`not-a-real-uuid`) as the path parameter. Asserts status 400. This proves the controller rejects bad input before hitting the database. |
| 4 | should return 403 when fetching another user's order | **Negative — ownership violation.** Sends the test user's bearer token but the foreign user's order ID. Asserts status 403. This is the most important security check on this endpoint. |
| 5 | should return 401 when no Authorization header is sent | **Security & boundary.** Sends the same valid order ID but with no header at all. Asserts status 401. |
| 6 | should return 401 when the bearer token is invalid | **Security & boundary.** Sends a junk JWT in the header. Asserts status 401, proving the auth middleware rejects malformed tokens. |

### Endpoint 2 — `GET /api/order-tracking/:id/history`

| # | Test name | What it verifies |
|---|---|---|
| 7 | should return 200 and an array of status history entries | **Positive flow.** Asserts status 200, that `history` is an array, that it is non-empty (because `beforeAll` inserted one row), and that the first entry's `order_id` matches the test order. |
| 8 | should return 404 when requesting history for a non-existent order | **Negative — not found.** Same logic as Test 2 but on the history sub-route. |
| 9 | should return 403 when reading another user's order history | **Negative — ownership violation.** Same logic as Test 4 but on the history sub-route. Critical: history must respect the same ownership rule as details. |
| 10 | should return 401 when no Authorization header is sent | **Security & boundary.** Same as Test 5 for the history sub-route. |

### Mapping back to the assignment's required cases

| Assignment case | Tests in this suite |
|---|---|
| Case A — Positive flow (Test 1: Create / Test 2: Retrieve) | Tests 1 and 7 |
| Case B — Validation error / Resource not found | Tests 2, 3, 8 (not-found) and Test 3 (validation error). Tests 4 and 9 cover the ownership variant. |
| Case C — Unauthorized access (401 / 403) | Tests 5, 6, 10 (401) and Tests 4, 9 (403) |

---

## Notes on a few design choices

**Why programmatic login and not a hardcoded JWT.** §3.3 of the assignment explicitly forbids hardcoded tokens. The suite calls `/api/auth/login` in `beforeAll`, capturing a fresh token for the session. The credentials come from `.env.test`, so the token-generation flow is real, but no secret leaks into source.

**Why I seed orders directly into Supabase via the service-role client instead of going through `POST /api/orders`.** Two reasons. First, isolation — the tracking suite should fail only when tracking is broken, not when the order-placement controller is. Second, control — direct inserts let me create an order owned by a *different* user to test the 403 case, which the public order-placement endpoint cannot do (it always uses the caller's identity).

**Why two endpoints get one test file.** The assignment says "one specific feature, all endpoints associated with that feature." Live Order Tracking is one feature with two endpoints, so they live together in one file. The two endpoints are split by `describe` blocks for readability.

**Why a 30-second test timeout.** Supabase calls go over the network. The default 5-second Jest timeout caused intermittent failures on slower connections.

---

## Troubleshooting

**`ReferenceError: require is not defined in ES module scope`** — the project's `package.json` has `"type": "module"`. Make sure you're using the files from this submission (which use `import`), not an older copy that used `require`. The Jest config must be `jest.config.cjs`, not `jest.config.js`.

**`Jest encountered an unexpected token` when running `npm test`** — the `--experimental-vm-modules` flag is missing from the `test` script in `package.json`. See Step 3.

**`Cannot find module '../app.js'`** — the test file imports `../app.js` (relative to `backend/tests/`). Verify the entry point in your repo really is `backend/app.js`. If it's named differently (e.g., `index.js`), update the import line at the top of the test file.

**Login test fails with 401** — the seed script hasn't been run yet, or `.env.test` has the wrong credentials. Run `npm run seed:test` and recheck the values.

---

## Submission checklist (per §6 of the assignment)

- [x] **Source code of the test file** — `backend/tests/22299064_live_order_tracking.test.js`
- [ ] **Screenshot of the terminal showing the suite passing** — replace `screenshots/tests-passing.png` with your own after running `npm test`
- [x] **Zip filename** — `22299064.zip`
