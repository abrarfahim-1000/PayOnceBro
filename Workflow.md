# PayOnceBro — Master Project Workflow Document (v3)
> **Tech Stack:** React.js · Node.js + Express.js · Supabase (PostgreSQL) · Gemini API  
> **Architecture:** MVC (Model → Service → Controller → Route → Frontend Service → View)  
> **Methodology:** Agile — 4 Sprints, 4 Members working in parallel  
> **Purpose:** This is the mother document. Use this as the single source of truth throughout the entire project.

---

## Team Structure

| Member | Domain | Features (5 each) |
|--------|--------|-------------------|
| Member A | **User Ordering System** | F1 Smart Food Search · F2 AI-Based Restaurant Clustering · F3 Multi-Restaurant Cart · F4 AI Delivery Time Prediction · F5 Live Order Tracking |
| Member B | **Rider System** | F6 Rider Dashboard · F7 AI Route Optimization · F8 Delivery Status Update · F9 Rider Rating System · F10 AI Area Demand Detection |
| Member C | **Restaurant System** | F11 Restaurant Dashboard · F12 Menu Management · F13 AI Menu Auto-Tagging & Dietary Profiling · F14 Restaurant Rating System · F15 Gemini-Powered "Vibe Check" Review Summaries |
| Member D | **AI & System Intelligence** | F16 AI Food Recommendation System · F17 Cross-Restaurant AI Combo Builder · F18 Dynamic Delivery Fee Engine · F19 Order Aggregation Engine · F20 Analytics Dashboard |

> **Important:** Member D owns the Gemini client setup (`geminiService.js`), order placement backend, rider assignment logic, and shared infrastructure (fee engine, aggregation). Other members **call** Member D's services where needed — they never rewrite them. Each member builds their own features end-to-end (backend + frontend) within their domain.

### Contract Alignment Note (Canonical Roles)
- Canonical roles across backend/frontend are: `user`, `rider`, `restaurant_owner`, `admin`.
- Legacy `restaurant` values should be normalized to `restaurant_owner` for compatibility, but new writes and route guards must use `restaurant_owner`.

---

## Sprint Philosophy

Each sprint delivers **exactly 5 features**. Since there are 4 members, one member takes on **2 features** per sprint (double duty), rotating so every member pulls double exactly once:

| Sprint | Phase | Double Duty | Features |
|--------|-------|-------------|----------|
| **Sprint 1** | Foundation | Member C (F11 + F12) | F1, F6, F11, F12, F18 |
| **Sprint 2** | Core Transactions | Member A (F2 + F3) | F2, F3, F8, F14, F19 |
| **Sprint 3** | Full Order Lifecycle | Member B (F7 + F9) | F5, F7, F9, F13, F20 |
| **Sprint 4** | AI & Polish | Member D (F16 + F17) | F4, F10, F15, F16, F17 |

**Cumulative progress:** Sprint 1 → 5 features | Sprint 2 → 10 features | Sprint 3 → 15 features (complete) | Sprint 4 → pending

---

## Folder Structure

> All members work within this structure. `frontend/` = React app. `backend/` = Node/Express app. Every file you create belongs somewhere here — if it doesn't fit, discuss with the team before inventing new folders.

