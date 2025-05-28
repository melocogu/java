console.log("🧠 Este é o index.js com suporte a upload!");

const express = require('express');
const path = require('path');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./cocktails.db');

const upload = multer({ dest: path.join(__dirname, 'public/images') });

app.use(express.json());

// Rotas API
app.put('/cocktails/order', (req, res) => {
  const updates = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ success: false, message: 'Lista vazia ou inválida' });
  }

  console.log("🔁 INICIANDO ATUALIZAÇÃO DE POSIÇÃO");
  const stmt = db.prepare('UPDATE cocktails SET position = ? WHERE id = ?');

  let completed = 0;
  let hasError = false;

  updates.forEach(({ id, position }) => {
    stmt.run([position, id], function (err) {
      if (err) {
        console.error(`❌ Erro ao atualizar id ${id}:`, err.message);
        hasError = true;
      } else {
        console.log(`✔️ Atualizado id ${id} para posição ${position}`);
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

app.post('/cocktails', upload.single('imageFile'), (req, res) => {
  const { name, ingredients, instructions, slug } = req.body;
  const image = req.file ? `/images/${req.file.filename}` : req.body.image;

  db.run(
    'INSERT INTO cocktails (name, image, ingredients, instructions, slug, position) VALUES (?, ?, ?, ?, ?, ?)',
    [name, image, ingredients, instructions, slug, Date.now()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.get('/cocktails', (req, res) => {
  db.all('SELECT * FROM cocktails ORDER BY position ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/cocktails/:id', (req, res) => {
  const { name, image, ingredients, instructions, slug } = req.body;
  db.run(
    'UPDATE cocktails SET name = ?, image = ?, ingredients = ?, instructions = ?, slug = ? WHERE id = ?',
    [name, image, ingredients, instructions, slug, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    }
  );
});

app.delete('/cocktails/:id', (req, res) => {
  db.run('DELETE FROM cocktails WHERE id = ?', req.params.id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

// Servir ficheiros estáticos
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Servidor com upload a correr em http://localhost:${PORT}`);
});