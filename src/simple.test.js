import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { initDb, getDb } from './db.js';
import { User } from './user.js';

describe('Simple User CRUD', () => {
  beforeAll(async () => {
    await initDb();
  });

  beforeEach(async () => {
    // Clean database before each test
    const db = getDb();
    await new Promise(resolve => db.run('DELETE FROM users', resolve));
  });

  it('should_create_and_find_user', async () => {
    const userData = { name: 'John Doe', email: 'john@test.com', role: 'admin' };
    const user = await User.create(userData);
    
    expect(user.id).toBeDefined();
    expect(user.name).toBe('John Doe');
    
    const found = await User.findById(user.id);
    expect(found.email).toBe('john@test.com');
  });

  it('should_validate_user_data', async () => {
    await expect(User.create({ name: 'A', email: 'invalid' }))
      .rejects.toThrow('Name too short, Invalid email');
  });

  it('should_update_and_delete_user', async () => {
    const user = await User.create({ name: 'Jane', email: 'jane@test.com' });
    
    const updated = await User.update(user.id, { 
      name: 'Jane Smith', 
      email: 'jane@test.com', 
      role: 'moderator' 
    });
    expect(updated.name).toBe('Jane Smith');
    
    const deleted = await User.delete(user.id);
    expect(deleted).toBe(true);
  });
});
