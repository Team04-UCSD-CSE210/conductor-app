import { initializeDatabase } from '../src/database/init.js';
import { UserService } from '../src/services/user-service.js';
import { User } from '../src/models/user.js';
import database from '../src/database/database.js';

/**
 * Performance test for user database operations
 */
async function runPerformanceTest() {
  console.log('Starting performance test...');
  
  try {
    // Initialize database
    await initializeDatabase();
    
    // Clean existing data
    const db = database.getInstance();
    await new Promise((resolve) => {
      db.run('DELETE FROM users', resolve);
    });
    
    console.log('Creating 1000 users...');
    const startTime = Date.now();
    
    // Create 1000 users in batches
    const batchSize = 100;
    const totalUsers = 1000;
    
    for (let i = 0; i < totalUsers; i += batchSize) {
      const promises = [];
      
      for (let j = 0; j < batchSize && (i + j) < totalUsers; j++) {
        const userIndex = i + j + 1;
        promises.push(UserService.createUser({
          name: `User ${userIndex}`,
          email: `user${userIndex}@test.com`,
          role: userIndex % 3 === 0 ? 'admin' : 'user',
          status: 'active'
        }));
      }
      
      await Promise.all(promises);
      console.log(`Created ${Math.min(i + batchSize, totalUsers)} users`);
    }
    
    const createTime = Date.now() - startTime;
    console.log(`✓ Created 1000 users in ${createTime}ms`);
    
    // Test read performance
    console.log('Testing read performance...');
    const readStartTime = Date.now();
    
    // Test pagination
    const result = await UserService.getUsers({ limit: 50, offset: 0 });
    const readTime = Date.now() - readStartTime;
    
    console.log(`✓ Read 50 users in ${readTime}ms`);
    console.log(`✓ Total users in database: ${result.total}`);
    
    // Test filtered queries
    console.log('Testing filtered queries...');
    const filterStartTime = Date.now();
    
    const adminUsers = await UserService.getUsers({ 
      limit: 100, 
      offset: 0, 
      role: 'admin' 
    });
    
    const filterTime = Date.now() - filterStartTime;
    console.log(`✓ Filtered admin users in ${filterTime}ms (found ${adminUsers.users.length})`);
    
    // Test individual lookups
    console.log('Testing individual user lookups...');
    const lookupStartTime = Date.now();
    
    await UserService.getUserById(500);
    const lookupTime = Date.now() - lookupStartTime;
    
    console.log(`✓ Found user by ID in ${lookupTime}ms`);
    
    // Performance summary
    console.log('\n=== Performance Summary ===');
    console.log(`Create 1000 users: ${createTime}ms (${(createTime/1000).toFixed(2)}ms per user)`);
    console.log(`Read 50 users: ${readTime}ms`);
    console.log(`Filter users: ${filterTime}ms`);
    console.log(`Lookup by ID: ${lookupTime}ms`);
    
    // Verify data integrity
    const finalCount = await User.count();
    console.log(`\n✓ Data integrity check: ${finalCount} users in database`);
    
  } catch (error) {
    console.error('Performance test failed:', error.message);
  } finally {
    await database.close();
  }
}

// Run the test
runPerformanceTest();