```
payoncebro/
│
├── frontend/                                   # React (Vite) — Member A owns pages/user, B owns pages/rider, etc.
│   └── src/
│       ├── assets/                             # Images, icons, static files
│       │
│       ├── components/                         # Reusable UI components (never full pages)
│       │   ├── common/                         # Shared across all roles
│       │   │   ├── ProtectedRoute.jsx          # Auth + role guard wrapper (Member D)
│       │   │   ├── StarRating.jsx              # 1–5 star input widget (Member B / Member C)
│       │   │   └── Spinner.jsx                 # Loading indicator
│       │   ├── user/                           # Member A
│       │   │   ├── SearchBar.jsx
│       │   │   ├── FoodCard.jsx
│       │   │   ├── CartItem.jsx
│       │   │   ├── CartSummary.jsx
│       │   │   ├── ClusterBanner.jsx
│       │   │   ├── ETADisplay.jsx
│       │   │   ├── DeliveryFeeSummary.jsx
│       │   │   ├── StatusTimeline.jsx
│       │   │   ├── RatingModal.jsx
│       │   │   └── VibeCheckCard.jsx
│       │   ├── rider/                          # Member B
│       │   │   ├── AssignmentCard.jsx
│       │   │   ├── EarningsSummary.jsx
│       │   │   ├── StopList.jsx
│       │   │   ├── NavigationButton.jsx
│       │   │   ├── StatusButtons.jsx
│       │   │   ├── RatingDisplay.jsx
│       │   │   ├── LocationTracker.jsx
│       │   │   └── DemandNotification.jsx
│       │   ├── restaurant/                     # Member C
│       │   │   ├── OrderCard.jsx
│       │   │   ├── OrderList.jsx
│       │   │   ├── OrderActionButtons.jsx
│       │   │   ├── PrepTimer.jsx
│       │   │   ├── MenuItemCard.jsx
│       │   │   ├── MenuItemForm.jsx
│       │   │   ├── DeleteConfirmModal.jsx
│       │   │   ├── AiTagBadge.jsx
│       │   │   ├── ReviewList.jsx
│       │   │   └── ReviewResponseForm.jsx
│       │   └── admin/                          # Member D
│       │       ├── StatCard.jsx
│       │       ├── RevenueChart.jsx
│       │       ├── RecommendationCarousel.jsx
│       │       ├── ComboResult.jsx
│       │       └── DemandHeatmap.jsx
│       │
│       ├── pages/                              # Full route-level pages (one per route)
│       │   ├── auth/                           # Member D
│       │   │   ├── Login.jsx
│       │   │   └── Register.jsx
│       │   ├── user/                           # Member A
│       │   │   ├── Home.jsx
│       │   │   ├── Search.jsx
│       │   │   ├── RestaurantProfile.jsx
│       │   │   ├── Cart.jsx
│       │   │   ├── OrderConfirmation.jsx
│       │   │   └── OrderTracking.jsx
│       │   ├── rider/                          # Member B
│       │   │   ├── Dashboard.jsx
│       │   │   └── RouteView.jsx
│       │   ├── restaurant/                     # Member C
│       │   │   ├── Dashboard.jsx
│       │   │   └── MenuManagement.jsx
│       │   └── admin/                          # Member D
│       │       ├── Analytics.jsx
│       │       └── ComboBuilder.jsx
│       │
│       ├── layouts/                            # Persistent nav/sidebar shells per role
│       │   ├── UserLayout.jsx                  # Member A
│       │   ├── RiderLayout.jsx                 # Member B
│       │   ├── RestaurantLayout.jsx            # Member C
│       │   └── AdminLayout.jsx                 # Member D
│       │
│       ├── context/                            # Global React state (Member D creates, all consume)
│       │   ├── AuthContext.jsx                 # JWT, user object, role — Member D
│       │   └── CartContext.jsx                 # Cart items, cluster status, totals — Member A
│       │
│       ├── hooks/                              # Custom React hooks (one concern per hook)
│       │   ├── useOrderTracking.js             # Supabase realtime on orders — Member A
│       │   ├── useRiderAssignment.js           # Supabase realtime on rider assignments — Member B
│       │   ├── useRiderLocation.js             # Geolocation + polling — Member B
│       │   ├── useRiderNotifications.js        # Supabase realtime on notifications — Member B
│       │   ├── useRestaurantOrders.js          # Supabase realtime on restaurant orders — Member C
│       │   └── useRealtimeSubscription.js      # Generic reusable realtime hook — Member D
│       │
│       ├── services/                           # Axios API call functions (talk to backend)
│       │   ├── api.js                          # Base axios instance + JWT interceptor — Member D
│       │   ├── authService.js                  # register, login, getMe — Member D
│       │   ├── searchService.js                # search, getRestaurant — Member A
│       │   ├── orderService.js                 # placeOrder, getOrder, getMyOrders — Member A
│       │   ├── aiService.js                    # buildCombo, getRecommendations — Member D
│       │   ├── deliveryService.js              # getFee, getETA — Member A
│       │   ├── riderService.js                 # getAssignments, getEarnings, updateLocation — Member B
│       │   ├── ratingService.js                # submitRating, submitResponse — Member B / Member C
│       │   └── menuService.js                  # getMenu, createItem, updateItem, deleteItem — Member C
│       │
│       ├── utils/                              # Pure helper functions (no API calls, no state)
│       │   └── formatCurrency.js               # e.g. formatTk(120) → "৳120"
│       │
│       ├── App.jsx                             # Route definitions — Member D sets up, all add routes
│       └── main.jsx                            # Vite entry point
│
├── backend/                                    # Node.js + Express — MVC pattern
│   │
│   ├── config/                                 # External client initialisation (Member D)
│   │   ├── db.js                               # Supabase client
│   │   └── gemini.js                           # Gemini API client
│   │
│   ├── models/                                 # DATA LAYER — raw Supabase queries only, no logic
│   │   ├── userModel.js                        # findByEmail, create — Member D
│   │   ├── riderModel.js                       # getAvailable, setAvailable, updateLocation — Member B
│   │   ├── restaurantModel.js                  # getById, getAll, getByIds, getByOwner — Member C
│   │   ├── menuModel.js                        # searchItems, getByRestaurant, create, update, delete, updateTags — Member C
│   │   ├── orderModel.js                       # create, createItems, getById, updateStatus, getByUser — Member D
│   │   ├── clusterModel.js                     # create, getByOrder, assignRider — Member D
│   │   ├── ratingModel.js                      # create, updateRiderAvg, updateRestaurantAvg, addResponse — Member C creates, Member B extends
│   │   ├── notificationModel.js                # create, createAdminAlert, markRead — Member D
│   │   └── addressModel.js                     # create, getByUser, setDefault — Member A
│   │
│   ├── services/                               # BUSINESS LOGIC — algorithms, AI calls, calculations
│   │   ├── clusteringService.js                # evaluateCluster, sortByProximity, getNearbyClusteredRestaurants — Member A
│   │   ├── routeService.js                     # optimizeRoute (nearest neighbour) — Member B
│   │   ├── deliveryFeeService.js               # calculate (cluster vs non-cluster) — Member D
│   │   ├── estimationService.js                # estimateTime (prep + travel + buffer) — Member A
│   │   ├── riderAssignmentService.js           # findBestRider (nearest available) — Member D
│   │   ├── demandService.js                    # analyzeZones (background job) — Member B
│   │   ├── recommendationService.js            # getRecommendations (popular, together, cluster) — Member D
│   │   ├── analyticsService.js                 # getAnalytics (aggregation queries) — Member D
│   │   └── geminiService.js                    # generateMenuTags, generateVibeSummary, buildCombo — Member D
│   │
│   ├── controllers/                            # REQUEST HANDLERS — validate input, call services/models, send response
│   │   ├── authController.js                   # register, login, getMe — Member D
│   │   ├── searchController.js                 # search — Member A
│   │   ├── orderController.js                  # placeOrder, getById, getByUser, updateStatus — Member D
│   │   ├── clusterController.js                # checkCluster — Member A
│   │   ├── deliveryController.js               # calculateFee (Member D), estimateTime (Member A adds in Sprint 4)
│   │   ├── riderController.js                  # getAssignments, getEarnings, updateLocation, getRoute — Member B
│   │   ├── restaurantController.js             # getById, getAll, getOrders, getVibeSummary — Member C
│   │   ├── menuController.js                   # getByRestaurant, create, update, delete, toggleAvailability — Member C
│   │   ├── ratingController.js                 # create, addResponse — Member C creates, Member B extends
│   │   ├── aiController.js                     # buildCombo — Member D
│   │   ├── recommendationController.js         # getRecommendations — Member D
│   │   └── adminController.js                  # getAnalytics, getDemandZones — Member D
│   │
│   ├── routes/                                 # URL → controller mapping (one file per domain)
│   │   ├── authRoutes.js                       # Member D
│   │   ├── searchRoutes.js                     # Member A
│   │   ├── orderRoutes.js                      # Member D
│   │   ├── clusterRoutes.js                    # Member A
│   │   ├── deliveryRoutes.js                   # Member D (fee), Member A adds ETA route in Sprint 4
│   │   ├── riderRoutes.js                      # Member B
│   │   ├── restaurantRoutes.js                 # Member C
│   │   ├── menuRoutes.js                       # Member C
│   │   ├── ratingRoutes.js                     # Member C creates, Member B extends
│   │   ├── aiRoutes.js                         # Member D
│   │   ├── recommendationRoutes.js             # Member D
│   │   └── adminRoutes.js                      # Member D
│   │
│   ├── middleware/                             # Express middleware (Member D creates, all use)
│   │   ├── authMiddleware.js                   # protect — verifies JWT, attaches req.user
│   │   ├── roleMiddleware.js                   # restrictTo('rider') — role-based access
│   │   └── errorMiddleware.js                  # global error handler
│   │
│   ├── utils/                                  # Pure backend helpers (no DB, no API calls)
│   │   └── geoUtils.js                         # haversineDistance — Member A
│   │
│   └── app.js                                  # Express init, middleware stack, route mounting — Member D
│
├── .env                                        # Never commit — Member D shares values privately
├── .gitignore
└── package.json
```

> **Rule:** Models contain only DB queries. Services contain only logic. Controllers contain only request/response handling. If you find yourself writing a Supabase query inside a controller, move it to the model. If you find yourself writing a `for` loop or algorithm inside a controller, move it to a service.

---

## Database Schema (Create Before Sprint 1 — All Members)

> Member D sets up the Supabase project and shares credentials with the team. All members create their tables in the same instance.

```sql
-- AUTH
users (id UUID PK, name TEXT, email TEXT UNIQUE, password_hash TEXT, role TEXT CHECK(role IN ('user','rider','restaurant','admin')), created_at TIMESTAMPTZ DEFAULT NOW())

-- USER CLASS
notifications (id UUID PK, user_id UUID FK users, message TEXT, type TEXT, is_read BOOL DEFAULT FALSE, created_at TIMESTAMPTZ)

-- RIDER CLASS
riders (id UUID PK, user_id UUID FK users, current_lat FLOAT, current_lng FLOAT, is_available BOOL DEFAULT TRUE, avg_rating FLOAT DEFAULT 0, total_deliveries INT DEFAULT 0)

-- RESTAURANT CLASS
restaurants (id UUID PK, owner_id UUID FK users, name TEXT, address TEXT, lat FLOAT, lng FLOAT, avg_prep_time INT, max_capacity_per_hour INT, is_active BOOL DEFAULT TRUE, avg_rating FLOAT DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())
menu_items (id UUID PK, restaurant_id UUID FK restaurants, name TEXT, description TEXT, price FLOAT, category TEXT, is_available BOOL DEFAULT TRUE, ai_tags JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT NOW())

-- AI & ADMIN CLASS (shared, used by all)
clusters (id UUID PK, restaurant_ids JSONB, rider_id UUID FK riders NULLABLE, is_active BOOL DEFAULT TRUE, created_at TIMESTAMPTZ)
orders (id UUID PK, user_id UUID FK users, rider_id UUID FK riders NULLABLE, cluster_id UUID FK clusters NULLABLE, status TEXT CHECK(status IN ('pending','accepted','preparing','pickup','on_the_way','delivered','cancelled')), total_price FLOAT, delivery_fee FLOAT, estimated_time INT, created_at TIMESTAMPTZ DEFAULT NOW())
order_items (id UUID PK, order_id UUID FK orders, menu_item_id UUID FK menu_items, restaurant_id UUID FK restaurants, quantity INT, price_at_order FLOAT)

-- SHARED
ratings (id UUID PK, order_id UUID FK orders, rated_by UUID FK users, rider_id UUID FK riders NULLABLE, restaurant_id UUID FK restaurants NULLABLE, score INT CHECK(score BETWEEN 1 AND 5), review_text TEXT, created_at TIMESTAMPTZ)
```

