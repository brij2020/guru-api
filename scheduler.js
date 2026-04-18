const mongoose = require('mongoose');
const connectDB = require('./config/db');
const config = require('./config/env');
const studyPlanSchedulerService = require('./services/studyPlanSchedulerService');

const runScheduler = async () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  console.log(`[${now.toISOString()}] Study Planner Scheduler running...`);
  console.log(`Current day of week: ${dayOfWeek} (0=Sunday, 5=Friday, 6=Saturday)`);
  
  if (dayOfWeek !== 5 && dayOfWeek !== 6) {
    console.log('Not a lock day (Friday or Saturday). Skipping.');
    process.exit(0);
  }
  
  const lockDay = dayOfWeek === 5 ? 'friday' : 'saturday';
  console.log(`Processing users with lockDay: ${lockDay}`);
  
  try {
    await connectDB();
    
    const results = await studyPlanSchedulerService.processAllUsersForLockDay(lockDay);
    
    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedCount = results.filter(r => !r.success && !r.skipped).length;
    
    console.log('\n=== Weekly Test Generation Summary ===');
    console.log(`Total users processed: ${results.length}`);
    console.log(`Tests generated: ${successCount}`);
    console.log(`Skipped (no topics or already generated): ${skippedCount}`);
    console.log(`Failed: ${failedCount}`);
    
    if (failedCount > 0) {
      console.log('\nFailed users:');
      results.filter(r => !r.success && !r.skipped).forEach(r => {
        console.log(`  - ${r.userName} (${r.userId}): ${r.error}`);
      });
    }
    
    console.log(`\nCompleted at: ${new Date().toISOString()}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Scheduler error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  runScheduler();
}

module.exports = { runScheduler };
