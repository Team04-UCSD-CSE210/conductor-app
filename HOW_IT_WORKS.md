# How the User System Works

## The Big Picture

```text
Frontend App → API Server → User Model → SQLite Database
```

## What Each Part Does

### 1. **Database** (`src/db.js`)

- Creates SQLite file to store user data permanently
- Sets up the `users` table with columns: id, name, email, role

### 2. **User Model** (`src/user.js`)

- Validates user data (email format, name length)
- Saves/reads/updates/deletes users in database
- Prevents duplicate emails

### 3. **API Server** (`server.js`)

- Provides REST endpoints for frontend to use:
  - `POST /users` - Create user
  - `GET /users/:id` - Get user
  - `PUT /users/:id` - Update user
  - `DELETE /users/:id` - Delete user

### 4. **Tests** (`src/*.test.js`)

- Verify everything works correctly
- Test validation, CRUD operations, error handling

## How to Use It

**For Development:**

```bash
npm test          # Run tests
node simple-example.js  # See CRUD demo
npm start         # Start API server
```

**For Frontend Integration:**

```javascript
// Create user
fetch('/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John', email: 'john@test.com' })
})

// Get user
fetch('/users/1').then(res => res.json())
```

## Real-World Usage

1. **User Registration**: Frontend sends user data to `POST /users`
2. **User Login**: Frontend gets user by email from `GET /users`
3. **Profile Updates**: Frontend sends changes to `PUT /users/:id`
4. **Admin Panel**: Frontend lists all users from `GET /users`

The database persists everything, so data survives server restarts.
