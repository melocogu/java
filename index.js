const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const app = express();
const db = new sqlite3.Database('./cocktails.db');
const upload = multer({ dest: 'public/images/' });
const PORT = process.env.PORT || 3000;
console.log("🟢 ESTE É O SERVER.JS CORRETO");

app.use((req, res, next) => {
  console.log("➡️ Nova request:", req.method, req.url);
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Proteger /index.html e /admin.html
app.get('/index.html', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});

app.get('/admin.html', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});



// Proteger / (root) que serve index.html por padrão
app.get('/', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});



// Proteger /cocktail.html
app.get('/cocktail.html', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});



app.get('/cocktails', authMiddleware, (req, res) => {
  const slug = req.query.slug;
  db.get('SELECT * FROM cocktails WHERE slug = ? AND active = 1 AND user_id = ?', [slug, req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Cocktail not found' });
    res.json(row);
  });
});


app.use(express.static('public'));

// ---------- Tabelas ----------
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cocktails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    image TEXT,
    ingredients TEXT,
    instructions TEXT,
    slug TEXT,
    position INTEGER,
    active BOOLEAN DEFAULT 1
  )`);
});

// ---------- Autenticação ----------
function authMiddleware(req, res, next) {
  console.log("🔐 authMiddleware ativado");
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.status(401).json({ error: 'Invalid session' });
    req.userId = row.user_id; // <-- ESTA LINHA É FUNDAMENTAL
    next();
  });
}

app.post('/register', (req, res) => {
  const { email, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], function (err) {
    if (err) return res.status(400).json({ error: 'Email already used' });
    res.json({ success: true });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = uuidv4();
    db.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id], (err) => {
      if (err) return res.status(500).json({ error: 'Could not create session' });
      res.cookie('token', token, { httpOnly: true });
      res.json({ success: true });
    });
  });
});

app.post('/logout', (req, res) => {
  const token = req.cookies.token;
  db.run('DELETE FROM sessions WHERE token = ?', token, () => {
    res.clearCookie('token');
    res.json({ success: true });
  });
});

app.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, email FROM users WHERE id = ?', [req.userId], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// ---------- Cocktails ----------
app.get('/cocktails/active', authMiddleware, (req, res) => {
  db.all('SELECT * FROM cocktails WHERE active = 1 AND user_id = ? ORDER BY position ASC', [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/cocktails/all', authMiddleware, (req, res) => {
  db.all('SELECT * FROM cocktails WHERE user_id = ? ORDER BY position ASC', [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/cocktails', authMiddleware, upload.single('imageFile'), (req, res) => {
  const { name, image, ingredients, instructions, slug } = req.body;
  const finalImage = req.file ? '/images/' + req.file.filename : image;

  db.get(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM cocktails WHERE user_id = ?',
    [req.userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      const nextPosition = row?.next || 1;

      db.run(
        'INSERT INTO cocktails (user_id, name, image, ingredients, instructions, slug, position, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
        [req.userId, name, finalImage, ingredients, instructions, slug, nextPosition],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ id: this.lastID });
        }
      );
    }
  );
});

app.put('/cocktails/:id', authMiddleware, upload.single('imageFile'), (req, res) => {
  const { name, image, ingredients, instructions, slug } = req.body;
  const finalImage = req.file ? '/images/' + req.file.filename : image;

  db.run(
    'UPDATE cocktails SET name = ?, image = ?, ingredients = ?, instructions = ?, slug = ? WHERE id = ? AND user_id = ?',
    [name, finalImage, ingredients, instructions, slug, req.params.id, req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.put('/cocktails/:id/toggle', authMiddleware, (req, res) => {
  db.run(
    'UPDATE cocktails SET active = NOT active WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ toggled: this.changes });
    }
  );
});

app.put('/cocktails/order', authMiddleware, (req, res) => {
  console.log("🛬 Entrou no reorder");
  console.log("🧾 Headers:", req.headers);
  console.log("📭 req.body:", req.body);

  const updates = req.body;

  if (!Array.isArray(updates)) {
    console.log("❌ updates NÃO é um array:", updates);
    return res.status(400).json({ error: "Payload deve ser um array" });
  }

  const stmt = db.prepare("UPDATE cocktails SET position = ? WHERE id = ? AND user_id = ?");
  let completed = 0;
  let hasError = false;

  updates.forEach(({ id, position }) => {
    const pid = parseInt(position);
    const cid = parseInt(id);
    const uid = parseInt(req.userId);

    stmt.run([pid, cid, uid], function (err) {
      if (err) {
        console.error("❌ Erro SQL:", err.message);
        hasError = true;
      } else {
        console.log("✅ Update:", { id: cid, position: pid, changes: this.changes });
      }

      completed++;
      if (completed === updates.length) {
        stmt.finalize();
        if (hasError) return res.status(500).json({ error: 'Erro ao atualizar posições' });
        res.json({ success: true });
      }
    });
  });
});

// Proteger /index.html e /admin.html
app.get('/index.html', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});

app.get('/admin.html', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});



// Proteger / (root) que serve index.html por padrão
app.get('/', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});



// Proteger /cocktail.html
app.get('/cocktail.html', (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login.html');

  db.get('SELECT user_id FROM sessions WHERE token = ?', token, (err, row) => {
    if (err || !row) return res.redirect('/login.html');
    next();
  });
});



app.get('/cocktails', authMiddleware, (req, res) => {
  const slug = req.query.slug;
  db.get('SELECT * FROM cocktails WHERE slug = ? AND active = 1 AND user_id = ?', [slug, req.userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Cocktail not found' });
    res.json(row);
  });
});


app.use(express.static('public'));

app.post('/cocktails/order', authMiddleware, (req, res) => {
  const raw = req.body.order;
  if (!raw) return res.status(400).json({ error: "Missing order data" });

  let updates = [];
  try {
    updates = JSON.parse(raw);
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const stmt = db.prepare("UPDATE cocktails SET position = ? WHERE id = ? AND user_id = ?");
  let completed = 0;
  let hasError = false;

  updates.forEach(({ id, position }) => {
    stmt.run([parseInt(position), parseInt(id), parseInt(req.userId)], function (err) {
      if (err) hasError = true;
      completed++;
      if (completed === updates.length) {
        stmt.finalize();
        if (hasError) return res.status(500).send("Erro ao atualizar posições");
        res.redirect("/admin.html");
      }
    });
  });
});

app.listen(PORT, () => {
  console.log('🚀 Server running on http://localhost:' + PORT);
});