### Runtime Schema Additions Required By Current Sprint 1-3 Code
The live implementation uses a few additional tables/columns beyond the baseline schema above:

```sql
-- Used by auth/session profile hydration
profiles (id UUID PK = auth user id, role TEXT default user, username, full_name, email, delivery_lat and delivery_lng nullable, created_at TIMESTAMPTZ DEFAULT NOW())

-- Used by order placement/tracking and rider route computation
orders.user_lat FLOAT
orders.user_lng FLOAT
orders.delivered_at TIMESTAMPTZ NULL

-- Used for non-blocking status timeline history
order_status_history (id UUID PK, order_id UUID FK orders, status TEXT, changed_by UUID FK users, created_at TIMESTAMPTZ DEFAULT NOW())
```

---

## Shared API Base Rules (All Members Follow)

```
Base URL: http://localhost:5000/api
Auth header: Authorization: Bearer <JWT>
Error format: { "message": "...", "stack": "..." (dev only) }
Success format: { "data": ... } or flat object depending on endpoint
```

### Status Transition Map (Member B owns enforcement, all must know)
```
pending → accepted       (Restaurant)
accepted → preparing     (Restaurant)
preparing → pickup       (Rider)
pickup → on_the_way      (Rider)
on_the_way → delivered   (Rider)
any → cancelled          (Restaurant or Admin)
```

---

---

# SPRINT 1 — Foundation
**Status:** 5 of 5 features DONE.  
**Double Duty:** Member C (F11 + F12) — already completed.  
**Shared Goal:** By end of Sprint 1, every member has: the repo cloned, `.env` set up, Supabase connected, their dashboard shell rendering after login, auth working end-to-end, and the delivery fee engine exposed as an API.

---

## S1 — Shared Setup (All Members, Day 1–2)

### Tasks
1. Member D creates the Supabase project, runs the schema SQL above, shares `.env` values.
2. All members clone the repo.
3. Run project setup:
```bash
# Root
npm init -y
npm install express dotenv cors helmet morgan bcryptjs jsonwebtoken @supabase/supabase-js

# Frontend
npm create vite@latest frontend -- --template react
cd frontend && npm install axios react-router-dom
```
4. All members create their feature branches: `feature/user`, `feature/rider`, `feature/restaurant`, `feature/ai-admin`.
5. Member D creates and merges `backend/app.js`, `backend/config/db.js`, `backend/config/gemini.js`, `backend/middleware/errorMiddleware.js`, and `frontend/src/services/api.js` into `main` before anyone else branches off.

### `backend/app.js`
```js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorMiddleware.js';

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);
export default app;
```

### `frontend/src/services/api.js`
```js
import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:5000/api' });
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export default api;
```

---

## S1 — Auth System (Member D builds, everyone uses) — NOT A FEATURE

### Goal
Register, login, JWT issue, role detection. Member D builds this entirely. Other members only consume `AuthContext` and `ProtectedRoute`. Auth is shared infrastructure, not counted among the 20 features.

### Workflow — Register
1. User fills form: name, email, password, role.
2. `POST /api/auth/register` → `authController.register`.
3. Check duplicate email via `userModel.findByEmail`.
4. Hash password with `bcryptjs`.
5. Insert into `users`. If role = `rider` → insert into `riders`. If role = `restaurant` → insert placeholder into `restaurants`.
6. Return `{ token, user }`.

### Workflow — Login
1. `POST /api/auth/login` → validate credentials → sign JWT `{ id, role }` 7d expiry → return `{ token, user }`.
2. Frontend stores token in `localStorage`, user in `AuthContext`.
3. React Router redirects by role: user→`/home`, rider→`/rider/dashboard`, restaurant→`/restaurant/dashboard`, admin→`/admin/analytics`.

### Workflow — Protected Route
1. Every protected route uses `protect` middleware: extracts Bearer token, verifies JWT, attaches `req.user = { id, role }`.
2. `restrictTo('rider')` middleware checks `req.user.role`.

### Files (Member D)
```
backend/models/userModel.js
backend/controllers/authController.js
backend/routes/authRoutes.js
backend/middleware/authMiddleware.js
backend/middleware/roleMiddleware.js
frontend/src/context/AuthContext.jsx
frontend/src/pages/auth/Login.jsx
frontend/src/pages/auth/Register.jsx
frontend/src/components/common/ProtectedRoute.jsx
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/auth/register` | None | `{ name, email, password, role }` | `{ token, user }` |
| POST | `/api/auth/login` | None | `{ email, password }` | `{ token, user }` |
| GET | `/api/auth/me` | JWT | — | `{ user }` |

### Sprint 1 Acceptance Checklist (Member D — Auth)
- [x] Duplicate email returns 400
- [x] Passwords hashed in DB
- [x] JWT valid and decodable
- [x] Role-based redirect works for all 4 roles
- [x] `GET /api/auth/me` returns 401 without token

---

## S1 — Feature 1: Smart Food Search (Member A) ✅ DONE

### Goal
Users can search for food by name, filter by price and cuisine, and see results ordered by proximity (cluster-eligible restaurants first).

### What Was Built
- Debounced search bar with price range and cuisine filters.
- `GET /api/search?q=burger&minPrice=50&maxPrice=300&cuisine=fast-food&userLat=X&userLng=Y`.
- `searchController.search` → `menuModel.searchItems(query, filters)`: full-text match on `menu_items.name` and `description`, joins `restaurants` for location, filters by availability/price/cuisine.
- Results sorted by proximity with cluster-eligible badges.
- Frontend renders results grouped by restaurant.

### Files (Member A)
```
backend/models/menuModel.js               ← searchItems(query, filters)
backend/controllers/searchController.js
backend/routes/searchRoutes.js
frontend/src/services/searchService.js
frontend/src/components/user/SearchBar.jsx
frontend/src/components/user/FoodCard.jsx
frontend/src/pages/user/Search.jsx
frontend/src/pages/user/Home.jsx
frontend/src/pages/user/RestaurantProfile.jsx
frontend/src/layouts/UserLayout.jsx
```

### API Endpoints
| Method | Path | Auth | Params | Response |
|--------|------|------|--------|----------|
| GET | `/api/search` | JWT (user) | `q, minPrice, maxPrice, cuisine, userLat, userLng` | `[{ menuItem, restaurant, isClusterEligible }]` |

### Sprint 1 Acceptance Checklist (Member A)
- [x] Typing "burger" returns all burger items across restaurants
- [x] Price filter correctly excludes items
- [x] Cluster-eligible badge appears for restaurants within 2km
- [x] Empty search returns featured/popular items
- [x] User layout with nav and all placeholder routes renders

---

## S1 — Feature 6: Rider Dashboard (Member B) ✅ DONE

### Goal
Rider sees their currently assigned order(s), pickup locations, customer address, and earnings summary. Dashboard shell with navigation.

### What Was Built
- `RiderLayout.jsx`: sidebar with Dashboard, Route, Earnings links.
- Dashboard shows assigned orders with restaurant and customer details.
- Earnings summary section.
- Routes: `/rider/dashboard`, `/rider/route` — wrapped in `ProtectedRoute role="rider"`.

### Files (Member B)
```
frontend/src/pages/rider/Dashboard.jsx
frontend/src/pages/rider/RouteView.jsx
frontend/src/layouts/RiderLayout.jsx
frontend/src/components/rider/AssignmentCard.jsx
frontend/src/components/rider/EarningsSummary.jsx
```

### Sprint 1 Acceptance Checklist (Member B)
- [x] Rider sees their layout after login
- [x] Routes render without errors
- [x] Non-rider roles cannot access `/rider/*`

---

## S1 — Feature 11: Restaurant Dashboard (Member C) ✅ DONE

### Goal
Restaurant owner sees incoming and active orders on their dashboard. Accept/reject functionality with preparation timer.

