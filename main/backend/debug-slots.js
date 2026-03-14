// Quick Debug Script - Check Availability Rules
// Run this in your MongoDB shell or via Node.js

const mongoose = require('mongoose');

// Connect to your MongoDB
mongoose.connect('YOUR_MONGODB_CONNECTION_STRING');

const AvailabilityRule = require('./src/models/availabilityRule.model');

async function debugSlots() {
  const providerId = '6946487c722aeafcd62774fa';
  const date = '2025-12-23';
  
  console.log('🔍 Debugging Slot Generation');
  console.log('=' .repeat(50));
  
  // 1. Check the date and day of week
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay(); // 0=Sunday, 1=Monday, etc.
  
  console.log('\n📅 Date Information:');
  console.log(`   Date: ${date}`);
  console.log(`   Day of Week: ${dayOfWeek}`);
  console.log(`   Day Name: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
  
  // 2. Check ALL availability rules for this provider
  const allRules = await AvailabilityRule.find({ providerId });
  
  console.log('\n📋 All Availability Rules for Provider:');
  console.log(`   Total rules: ${allRules.length}`);
  
  if (allRules.length === 0) {
    console.log('\n❌ NO RULES FOUND!');
    console.log('   Solution: Create an availability rule first!');
    console.log('\n   Example:');
    console.log('   POST /api/availability');
    console.log('   {');
    console.log('     "providerId": "' + providerId + '",');
    console.log(`     "dayOfWeek": ${dayOfWeek},  // ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}`);
    console.log('     "startTime": "09:00",');
    console.log('     "endTime": "17:00"');
    console.log('   }');
  } else {
    allRules.forEach((rule, index) => {
      console.log(`\n   Rule ${index + 1}:`);
      console.log(`      ID: ${rule._id}`);
      console.log(`      Day of Week: ${rule.dayOfWeek} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][rule.dayOfWeek]})`);
      console.log(`      Time: ${rule.startTime} - ${rule.endTime}`);
      console.log(`      Active: ${rule.isActive}`);
      console.log(`      Effective From: ${rule.effectiveFrom}`);
      console.log(`      Effective To: ${rule.effectiveTo || 'No end date'}`);
      console.log(`      Exceptions: ${rule.exceptions?.length || 0}`);
    });
  }
  
  // 3. Check rules that MATCH the criteria
  const matchingRules = await AvailabilityRule.find({
    providerId,
    dayOfWeek,
    isActive: true,
    effectiveFrom: { $lte: targetDate },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $gte: targetDate } }
    ]
  });
  
  console.log('\n\n🎯 Matching Rules for Date ' + date + ':');
  console.log(`   Found: ${matchingRules.length} matching rules`);
  
  if (matchingRules.length === 0) {
    console.log('\n❌ NO MATCHING RULES!');
    console.log('\n   Possible reasons:');
    console.log(`   1. No rule for ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]} (dayOfWeek: ${dayOfWeek})`);
    console.log(`   2. Rules are inactive (isActive: false)`);
    console.log(`   3. effectiveFrom is after ${date}`);
    console.log(`   4. effectiveTo is before ${date}`);
    
    console.log('\n   What you need:');
    console.log(`   - dayOfWeek: ${dayOfWeek} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]})`);
    console.log(`   - isActive: true`);
    console.log(`   - effectiveFrom: <= ${date}`);
    console.log(`   - effectiveTo: >= ${date} (or null)`);
  } else {
    matchingRules.forEach((rule, index) => {
      console.log(`\n   ✅ Rule ${index + 1} MATCHES:`);
      console.log(`      Time: ${rule.startTime} - ${rule.endTime}`);
      console.log(`      This should generate slots!`);
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  mongoose.connection.close();
}

debugSlots().catch(console.error);
