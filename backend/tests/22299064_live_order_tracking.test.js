// ─────────────────────────────────────────────────────────────────────────────
// PayOnceBro — Member 1: Live Order Tracking (Feature 5)
//
// Course   : CSE 470 — Software Quality Assurance
// Student  : 22299064
// Feature  : Live Order Tracking (User Ordering System)
//
// Endpoints under test (all endpoints associated with this feature):
//   GET /api/order-tracking/:id            → tracking details for an order
//   GET /api/order-tracking/:id/history    → status-change history for an order
//
// Authentication policy:
//   The assignment forbids hardcoded tokens. This file logs in a real test
//   user via POST /api/auth/login inside `beforeAll`, captures the Supabase
//   access token from the response, and reuses it for every authenticated
//   request. Credentials come from environment variables (.env.test) so the
//   suite never carries a literal password in source.
//
// Test categories per the spec:
//   (A) Positive flow    — happy-path success responses
//   (B) Negative flow    — validation errors, not-found, ownership checks
//   (C) Security / bounds — missing or invalid Authorization headers
//
// NOTE on module syntax:
//   The PayOnceBro backend's package.json sets `"type": "module"`, so this
//   file uses ESM `import` syntax. Jest handles ESM via the
//   `--experimental-vm-modules` flag wired into the `test` script.
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import request from 'supertest';
import { createClient } from '@supabase/supabase-js';
import { jest, describe, it, beforeAll, afterAll, expect } from '@jest/globals';

// Load test-only environment variables BEFORE importing the app, because
// app.js reads from process.env at import time.
dotenv.config({ path: '.env.test' });

// The Express app is imported WITHOUT calling app.listen — Supertest binds
// to a free port internally so the suite can run alongside `npm run dev`.
// In the project, app.js does `export default app` (ESM default export).
const { default: app } = await import('../app.js');

// Admin Supabase client used only by test setup/teardown to seed and clean
// up rows. The service role key bypasses RLS so we can insert an order row
// owned by the test user and a second row owned by someone else (used to
// verify ownership enforcement).
const adminDb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