### What Was Built
- `RestaurantLayout.jsx`: sidebar with Orders, Menu, Reviews links.
- Dashboard shows incoming orders grouped by status with real-time updates via Supabase subscription.
- Order cards show items, cluster status, customer count, prep time.
- Accept/Reject buttons and preparation countdown timer.

### Files (Member C)
```
frontend/src/pages/restaurant/Dashboard.jsx
frontend/src/layouts/RestaurantLayout.jsx
frontend/src/hooks/useRestaurantOrders.js
frontend/src/components/restaurant/OrderCard.jsx
frontend/src/components/restaurant/OrderList.jsx
frontend/src/components/restaurant/OrderActionButtons.jsx
frontend/src/components/restaurant/PrepTimer.jsx
backend/controllers/restaurantController.js
backend/routes/restaurantRoutes.js
backend/models/restaurantModel.js
```

### Sprint 1 Acceptance Checklist (Member C — Dashboard)
- [x] Restaurant sees their layout after login
- [x] Orders appear grouped by status
- [x] New order appears via real-time subscription
- [x] Accept/Reject and prep timer functional

---

## S1 — Feature 12: Menu Management (Member C) ✅ DONE

### Goal
Restaurant owners can fully manage their menu items: add, edit, delete, toggle availability.

### What Was Built
- Menu management page with card grid view.
- Add/Edit form with image upload via Supabase Storage.
- Delete with confirmation.
- Toggle availability switch.
- Restaurant settings panel for prep time and capacity.

### Files (Member C)
```
frontend/src/pages/restaurant/MenuManagement.jsx
frontend/src/components/restaurant/MenuItemCard.jsx
frontend/src/components/restaurant/MenuItemForm.jsx
frontend/src/components/restaurant/DeleteConfirmModal.jsx
backend/controllers/menuController.js
backend/routes/menuRoutes.js
backend/models/menuModel.js
frontend/src/services/menuService.js
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| GET | `/api/menu/restaurant/:id` | JWT (restaurant) | — | `[menuItems with ai_tags]` |
| POST | `/api/menu` | JWT (restaurant) | `{ name, description, price, category }` | `{ menuItem }` |
| PUT | `/api/menu/:id` | JWT (restaurant) | `{ ...fields }` | `{ menuItem }` |
| DELETE | `/api/menu/:id` | JWT (restaurant) | — | `{ success }` |
| PATCH | `/api/menu/:id/availability` | JWT (restaurant) | `{ isAvailable }` | `{ menuItem }` |

### Sprint 1 Acceptance Checklist (Member C — Menu)
- [x] Only owning restaurant can edit their items
- [x] Add/Edit/Delete all functional
- [x] Unavailable items hidden from users, still visible to owner

---

## S1 — Feature 18: Dynamic Delivery Fee Engine (Member D) ✅ DONE

### Goal
Calculate delivery fees dynamically based on distance and clustering efficiency. Expose as an API endpoint so Member A's cart (Sprint 2) can call it.

### Workflow
1. `POST /api/delivery/fee` → `deliveryController.calculateFee` → `deliveryFeeService.calculate`.
2. Fee formula:
   - **Non-cluster:** `(BASE_FEE + distance × PER_KM_RATE)` per restaurant, summed.
   - **Cluster:** `BASE_FEE + (maxDistance × PER_KM_RATE) × CLUSTER_DISCOUNT_RATE`.
3. Returns `{ fee, breakdown[], savings }`.

### Files (Member D)
```
backend/services/deliveryFeeService.js    ← implement calculate fully
backend/controllers/deliveryController.js
backend/routes/deliveryRoutes.js
backend/utils/geoUtils.js                ← haversineDistance helper
```

### `geoUtils.js` — Haversine (implement fully in Sprint 1)
```js
export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};
```

### `deliveryFeeService.calculate`
```js
import { haversineDistance } from '../utils/geoUtils.js';

const BASE_FEE = Number(process.env.BASE_DELIVERY_FEE) || 20;
const PER_KM   = Number(process.env.PER_KM_RATE) || 10;
const DISCOUNT  = Number(process.env.CLUSTER_DISCOUNT_RATE) || 0.6;

export const calculate = (restaurants, userLat, userLng, isCluster) => {
  const distances = restaurants.map(r => ({
    id: r.id,
    name: r.name,
    distance: haversineDistance(r.lat, r.lng, userLat, userLng)
  }));

  if (!isCluster) {
    const breakdown = distances.map(d => ({
      restaurantId: d.id,
      fee: BASE_FEE + d.distance * PER_KM
    }));
    const fee = breakdown.reduce((sum, b) => sum + b.fee, 0);
    return { fee, breakdown, savings: 0 };
  }

  const maxDist = Math.max(...distances.map(d => d.distance));
  const clusterFee = BASE_FEE + (maxDist * PER_KM) * DISCOUNT;
  const individualTotal = distances.reduce((s, d) => s + BASE_FEE + d.distance * PER_KM, 0);
  return { fee: clusterFee, breakdown: distances, savings: individualTotal - clusterFee };
};
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/delivery/fee` | JWT (user) | `{ restaurantIds[], userLat, userLng, isCluster }` | `{ fee, breakdown[], savings }` |

### `.env` Reference (Member D shares with team)
```env
PORT=5000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
JWT_SECRET=
JWT_EXPIRES_IN=7d
CLUSTER_RADIUS_KM=2
BASE_DELIVERY_FEE=20
PER_KM_RATE=10
CLUSTER_DISCOUNT_RATE=0.6
RIDER_SPEED_KMH=30
```

### Sprint 1 Acceptance Checklist (Member D — F18)
- [x] `GET /api/health` returns 200
- [x] Supabase client initializes without error
- [x] Gemini client initializes without error
- [x] Cluster fee always less than sum of individual fees
- [x] `POST /api/delivery/fee` returns correct breakdown
- [x] Fee increases proportionally with distance

---

---

# SPRINT 2 — Core Transactions
**Duration:** Week 3–4  
**Status:** 5 of 5 features DONE.  
**Double Duty:** Member A (F2 + F3)  
**Shared Goal:** Clustering and cart work end-to-end. Riders can update delivery statuses. Restaurants can be rated. Orders can be placed and aggregated.

---

## S2 — Feature 2: AI-Based Restaurant Clustering (Member A) ✅ DONE

### Goal
The system calculates distance between restaurants using location coordinates, groups them within a fixed radius (1–2 km), and suggests clustered restaurants for combined delivery. If no cluster is available, the system shows a normal ordering option.

### Workflow
1. `POST /api/cluster/check` with `{ restaurantIds, userLat, userLng }`.
2. `clusterController.checkCluster` → `restaurantModel.getByIds(ids)` → `clusteringService.evaluateCluster(restaurants)`.
3. Returns `{ eligible, restaurants, estimatedSaving }`.
4. Additionally, `clusteringService.sortByProximity(results, userLat, userLng)` is used by search (F1) to order results — update search to call this if not already done.

### Files (Member A)
```
backend/services/clusteringService.js     ← evaluateCluster, sortByProximity, getNearbyClusteredRestaurants
backend/controllers/clusterController.js
backend/routes/clusterRoutes.js
```
> Uses `geoUtils.haversineDistance` from Member D (Sprint 1).

### `clusteringService.evaluateCluster`
```js
import { haversineDistance } from '../utils/geoUtils.js';

const RADIUS = Number(process.env.CLUSTER_RADIUS_KM) || 2;

export const evaluateCluster = (restaurants, radiusKm = RADIUS) => {
  if (restaurants.length < 2) return { eligible: false };
  for (let i = 0; i < restaurants.length; i++) {
    for (let j = i + 1; j < restaurants.length; j++) {
      const dist = haversineDistance(
        restaurants[i].lat, restaurants[i].lng,
        restaurants[j].lat, restaurants[j].lng
      );
      if (dist > radiusKm) return { eligible: false };
    }
  }
  return { eligible: true };
};

