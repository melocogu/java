const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const db = new sqlite3.Database('./cocktails.db');

app.use(bodyParser.json());
app.use(express.static('public'));

// Obter todos os cocktails
app.get('/cocktails', (req, res) => {
  db.all('SELECT * FROM cocktails', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Adicionar novo cocktail
app.post('/cocktails', (req, res) => {
  const { name, image, ingredients, instructions, slug } = req.body;
  db.run(
    'INSERT INTO cocktails (name, image, ingredients, instructions, slug) VALUES (?, ?, ?, ?, ?)',
    [name, image, ingredients, instructions, slug],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// Editar cocktail
app.put('/cocktails/:id', (req, res) => {
  const { name, image, ingredients, instructions, slug } = req.body;
  db.run(
    'UPDATE cocktails SET name = ?, image = ?, ingredients = ?, instructions = ?, slug = ? WHERE id = ?',
    [name, image, ingredients, instructions, slug, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    }
  );
});

// Apagar cocktail
app.delete('/cocktails/:id', (req, res) => {
  db.run('DELETE FROM cocktails WHERE id = ?', req.params.id, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr em http://localhost:${PORT}`);
});
