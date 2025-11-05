import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './src/database/init.js';
import { UserService } from './src/services/user-service.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
await initializeDatabase();

// User routes
app.post('/api/users', async (req, res) => {
  try {
    const user = await UserService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await UserService.getUserById(parseInt(req.params.id));
    res.json(user);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await UserService.updateUser(parseInt(req.params.id), req.body);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await UserService.deleteUser(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { limit = 50, offset = 0, role, status } = req.query;
    const result = await UserService.getUsers({
      limit: parseInt(limit),
      offset: parseInt(offset),
      role,
      status
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