export const sortByProximity = (items, userLat, userLng) => {
  return items.sort((a, b) => {
    const distA = haversineDistance(a.restaurant.lat, a.restaurant.lng, userLat, userLng);
    const distB = haversineDistance(b.restaurant.lat, b.restaurant.lng, userLat, userLng);
    return distA - distB;
  });
};

export const getNearbyClusteredRestaurants = async (userLat, userLng) => {
  // Fetch all active restaurants, filter those within cluster radius of each other
  // Used by Combo Builder (F17) in Sprint 4
};
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/cluster/check` | JWT (user) | `{ restaurantIds[], userLat, userLng }` | `{ eligible, estimatedSaving }` |

### Sprint 2 Acceptance Checklist (Member A — F2)
- [x] Two restaurants 1.5km apart → `eligible: true`
- [x] Two restaurants 3km apart → `eligible: false`
- [x] Single restaurant → `eligible: false` (no cluster needed)
- [x] Search results use `sortByProximity` for ordering

---

## S2 — Feature 3: Multi-Restaurant Cart (Member A) ✅ DONE

### Goal
Users add items from multiple restaurants into one cart. Cluster eligibility and delivery fee shown live.

### Workflow
1. User clicks "Add to Cart" on a `FoodCard` in search results.
2. `CartContext.addItem(menuItem, restaurant)` updates in-memory state.
3. `useEffect` watching `restaurants` in cart calls `POST /api/cluster/check` (F2, same sprint).
4. Cart UI shows:
   - Items grouped by restaurant.
   - Quantity controls.
   - If cluster: one combined fee line + "Save X Tk!" banner.
   - If not: individual fee per restaurant.
   - Calls `POST /api/delivery/fee` (Member D's endpoint from Sprint 1) for live totals.

### Files (Member A)
```
frontend/src/context/CartContext.jsx
frontend/src/pages/user/Cart.jsx
frontend/src/components/user/CartItem.jsx
frontend/src/components/user/CartSummary.jsx
frontend/src/components/user/ClusterBanner.jsx
frontend/src/components/user/DeliveryFeeSummary.jsx
frontend/src/services/deliveryService.js     ← getFee
```

### CartContext State Shape
```js
{
  items: [{ menuItem, restaurant, quantity }],
  clusterStatus: { eligible: bool, estimatedSaving: number },
  deliveryFee: number,
  subtotal: number,
  total: number
}
```

### Sprint 2 Acceptance Checklist (Member A — F3)
- [x] Adding items from 3 restaurants works
- [x] Cluster banner appears/disappears dynamically
- [x] Totals update live as items are added/removed
- [x] Cart persists across page navigation within session

---

## S2 — Feature 8: Delivery Status Update (Member B) ✅ DONE

### Goal
Riders can update order status (Pickup → On the Way → Delivered) via button taps on the dashboard. Also implements rider location updating.

### Workflow
1. Rider taps status button on `AssignmentCard`.
2. `PUT /api/orders/:id/status` with `{ status }`.
3. `orderController.updateStatus` (Member D's endpoint, see F19 below) validates transition using the status map.
4. Updates `orders.status` in DB.
5. Supabase broadcasts to customer tracking page.
6. On `delivered`: `riderModel.setAvailable(riderId, true)`, earnings recorded.
7. Location tracking: every 30s, `PUT /api/rider/location` with `{ lat, lng }`.

### Files (Member B)
```
frontend/src/components/rider/StatusButtons.jsx
frontend/src/hooks/useRiderLocation.js         ← geolocation + polling hook
frontend/src/components/rider/LocationTracker.jsx
backend/controllers/riderController.js         ← add updateLocation
backend/models/riderModel.js                   ← updateLocation, setAvailable
```
> `PUT /api/orders/:id/status` endpoint is built by Member D (F19). Member B only builds the UI that calls it.

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| PUT | `/api/rider/location` | JWT (rider) | `{ lat, lng }` | `{ success }` |
| GET | `/api/rider/:id/location` | JWT | — | `{ lat, lng }` |

### Sprint 2 Acceptance Checklist (Member B — F8)
- [x] Illegal status transition (e.g., pending → delivered) returns 400
- [x] Status buttons show correct next-state options
- [x] Rider marked available after delivering
- [x] Location updates in DB every 30 seconds

---

## S2 — Feature 14: Restaurant Rating System (Member C) ✅ DONE

### Goal
Customers rate food quality and leave written reviews. The system calculates an overall rating for the restaurant. Restaurants can respond to reviews.

### Workflow
1. After delivery, rating modal (Member A's `RatingModal` in Sprint 3) or separate form calls `POST /api/ratings` with `{ orderId, restaurantId, score, reviewText }`.
2. `ratingController.create` saves to `ratings` table.
3. `ratingModel.updateRestaurantAvgRating(restaurantId)` recalculates average.
4. Restaurant reviews page shows all reviews.
5. `POST /api/ratings/:id/response` saves restaurant's reply.

### Files (Member C)
```
backend/models/ratingModel.js             ← create, updateRestaurantAvg, addResponse, getByRestaurant
backend/controllers/ratingController.js
backend/routes/ratingRoutes.js
frontend/src/components/restaurant/ReviewList.jsx
frontend/src/components/restaurant/ReviewResponseForm.jsx
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/ratings` | JWT (user) | `{ orderId, restaurantId, score, reviewText }` | `{ rating }` |
| GET | `/api/ratings/restaurant/:id` | None | — | `[ratings with responses]` |
| POST | `/api/ratings/:id/response` | JWT (restaurant) | `{ responseText }` | `{ rating }` |

### Sprint 2 Acceptance Checklist (Member C — F14)
- [x] Average rating updates after each submission
- [x] Restaurant response appears threaded under review
- [x] User can rate each restaurant in a multi-order separately
- [x] Reviews page renders for restaurant owner

---

## S2 — Feature 19: Order Aggregation Engine (Member D) ✅ DONE

### Goal
The core order placement backend. Check if restaurants are within cluster radius, combine orders before rider assignment, assign a single rider to grouped restaurants, and prevent multiple riders for the same user address.

### Workflow — Place Order
1. `POST /api/orders` → `orderController.placeOrder`:
   - Validate all item IDs exist and are available.
   - Calculate final fee using `deliveryFeeService.calculate` (F18, Sprint 1).
   - `orderModel.create` → insert `orders` row (status: `pending`).
   - `orderModel.createItems` → insert `order_items` rows.
   - If `isCluster`: `clusterModel.create` → insert `clusters` row linking order + restaurant IDs.
   - Supabase broadcast to notify restaurant(s) of new order.
2. Returns `{ orderId, clusterId, deliveryFee }`.

### Workflow — Status Update (consumed by Member B and Member C)
1. `PUT /api/orders/:id/status` → `orderController.updateStatus`:
   - Validate status transition.
   - Update `orders.status`.
   - On `pending → accepted`: trigger `riderAssignmentService.findBestRider`:
     - `riderModel.getAvailable()` → all riders with `is_available = true`.
     - Compute Haversine distance to cluster centroid.
     - Select nearest rider.
     - `clusterModel.assignRider(clusterId, riderId)`.
     - `orderModel.updateRider(orderId, riderId)`.
     - `riderModel.setAvailable(riderId, false)`.
     - Supabase broadcast notifies rider's dashboard.

### Files (Member D)
```
backend/models/orderModel.js              ← create, createItems, getById, updateStatus, getByUser, updateRider
backend/models/clusterModel.js            ← create, getByOrder, assignRider
backend/controllers/orderController.js    ← placeOrder, getById, getByUser, updateStatus
backend/routes/orderRoutes.js
backend/services/riderAssignmentService.js ← findBestRider (implement fully)
backend/models/riderModel.js               ← getAvailable (add to Member B's model)
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/orders` | JWT (user) | `{ items[], restaurantIds[], userLat, userLng, isCluster }` | `{ orderId, clusterId, fee }` |
| GET | `/api/orders/:id` | JWT | — | `{ order, items[], cluster }` |
| GET | `/api/orders/my` | JWT (user) | — | `[orders]` |
| PUT | `/api/orders/:id/status` | JWT | `{ status }` | `{ order }` |

### Sprint 2 Acceptance Checklist (Member D — F19)
- [x] Order created with `pending` status
- [x] Cluster record created only when `isCluster: true`
- [x] Placing order with unavailable item returns 400
- [x] Restaurant notified via Supabase on order creation
- [x] Nearest available rider assigned on `accepted` transition
- [x] Assigned rider's `is_available` set to `false`
- [x] Rider dashboard updates live when assigned
- [x] No assignment made if no riders available (order stays `accepted`, retry logic logs warning)

---

---

# SPRINT 3 — Full Order Lifecycle
**Duration:** Week 5–7  
**Status:** 5 of 5 features DONE.  
**Double Duty:** Member B (F7 + F9)  
**Shared Goal:** The complete order lifecycle works end-to-end: user places order → restaurant accepts → rider assigned → rider follows optimized route → rider delivers → user rates rider and restaurant. AI auto-tagging populates menu data. Analytics dashboard shows real numbers.

---

## S3 — Feature 5: Live Order Tracking (Member A) ✅ DONE

### Goal
Users see real-time delivery updates after placing an order. Status changes, rider location, and a visual timeline.

### Workflow
1. User clicks "Place Order" on Cart page.
2. `POST /api/orders` (Member D's endpoint, F19) creates the order.
3. Frontend redirects to `/orders/:id`.
4. `OrderTracking` page fetches initial order via `GET /api/orders/:id`.
5. Subscribes to Supabase real-time `orders` table filtered by `id`.
6. Status updates render in a `StatusTimeline` component.
7. On `delivered` status: rating modal appears automatically (user can rate both rider and restaurant).

### Files (Member A)
```
frontend/src/services/orderService.js
frontend/src/pages/user/OrderTracking.jsx
frontend/src/pages/user/OrderConfirmation.jsx
frontend/src/hooks/useOrderTracking.js        ← Supabase realtime
frontend/src/components/user/StatusTimeline.jsx
frontend/src/components/user/RatingModal.jsx
```

### Sprint 3 Acceptance Checklist (Member A — F5)
- [x] Order placed successfully, `orderId` returned
- [x] Tracking page shows correct initial status
- [x] Status updates appear within 2 seconds of DB change
- [x] Rating modal appears automatically on delivery
- [x] Rating modal submits to `POST /api/ratings` (Member C's endpoint, F14)

---

## S3 — Feature 7: AI Route Optimization (Member B) ✅ DONE

### Goal
The system determines the shortest pickup order for riders with multiple restaurant stops, optimizes the sequence to reduce travel distance, and provides a navigation link.

### Workflow
1. Rider clicks "View Route" on an active assignment.
2. `GET /api/rider/route/:clusterId` → `riderController.getRoute`:
   - Fetches cluster restaurant coordinates and customer coordinates.
   - Fetches rider's current `current_lat`, `current_lng`.
   - Calls `routeService.optimizeRoute(stops, riderLocation)`.
   - Builds Google Maps URL.
3. Frontend renders ordered stop list + total distance + "Start Navigation" button.

### Files (Member B)
```
backend/services/routeService.js              ← optimizeRoute (nearest-neighbour algorithm)
backend/controllers/riderController.js        ← add getRoute method
frontend/src/pages/rider/RouteView.jsx
frontend/src/components/rider/StopList.jsx
frontend/src/components/rider/NavigationButton.jsx
```

### `routeService.optimizeRoute`
```js
import { haversineDistance } from '../utils/geoUtils.js';

export const optimizeRoute = (stops, riderLocation) => {
  const ordered = [];
  let current = riderLocation;
  const remaining = [...stops];

  while (remaining.length > 0) {
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(current.lat, current.lng, remaining[i].lat, remaining[i].lng);
      if (dist < minDist) { minDist = dist; nearest = i; }
    }
    ordered.push({ ...remaining[nearest], distanceFromPrev: minDist });
    current = remaining[nearest];
    remaining.splice(nearest, 1);
  }

  const totalDistance = ordered.reduce((sum, s) => sum + s.distanceFromPrev, 0);
  const waypoints = ordered.map(s => `${s.lat},${s.lng}`).join('/');
  const mapsUrl = `https://www.google.com/maps/dir/${riderLocation.lat},${riderLocation.lng}/${waypoints}`;

  return { orderedStops: ordered, totalDistance, mapsUrl };
};
```

### API Endpoints
| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/api/rider/route/:clusterId` | JWT (rider) | `{ orderedStops[], mapsUrl, totalDistance }` |