describe('Feature: Live Order Tracking (Student ID: 22299064)', () => {
  // Shared state populated by beforeAll
  let authToken = '';          // access token for the test user
  let testUserId = '';         // profiles.id of the test user
  let testOrderId = '';        // order owned by the test user (happy path)
  let foreignOrderId = '';     // order owned by a different user (403 test)
  let foreignUserId = '';      // profiles.id of the "other" user

  // A UUID that is syntactically valid but doesn't exist in the DB. Used
  // for the 404 case so the controller reaches the lookup, not the
  // type-validation guard.
  const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

  // Bumped Jest's per-hook timeout because Supabase round-trips are network calls.
  jest.setTimeout(30000);

  // ── PRE-CONDITION: programmatic authentication ─────────────────────────
  beforeAll(async () => {
    // 1. Sign in the existing test user. The seed step (npm run seed:test)
    //    creates this account once before the suite runs; we never embed
    //    the password in source.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body).toHaveProperty('session.access_token');

    authToken = loginRes.body.session.access_token;
    testUserId = loginRes.body.user.id;

    // 2. Look up the "foreign" user that the seed inserted. This is a
    //    second, separately-signed-up user whose orders should be
    //    invisible to our test user.
    const { data: foreignProfile, error: foreignErr } = await adminDb
      .from('profiles')
      .select('id')
      .eq('email', process.env.TEST_FOREIGN_EMAIL)
      .single();

    expect(foreignErr).toBeNull();
    foreignUserId = foreignProfile.id;

    // 3. Insert two orders directly via the service-role client — one owned
    //    by the test user (used for positive-flow tests) and one owned by
    //    the foreign user (used to prove the ownership check rejects it).
    //    Doing this in setup keeps the tracking tests deterministic — they
    //    don't depend on /api/orders also being green.
    const ownOrderInsert = await adminDb
      .from('orders')
      .insert({
        user_id: testUserId,
        status: 'preparing',
        total_amount: 450,
        delivery_fee: 50,
        is_cluster: false,
        user_lat: 23.7808,
        user_lng: 90.4154,
        estimated_time: 32,
      })
      .select('id')
      .single();

    expect(ownOrderInsert.error).toBeNull();
    testOrderId = ownOrderInsert.data.id;

    const foreignOrderInsert = await adminDb
      .from('orders')
      .insert({
        user_id: foreignUserId,
        status: 'pending',
        total_amount: 300,
        delivery_fee: 40,
        is_cluster: false,
        user_lat: 23.7808,
        user_lng: 90.4154,
        estimated_time: 25,
      })
      .select('id')
      .single();

    expect(foreignOrderInsert.error).toBeNull();
    foreignOrderId = foreignOrderInsert.data.id;

    // 4. Seed a single status-history row on our own order so the history
    //    endpoint has something to return. Other rows may have been written
    //    by the orderController during normal operation; we only need at
    //    least one to assert non-empty.
    await adminDb.from('order_status_history').insert({
      order_id: testOrderId,
      status: 'preparing',
      changed_by: testUserId,
    });
  }, 30000);

  // ── CLEANUP ────────────────────────────────────────────────────────────
  afterAll(async () => {
    // Delete in child-first order to satisfy FK constraints.
    if (testOrderId) {
      await adminDb.from('order_status_history').delete().eq('order_id', testOrderId);
      await adminDb.from('orders').delete().eq('id', testOrderId);
    }
    if (foreignOrderId) {
      await adminDb.from('order_status_history').delete().eq('order_id', foreignOrderId);
      await adminDb.from('orders').delete().eq('id', foreignOrderId);
    }
  }, 30000);

  // ═══════════════════════════════════════════════════════════════════════
  // ENDPOINT 1: GET /api/order-tracking/:id  (tracking details)
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/order-tracking/:id', () => {
    // ── (A) POSITIVE FLOW ────────────────────────────────────────────────
    it('Test 1: should return 200 and the order details for the owner', async () => {
      const res = await request(app)
        .get(`/api/order-tracking/${testOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      // Response shape contract from orderTrackingController.getTrackingDetails
      expect(res.body).toHaveProperty('order');
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('cluster');
      expect(res.body).toHaveProperty('rider');
      expect(res.body.order.id).toBe(testOrderId);
      expect(res.body.order.user_id).toBe(testUserId);
      expect(res.body.order.status).toBe('preparing');
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    // ── (B) NEGATIVE FLOW: not found ─────────────────────────────────────
    it('Test 2: should return 404 when the order ID does not exist', async () => {
      const res = await request(app)
        .get(`/api/order-tracking/${NON_EXISTENT_UUID}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message.toLowerCase()).toMatch(/not found/);
    });

    // ── (B) NEGATIVE FLOW: validation error on malformed ID ──────────────
    it('Test 3: should return 400 when the order ID is not a valid UUID', async () => {
      const res = await request(app)
        .get('/api/order-tracking/not-a-real-uuid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('message');
    });

    // ── (B) NEGATIVE FLOW: ownership violation ───────────────────────────
    it("Test 4: should return 403 when fetching another user's order", async () => {
      // The order exists, the auth is valid — but the order belongs to a
      // different user. The controller must reject the request.
      const res = await request(app)
        .get(`/api/order-tracking/${foreignOrderId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body).toHaveProperty('message');
    });

    // ── (C) SECURITY & BOUNDARY: missing token ───────────────────────────
    it('Test 5: should return 401 when no Authorization header is sent', async () => {
      const res = await request(app).get(`/api/order-tracking/${testOrderId}`);

      expect(res.statusCode).toBe(401);
    });

    // ── (C) SECURITY & BOUNDARY: malformed token ─────────────────────────
    it('Test 6: should return 401 when the bearer token is invalid', async () => {
      const res = await request(app)
        .get(`/api/order-tracking/${testOrderId}`)
        .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

      expect(res.statusCode).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // ENDPOINT 2: GET /api/order-tracking/:id/history  (status timeline)
  // ═══════════════════════════════════════════════════════════════════════
  describe('GET /api/order-tracking/:id/history', () => {
    // ── (A) POSITIVE FLOW ────────────────────────────────────────────────
    it('Test 7: should return 200 and an array of status history entries', async () => {
      const res = await request(app)
        .get(`/api/order-tracking/${testOrderId}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('history');
      expect(Array.isArray(res.body.history)).toBe(true);
      // Setup inserted at least one row, so the array must be non-empty.
      expect(res.body.history.length).toBeGreaterThan(0);

      // Every entry must reference the correct order and carry a status.
      const entry = res.body.history[0];
      expect(entry.order_id).toBe(testOrderId);
      expect(entry).toHaveProperty('status');
    });

    // ── (B) NEGATIVE FLOW: not found ─────────────────────────────────────
    it('Test 8: should return 404 when requesting history for a non-existent order', async () => {
      const res = await request(app)
        .get(`/api/order-tracking/${NON_EXISTENT_UUID}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(404);
    });

    // ── (B) NEGATIVE FLOW: ownership violation ───────────────────────────
    it("Test 9: should return 403 when reading another user's order history", async () => {
      const res = await request(app)
        .get(`/api/order-tracking/${foreignOrderId}/history`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(403);
    });

    // ── (C) SECURITY & BOUNDARY: missing token ───────────────────────────
    it('Test 10: should return 401 when no Authorization header is sent', async () => {
      const res = await request(app).get(
        `/api/order-tracking/${testOrderId}/history`
      );

      expect(res.statusCode).toBe(401);
    });
  });
});
