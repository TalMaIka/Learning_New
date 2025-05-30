const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const pool = new Pool({
  user: 'postgres', // change this
  host: 'localhost',
  database: 'postgres',
  password: '123123a', // change this
  port: 5432,
});

// Register endpoint
app.post('/register', async (req, res) => {
  // Accept either JSON or URL-encoded form data
  const { email, password, full_name, role } = req.body;

  if (!['student', 'teacher', 'admin'].includes(role)) {
    return res.status(400).send('Invalid role');
  }

  if (!email || !password || !full_name) {
    return res.status(400).send('Missing fields');
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4)`,
      [email, hash, full_name, role]
    );
    res.status(201).send('User registered');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).send('User not found');

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).send('Wrong password');

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        created_at: user.created_at,
      }
    });
  } catch (err) {
    res.status(500).send('Server error');
  }
});


// Ticketing system
app.post('/tickets', async (req, res) => {
  const { student_id, teacher_id, subject, message } = req.body;
  if (!student_id || !teacher_id || !subject || !message) {
    return res.status(400).send('Missing fields');
  }

  try {
    await pool.query(
      `INSERT INTO tickets (student_id, teacher_id, subject, message) VALUES ($1, $2, $3, $4)`,
      [student_id, teacher_id, subject, message]
    );
    res.status(201).send('Ticket created');
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.get('/teachers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name FROM users WHERE role = 'teacher'`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.get('/tickets/:teacherId', async (req, res) => {
  const { teacherId } = req.params;

  try {
    const result = await pool.query(
      `SELECT tickets.*, users.full_name AS student_name
       FROM tickets
       JOIN users ON tickets.student_id = users.id
       WHERE tickets.teacher_id = $1
       ORDER BY tickets.created_at DESC`,
      [teacherId]
    );

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.put('/tickets/:ticketId/reply', async (req, res) => {
  const { ticketId } = req.params;
  const { response } = req.body;

  if (!response) return res.status(400).send('Missing response');

  try {
    await pool.query(
      `UPDATE tickets SET response = $1, responded_at = NOW() WHERE id = $2`,
      [response, ticketId]
    );
    res.status(200).send('Reply saved');
  } catch (err) {
    res.status(500).send('Server error');
  }
});



app.listen(3001, '0.0.0.0', () => {
  console.log('Backend running on http://0.0.0.0:3001');
});