### Sprint 3 Acceptance Checklist (Member B — F7)
- [x] 3-restaurant cluster returns correctly ordered stops
- [x] Google Maps URL opens with correct waypoints
- [x] Total distance displayed in km

---

## S3 — Feature 9: Rider Rating System (Member B) ✅ DONE

### Goal
After delivery, users rate riders (1–5 stars) and leave short feedback. The system calculates average ratings for riders. Low ratings trigger an alert to the system admin.

### Workflow
1. Rating modal (Member A's `RatingModal`, F5) calls `POST /api/ratings` with `{ orderId, riderId, score, reviewText }`.
2. `ratingController.createRiderRating` saves to `ratings` table (extends Member C's rating controller from F14).
3. `ratingModel.updateRiderAvgRating(riderId)` recalculates average.
4. If avg < 3.0: `notificationModel.createAdminAlert`.
5. Rider dashboard shows updated `avg_rating`.

### Files (Member B)
```
backend/controllers/ratingController.js   ← extend with createRiderRating method
backend/models/ratingModel.js             ← add updateRiderAvg (extend Member C's model)
frontend/src/components/rider/RatingDisplay.jsx
frontend/src/components/common/StarRating.jsx
```

### Sprint 3 Acceptance Checklist (Member B — F9)
- [x] Can only rate once per order per rider
- [x] Average updates after each new rating
- [x] Admin notification created when avg drops below 3.0
- [x] Rider dashboard displays current average rating

---

## S3 — Feature 13: AI Menu Auto-Tagging & Dietary Profiling (Member C) ✅ DONE

### Goal
On menu item create/edit, Gemini auto-generates dietary and flavor tags stored in the `ai_tags` JSONB column. Tags are used in search filtering and Combo Builder (Sprint 4).

### Workflow
1. `menuController.create` / `menuController.update` saves item to DB.
2. Calls `geminiService.generateMenuTags(name, description)` (Member D's service):

```js
const prompt = `Given this menu item:
Name: ${name}
Description: ${description}

Return ONLY a valid JSON array of applicable tags from:
["vegan", "vegetarian", "halal", "spicy", "mild", "sweet", "gluten-free", "dairy-free", "high-protein", "low-calorie"]

Example: ["halal", "spicy"]`;
```

3. Parses response, validates it is a JSON array of known tags.
4. `menuModel.updateTags(itemId, tags)` saves to `ai_tags` column.
5. Tags displayed on menu card with "AI" badge. Used in search filtering.

### Files (Member C)
```
backend/controllers/restaurantController.js ← call geminiService.generateMenuTags after save
frontend/src/components/restaurant/AiTagBadge.jsx
```
> `geminiService.generateMenuTags` is Member D's. Member C calls it from the menu controller. Member D must implement the `generateMenuTags` method in `geminiService.js` before or during this sprint.

### Sprint 3 Acceptance Checklist (Member C — F13)
- [x] Tags generated within 3 seconds of item save
- [x] Malformed Gemini response caught — item saved without tags, no crash
- [x] Tags visible on user search results and filter correctly
- [x] AI badge shown on tagged items in restaurant menu view

---

## S3 — Feature 20: Analytics Dashboard (Member D) ✅ DONE

### Goal
Admin can see real platform data: total orders, clustered orders, cluster success rate, average delivery time, rider efficiency, daily sales, most ordered item, and weekly revenue graphs.

### Workflow
1. `GET /api/admin/analytics` → `adminController.getAnalytics` → `analyticsService.getAnalytics()`.
2. Queries:
   - Total orders: `SELECT COUNT(*) FROM orders`
  - Clustered orders: `SELECT COUNT(*) FROM orders WHERE cluster_id IS NOT NULL`
  - Total clusters: `SELECT COUNT(*) FROM clusters`
   - Cluster rate: `(clustered / total) * 100`
   - Avg delivery time: avg of `(delivered_at - created_at)` for delivered orders
  - Rider efficiency: `(delivered orders with rider in last 7 days) / (total riders)`
   - Daily sales: `SUM(total_price) WHERE DATE(created_at) = TODAY`
   - Most ordered item: `SELECT menu_item_id, COUNT(*) FROM order_items GROUP BY 1 ORDER BY 2 DESC LIMIT 1`
   - Weekly revenue: group orders by day, last 7 days
3. Frontend renders `StatCard` components + `recharts` line chart.

### Files (Member D)
```
backend/services/analyticsService.js      ← implement getAnalytics fully
backend/controllers/adminController.js
backend/routes/adminRoutes.js
frontend/src/pages/admin/Analytics.jsx
frontend/src/layouts/AdminLayout.jsx
frontend/src/components/admin/StatCard.jsx
frontend/src/components/admin/RevenueChart.jsx
```

### Gemini Service — `generateMenuTags` (Member D implements for F13)
```js
export const generateMenuTags = async (name, description) => {
  try {
    const prompt = `Given this menu item:\nName: ${name}\nDescription: ${description}\n\nReturn ONLY a valid JSON array of applicable tags from:\n["vegan", "vegetarian", "halal", "spicy", "mild", "sweet", "gluten-free", "dairy-free", "high-protein", "low-calorie"]\n\nExample: ["halal", "spicy"]`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const tags = JSON.parse(text);
    if (!Array.isArray(tags)) return [];
    return tags;
  } catch {
    return [];
  }
};
```

### API Endpoints
| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/api/admin/analytics` | JWT (admin) | `{ totalOrders, clusteredOrders, clusterRate, avgDeliveryTime, dailySales, mostOrderedItem, weeklyRevenue[] }` |

### Sprint 3 Acceptance Checklist (Member D — F20)
- [x] All stats accurate against test data
- [x] Revenue chart renders for partial weeks
- [x] Only accessible to admin role
- [x] `generateMenuTags` implemented and returns correct types (supports Member C's F13)

---

---

# SPRINT 4 — AI Features & Polish
**Duration:** Week 8–10  
**Double Duty:** Member D (F16 + F17)  
**Shared Goal:** All Gemini-powered features live. Recommendations and Combo Builder working. Demand detection active. ETA prediction enhancing UX. Platform tested end-to-end. UI polished.

---

## S4 — Feature 4: AI Delivery Time Prediction (Member A)

### Goal
The system calculates travel distance, adds preparation time, and dynamically estimates total delivery time. Enhances cart and tracking pages with accurate ETAs.

### Workflow
1. `POST /api/delivery/estimate` → `deliveryController.estimateTime` → `estimationService.estimateTime`.
2. `maxPrepTime` = max of all restaurants' `avg_prep_time`.
3. `travelTime` = `(totalRouteDistance / RIDER_SPEED_KMH) × 60`.
4. `estimatedMinutes` = `maxPrepTime + travelTime + 5` (buffer).
5. Returns `{ estimatedMinutes, breakdown }`.
6. Frontend: `ETADisplay` component shown on Cart page and Order Tracking page.

### Files (Member A)
```
backend/services/estimationService.js     ← implement estimateTime fully
backend/controllers/deliveryController.js ← add estimateTime method (extends Member D's controller)
backend/routes/deliveryRoutes.js          ← add estimate route (extends Member D's routes)
frontend/src/components/user/ETADisplay.jsx
frontend/src/services/deliveryService.js  ← add getETA
```

### `estimationService.estimateTime`
```js
import { haversineDistance } from '../utils/geoUtils.js';

const RIDER_SPEED = Number(process.env.RIDER_SPEED_KMH) || 30;

export const estimateTime = (restaurants, userLat, userLng) => {
  const maxPrep = Math.max(...restaurants.map(r => r.avg_prep_time || 15));

  let totalDist = 0;
  let prev = { lat: restaurants[0].lat, lng: restaurants[0].lng };
  for (const r of restaurants.slice(1)) {
    totalDist += haversineDistance(prev.lat, prev.lng, r.lat, r.lng);
    prev = r;
  }
  totalDist += haversineDistance(prev.lat, prev.lng, userLat, userLng);

  const travelMinutes = (totalDist / RIDER_SPEED) * 60;
  const buffer = 5;
  const estimatedMinutes = Math.ceil(maxPrep + travelMinutes + buffer);

  return {
    estimatedMinutes,
    breakdown: { prepTime: maxPrep, travelTime: Math.ceil(travelMinutes), buffer, totalDistance: totalDist.toFixed(2) }
  };
};
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/delivery/estimate` | JWT (user) | `{ restaurantIds[], userLat, userLng }` | `{ estimatedMinutes, breakdown }` |

### Sprint 4 Acceptance Checklist (Member A — F4)
- [ ] ETA increases proportionally with distance
- [ ] ETA uses slowest restaurant's prep time, not average
- [ ] ETADisplay renders on Cart and Tracking pages
- [ ] Graceful fallback when restaurant has no `avg_prep_time`

---

## S4 — Feature 10: AI Area Demand Detection (Member B)

### Goal
Analyze order density per area, detect high-demand zones, and notify riders to reposition towards busy areas.

### Workflow
1. Background job in `app.js`: `setInterval(demandService.analyzeZones, 1800000)` (30 min).
2. `demandService.analyzeZones()`:
   - Fetch orders from past 2 hours.
   - Group by `lat.toFixed(2)` + `lng.toFixed(2)` grid cells.
   - Flag cells with > 5 orders as HIGH_DEMAND.
   - Store in memory or `demand_zones` table.
3. If a rider's current location is within 1km of a high-demand zone, `notificationModel.create(riderId, message)`.
4. Rider dashboard shows a notification badge: "High demand detected 0.8km away — consider repositioning."
5. `GET /api/admin/demand-zones` returns zone list for admin heatmap.

### Files (Member B)
```
backend/services/demandService.js             ← analyzeZones, checkRiderProximity
frontend/src/components/rider/DemandNotification.jsx
frontend/src/hooks/useRiderNotifications.js   ← Supabase realtime on notifications table
```

### API Endpoints
| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/api/admin/demand-zones` | JWT (admin) | `[{ lat, lng, orderCount, level }]` |

### Sprint 4 Acceptance Checklist (Member B — F10)
- [ ] Zones update every 30 minutes without restart
- [ ] Notification appears for riders near high-demand zones
- [ ] Notification dismissed after rider reads it
- [ ] Admin can view demand zones data

---

## S4 — Feature 15: Gemini-Powered "Vibe Check" Review Summaries (Member C) ✅ DONE

### Goal
A single-sentence Gemini-generated sentiment summary shown on each restaurant's public profile, giving users quick, actionable intelligence.

### Workflow
1. `GET /api/restaurant/:id/vibe` → `restaurantController.getVibeSummary`.
2. `ratingModel.getRecentReviews(restaurantId, limit=20)` fetches last 20 text reviews.
3. If < 3 reviews: return `{ summary: null }`.
4. Calls `geminiService.generateVibeSummary(reviews)` (Member D's service):

```js
const prompt = `Summarize these restaurant reviews in ONE sentence of 20 words or less.
Be specific and honest. Tell a new customer what to expect.
Reviews: ${JSON.stringify(reviews.map(r => r.review_text))}`;
```

5. Cache result for 1 hour (in-memory Map keyed by `restaurantId`).
6. Member A's `VibeCheckCard` on the RestaurantProfile page renders the summary.

### Files (Member C)
```
backend/controllers/restaurantController.js  ← add getVibeSummary
frontend/src/components/user/VibeCheckCard.jsx
```
> `geminiService.generateVibeSummary` is Member D's. Member C calls it from the restaurant controller. Member D must implement this method before or during this sprint.

### API Endpoints
| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/api/restaurant/:id/vibe` | None | `{ summary: string \| null }` |

### Sprint 4 Acceptance Checklist (Member C — F15)
- [ ] Summary renders on restaurant profile
- [ ] Returns null with < 3 reviews, no crash
- [ ] Cached result served on repeat calls within 1 hour
- [ ] Graceful fallback if Gemini is unavailable

---

## S4 — Feature 16: AI Food Recommendation System (Member D)

### Goal
Suggest popular items, frequently ordered combinations, and cluster-friendly menus via three recommendation carousels on the Home page.

### Workflow
1. On home page load, `GET /api/recommendations?userLat=X&userLng=Y`.
2. `recommendationController.getRecommendations` → `recommendationService.getRecommendations(userId, userLat, userLng)`.
3. Three lists returned:
   - **Popular:** `SELECT menu_item_id, COUNT(*) FROM order_items GROUP BY 1 ORDER BY 2 DESC LIMIT 10`
   - **Frequently Together:** Items appearing in same orders as the user's top-ordered item.
   - **Cluster-Friendly:** Pairs of items from restaurants within cluster radius of user.
4. Frontend: each carousel scrolls horizontally, each card is a `FoodCard` with Add to Cart button.

### Files (Member D)
```
backend/services/recommendationService.js  ← implement getRecommendations fully
backend/controllers/recommendationController.js
backend/routes/recommendationRoutes.js
frontend/src/components/admin/RecommendationCarousel.jsx
```
> Member A's Home page calls this endpoint and renders the carousels.

### API Endpoints
| Method | Path | Auth | Params | Response |
|--------|------|------|--------|----------|
| GET | `/api/recommendations` | JWT (user) | `userLat, userLng` | `{ popular[], frequentlyTogether[], clusterFriendly[] }` |

### Sprint 4 Acceptance Checklist (Member D — F16)
- [ ] New users see only Popular carousel (no order history)
- [ ] Returning users see personalized "Ordered Together" suggestions
- [ ] Cluster-friendly picks come from restaurants within radius
- [ ] Each carousel card adds to cart correctly

---

## S4 — Feature 17: Cross-Restaurant AI Combo Builder (Member D)

### Goal
User types a natural language prompt; Gemini builds a complete cart from cluster-eligible restaurants matching budget, headcount, and dietary needs.

### Workflow
1. User opens "AI Combo Builder" page.
2. Types prompt: "meal for 2 under 500 Tk, one person is vegetarian".
3. `POST /api/ai/combo` with `{ prompt, userLat, userLng }`.
4. Backend:
   - `clusteringService.getNearbyClusteredRestaurants(userLat, userLng)` (Member A's service) gets eligible restaurants.
   - Fetches all their menu items with `ai_tags`.
   - Calls `geminiService.buildCombo(prompt, menuContext)`.
   - Validates all returned item IDs exist.
5. Returns `{ suggestedItems[], totalPrice, explanation }`.
6. Frontend shows suggested cart + "Add All to Cart" button.

### Files (Member D)
```
backend/controllers/aiController.js
backend/routes/aiRoutes.js
backend/services/geminiService.js         ← implement buildCombo + generateVibeSummary
frontend/src/pages/admin/ComboBuilder.jsx
frontend/src/components/admin/ComboResult.jsx
frontend/src/services/aiService.js
```

### Gemini Service — Full Implementation (Member D)

**`generateVibeSummary(reviews)` → `string`** (supports F15)
```js
export const generateVibeSummary = async (reviews) => {
  try {
    const prompt = `Summarize these restaurant reviews in ONE sentence of 20 words or less.\nBe specific and honest. Tell a new customer what to expect.\nReviews: ${JSON.stringify(reviews.map(r => r.review_text))}`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch {
    return null;
  }
};
```

**`buildCombo(userPrompt, menuContext)` → `{ items[], explanation }`**
```js
export const buildCombo = async (userPrompt, menuContext) => {
  try {
    const prompt = `You are a food ordering assistant. The user wants: "${userPrompt}"

Available menu items (JSON):
${JSON.stringify(menuContext)}

Return ONLY this exact JSON:
{
  "items": [{ "menuItemId": "...", "restaurantId": "...", "quantity": 1 }],
  "explanation": "One sentence explaining your selection"
}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    return { items: [], explanation: "Could not generate combo. Please try again." };
  }
};
```

### API Endpoints
| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/api/ai/combo` | JWT (user) | `{ prompt, userLat, userLng }` | `{ suggestedItems[], totalPrice, explanation }` |

### Sprint 4 Acceptance Checklist (Member D — F17)
- [ ] Prompt respects budget constraint
- [ ] Vegetarian/vegan tags respected in selection
- [ ] "Add All to Cart" populates CartContext correctly
- [ ] Graceful error message if Gemini is unavailable
- [ ] All three `geminiService` methods return safe fallbacks on error
- [ ] No Gemini failure crashes any other flow

---

---

# Integration Touchpoints (All Members Read)

These are the exact moments where two members' work must connect. Coordinate on these explicitly.

| Touchpoint | Owner A | Owner B | When |
|------------|---------|---------|------|
| Fee engine used by cart | Member A (frontend calls fee API) | Member D (fee endpoint, F18) | Sprint 1 → Sprint 2 |
| Cluster check in cart | Member A (F2 backend + F3 frontend) | — | Sprint 2 |
| Cart calls fee API | Member A (cart frontend) | Member D (fee endpoint) | Sprint 2 |
| Place order | Member A (cart "Place Order" button) | Member D (order endpoint, F19) | Sprint 2 → Sprint 3 |
| Status update UI → backend | Member B (status buttons, F8) | Member D (status endpoint, F19) | Sprint 2 |
| Order triggers rider assignment | Member D (F19 backend) | Member B (rider model) | Sprint 2 |
| Rating submission — restaurant | Member A (rating modal, F5) | Member C (rating backend, F14) | Sprint 2 → Sprint 3 |
| Rating submission — rider | Member A (rating modal, F5) | Member B (rating backend, F9) | Sprint 3 |
| Live tracking listens to status | Member A (tracking frontend, F5) | Member B (status buttons, F8) + Member D (order backend) | Sprint 3 |
| AI tags in menu save | Member C (menu controller, F13) | Member D (geminiService.generateMenuTags) | Sprint 3 |
| Vibe Check display | Member A (VibeCheckCard) | Member C (vibe endpoint, F15) + Member D (geminiService) | Sprint 4 |
| ETA in cart + tracking | Member A (ETA frontend + backend, F4) | Member D (delivery routes file) | Sprint 4 |
| Combo Builder | Member D (AI backend + frontend, F17) | Member A (clusteringService.getNearbyClusteredRestaurants) | Sprint 4 |
| Recommendations on Home | Member D (recommendation backend, F16) | Member A (Home page consumes API) | Sprint 4 |
| Demand notifications | Member B (notification frontend, F10) | Member D (notificationModel) | Sprint 4 |
| Demand zones on admin | Member B (demandService, F10) | Member D (admin heatmap, F20) | Sprint 4 |

---

# Cross-Sprint Standards (All Members Follow)

### Controller Pattern
```js
export const someAction = async (req, res, next) => {
  try {
    const result = await someService.doThing(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
```

### Protected Route Pattern
```js
// In route file:
router.post('/endpoint', protect, restrictTo('user'), controller.method);
```

### Supabase Real-Time Hook Pattern
```js
export const useRealtimeSubscription = (table, filter, callback) => {
  useEffect(() => {
    const channel = supabase
      .channel(`${table}-${filter}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, callback)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [table, filter]);
};
```

### Gemini Error Handling Rule
Every `geminiService` method returns a safe fallback value on failure. **Never let Gemini crash the ordering flow.**

---

*v3 — Reconfigured for feature-based sprints (5 features per sprint, 20 total). Last updated: Sprint 1 (in progress).*
