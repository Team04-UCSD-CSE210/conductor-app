import { initDb } from './src/db.js';
import { User } from './src/user.js';

await initDb();

// Create users
const user1 = await User.create({ name: 'Alice', email: 'alice@test.com', role: 'admin' });
const user2 = await User.create({ name: 'Bob', email: 'bob@test.com' });

console.log('Created users:', user1.id, user2.id);

// Read user
const found = await User.findById(user1.id);
console.log('Found user:', found.name);

// Update user
const updated = await User.update(user2.id, { name: 'Robert', email: 'bob@test.com', role: 'moderator' });
console.log('Updated user:', updated.name, updated.role);

// List users
const users = await User.findAll();
console.log('All users:', users.length);

// Delete user
await User.delete(user2.id);
console.log('Deleted user');

process.exit(0);
