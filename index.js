const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./cocktails.db');
const upload = multer({ dest: 'public/images/' });

app.use(bodyParser.json()); // JSON parser para dados normais

// ⚠️ TODAS AS ROTAS DEVEM VIR ANTES DO STATIC

// Reorder cocktails (drag and drop)
app.put('/cocktails/order', express.json(), (req, res) => {
  console.log("📥 RECEBIDO EM ORDER:", req.body);
  const updates = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Lista vazia ou inválida' });
  }

  const stmt = db.prepare('UPDATE cocktails SET position = ? WHERE id = ?');
  let completed = 0;
  let hasError = false;

  updates.forEach(({ id, position }) => {
    stmt.run([position, id], function (err) {
      if (err) {
        console.error(`❌ Erro ao atualizar id ${id}:`, err.message);
        hasError = true;
      }
      completed++;
      if (completed === updates.length) {
        stmt.finalize();
        if (hasError) {
          return res.status(500).json({ success: false, message: 'Erro em uma ou mais atualizações.' });
        }
        return res.json({ success: true });
      }
    });
  });
});

// Get all cocktails
// Get only active cocktails (for index)
app.get('/cocktails', (req, res) => {
  db.all('SELECT * FROM cocktails WHERE active = 1 ORDER BY position ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get all cocktails (for admin)
app.get('/cocktails/all', (req, res) => {
  db.all('SELECT * FROM cocktails ORDER BY position ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// Create new cocktail
app.post('/cocktails', upload.single('imageFile'), (req, res) => {
  const { name, ingredients, instructions, slug } = req.body;
  let image = req.body.image;
  if (req.file) image = `/images/${req.file.filename}`;

  db.run(
    'INSERT INTO cocktails (name, image, ingredients, instructions, slug, position) VALUES (?, ?, ?, ?, ?, ?)',
    [name, image, ingredients, instructions, slug, Date.now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Update cocktail with optional image
app.put('/cocktails/:id', upload.single('imageFile'), (req, res) => {
  const { name, ingredients, instructions, slug } = req.body;
  let image = req.body.image;
  if (req.file) image = `/images/${req.file.filename}`;

  db.run(
    'UPDATE cocktails SET name = ?, image = ?, ingredients = ?, instructions = ?, slug = ? WHERE id = ?',
    [name, image, ingredients, instructions, slug, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    }
  );
});

// Delete cocktail
app.delete('/cocktails/:id', (req, res) => {
  db.run('DELETE FROM cocktails WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});


// Toggle active/inactive
app.put('/cocktails/:id/toggle', (req, res) => {
  db.run('UPDATE cocktails SET active = NOT active WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});


// ⚠️ EXPRESS STATIC DEVE VIR POR ÚLTIMO
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});