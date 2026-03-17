import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";

interface WorkerEnv {
  DB: D1Database;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}

const app = new Hono<{ Bindings: WorkerEnv }>();

// CORS middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://*.workers.dev'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Auth endpoints
app.get('/api/oauth/google/redirect_url', async (c) => {
  const redirectUrl = await getOAuthRedirectUrl('google', {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  return c.json({ redirectUrl }, 200);
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

app.get("/api/users/me", authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  // Get or create user profile
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();

  let profile = results[0];
  
  if (!profile) {
    // Create new profile
    await c.env.DB.prepare(
      "INSERT INTO user_profiles (user_id, gamification_level, gamification_points, wallet_balance) VALUES (?, 1, 0, 0.0)"
    ).bind(user.id).run();
    
    const { results: newResults } = await c.env.DB.prepare(
      "SELECT * FROM user_profiles WHERE user_id = ?"
    ).bind(user.id).all();
    
    profile = newResults[0];
  }

  return c.json({ ...user, profile });
});

app.get('/api/logout', async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === 'string') {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'none',
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// Categories endpoint
app.get('/api/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM categories WHERE is_active = 1 ORDER BY name"
  ).all();

  return c.json(results);
});

// Products endpoint
app.get('/api/products', async (c) => {
  const categorySlug = c.req.query('category');
  let query = "SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.is_active = 1";
  const params = [];

  if (categorySlug) {
    query += " AND c.slug = ?";
    params.push(categorySlug);
  }

  query += " ORDER BY p.name";

  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(results);
});

// Get single product
app.get('/api/products/:id', async (c) => {
  const id = c.req.param('id');
  const { results } = await c.env.DB.prepare(
    "SELECT p.*, c.name as category_name, c.slug as category_slug FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ? AND p.is_active = 1"
  ).bind(id).all();

  if (!results[0]) {
    return c.json({ error: 'Product not found' }, 404);
  }

  return c.json(results[0]);
});

// User wallet endpoint
app.get('/api/wallet', authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const { results: profile } = await c.env.DB.prepare(
    "SELECT wallet_balance FROM user_profiles WHERE user_id = ?"
  ).bind(user.id).all();

  const { results: transactions } = await c.env.DB.prepare(
    "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10"
  ).bind(user.id).all();

  return c.json({
    balance: profile[0]?.wallet_balance || 0,
    transactions: transactions
  });
});

// Create order endpoint
app.post('/api/orders', authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const body = await c.req.json();
  
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: 'Items are required' }, 400);
  }

  // Calculate total
  let totalAmount = 0;
  for (const item of body.items) {
    const { results } = await c.env.DB.prepare(
      "SELECT price FROM products WHERE id = ?"
    ).bind(item.product_id).all();
    
    if (!results[0]) {
      return c.json({ error: `Product ${item.product_id} not found` }, 400);
    }
    
    totalAmount += (results[0] as { price: number }).price * item.quantity;
  }

  // Create order
  const trackingCode = `MND${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  
  const orderResult = await c.env.DB.prepare(
    "INSERT INTO orders (user_id, total_amount, status, tracking_code) VALUES (?, ?, 'pending', ?) RETURNING id"
  ).bind(user.id, totalAmount, trackingCode).first() as { id: number } | null;

  if (!orderResult) {
    return c.json({ error: 'Failed to create order' }, 500);
  }

  const orderId = orderResult.id;

  // Create order items
  for (const item of body.items) {
    const { results } = await c.env.DB.prepare(
      "SELECT price FROM products WHERE id = ?"
    ).bind(item.product_id).all();
    
    await c.env.DB.prepare(
      "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)"
    ).bind(orderId, item.product_id, item.quantity, (results[0] as { price: number }).price).run();
  }

  return c.json({ 
    success: true, 
    orderId,
    trackingCode,
    totalAmount
  });
});

// Get user orders
app.get('/api/orders', authMiddleware, async (c) => {
  const user = c.get("user");
  
  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }
  
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(user.id).all();

  return c.json(results);
});

export default app;
