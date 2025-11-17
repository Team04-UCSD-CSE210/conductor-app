import { RosterService } from '../src/services/roster-service.js';

/**
 * Example demonstrating roster import/export operations
 * This demonstrates bulk roster management capabilities for large-scale course administration
 */
async function runExample() {
  console.log('=== Roster Import/Export Example ===\n');

  try {
    // 1. Export roster to JSON
    console.log('1. Exporting roster to JSON...');
    const jsonRoster = await RosterService.exportRosterToJson();
    console.log(`✓ Exported ${jsonRoster.length} users to JSON format`);
    if (jsonRoster.length > 0) {
      console.log('   Sample user:', JSON.stringify(jsonRoster[0], null, 2));
    }

    // 2. Export roster to CSV
    console.log('\n2. Exporting roster to CSV...');
    const csvData = await RosterService.exportRosterToCsv();
    console.log(`✓ Exported ${jsonRoster.length} users to CSV format`);
    console.log('   CSV preview (first 200 chars):');
    console.log('   ' + csvData.substring(0, 200).replace(/\n/g, '\\n') + '...');

    // 3. Import roster from JSON
    console.log('\n3. Importing roster from JSON...');
    const jsonImportData = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        role: 'user',
        status: 'active',
      },
      {
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        role: 'admin',
        status: 'active',
      },
    ];

    const jsonResult = await RosterService.importRosterFromJson(jsonImportData);
    console.log(`✓ Imported ${jsonResult.imported.length} users successfully`);
    console.log(`   Failed: ${jsonResult.failed.length}`);
    if (jsonResult.failed.length > 0) {
      console.log('   Failure details:', jsonResult.failed);
    }

    // 4. Import roster from CSV
    console.log('\n4. Importing roster from CSV...');
    const csvImportData = `name,email,role,status
Alice Johnson,alice.johnson@example.com,user,active
Bob Williams,bob.williams@example.com,moderator,active`;

    const csvResult = await RosterService.importRosterFromCsv(csvImportData);
    console.log(`✓ Imported ${csvResult.imported.length} users successfully`);
    console.log(`   Failed: ${csvResult.failed.length}`);
    if (csvResult.failed.length > 0) {
      console.log('   Failure details:', csvResult.failed);
    }

    // 5. Verify final count
    console.log('\n5. Verifying final roster count...');
    const finalRoster = await RosterService.exportRosterToJson();
    console.log(`✓ Total users in database: ${finalRoster.length}`);

    console.log('\n=== Example completed successfully! ===');
    console.log('\nAPI Endpoints:');
    console.log('  POST /users/roster/import/json - Import roster from JSON array');
    console.log('  POST /users/roster/import/csv - Import roster from CSV (file or text)');
    console.log('  GET  /users/roster/export/json - Export roster as JSON');
    console.log('  GET  /users/roster/export/csv - Export roster as CSV');
  } catch (error) {
    console.error('Example failed:', error.message);
    console.error(error.stack);
  }
}

// Run the example
runExample().catch(console.error);

