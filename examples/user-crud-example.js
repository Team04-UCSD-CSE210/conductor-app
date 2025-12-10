import { initializeDatabase } from '../src/database/init.js';
import { UserService } from '../src/services/user-service.js';
import database from '../src/database/database.js';

/**
 * Example demonstrating user CRUD operations
 */
try {
  console.log('=== User CRUD Operations Example ===\n');
  
    await initializeDatabase();
    
    console.log('1. Creating users...');
    
    const user1 = await UserService.createUser({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      role: 'admin'
    });
    console.log('✓ Created admin user:', user1.name);
    
    const user2 = await UserService.createUser({
      name: 'Bob Smith',
      email: 'bob@example.com',
      role: 'user'
    });
    console.log('✓ Created regular user:', user2.name);
    
    console.log('\n2. Reading user by ID...');
    const foundUser = await UserService.getUserById(user1.id);
    console.log('✓ Found user:', foundUser.name, `(${foundUser.email})`);
    
    console.log('\n3. Updating user...');
    const updatedUser = await UserService.updateUser(user2.id, {
      name: 'Robert Smith',
      role: 'moderator'
    });
    console.log('✓ Updated user:', updatedUser.name, `- Role: ${updatedUser.role}`);
    
    console.log('\n4. Listing all users...');
    const allUsers = await UserService.getUsers();
    console.log(`✓ Found ${allUsers.total} users:`);
    allUsers.users.forEach(user => {
      console.log(`  - ${user.name} (${user.role})`);
    });
    
    console.log('\n5. Filtering users by role...');
    const adminUsers = await UserService.getUsers({ role: 'admin' });
    console.log(`✓ Found ${adminUsers.users.length} admin users:`);
    adminUsers.users.forEach(user => {
      console.log(`  - ${user.name}`);
    });
    
    console.log('\n6. Deleting user...');
    await UserService.deleteUser(user2.id);
    console.log('✓ Deleted user:', user2.name);
    
    console.log('\n7. Verifying deletion...');
    const remainingUsers = await UserService.getUsers();
    console.log(`✓ Remaining users: ${remainingUsers.total}`);
    
    console.log('\n=== Example completed successfully! ===');
    
  } catch (error) {
    console.error('Example failed:', error.message);
  process.exit(1);
  } finally {
    await database.close();
  }
