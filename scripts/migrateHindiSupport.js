db = db.getSiblingDB('guruapi_local');

print('=== Hindi Support Migration ===\n');

print('Step 1: Add primaryLanguage field to existing questions...');
const result1 = db.questionBanks.updateMany(
  { primaryLanguage: { $exists: false } },
  { $set: { primaryLanguage: 'en' } }
);
print(`Updated ${result1.modifiedCount} documents to have primaryLanguage: 'en'`);

print('\nStep 2: Detect bilingual questions (have question_hi field)...');
const bilingualCount = db.questionBanks.countDocuments({
  question_hi: { $exists: true, $ne: '', $ne: null }
});
print(`Found ${bilingualCount} bilingual questions`);

if (bilingualCount > 0) {
  const result2 = db.questionBanks.updateMany(
    { 
      question_hi: { $exists: true, $ne: '', $ne: null },
      primaryLanguage: 'en'
    },
    { $set: { primaryLanguage: 'bilingual' } }
  );
  print(`Updated ${result2.modifiedCount} documents to bilingual`);
}

print('\nStep 3: Create indexes for Hindi fields...');
db.questionBanks.createIndex({ primaryLanguage: 1 });
db.questionBanks.createIndex({ question_hi: 'text' });
print('Indexes created');

print('\n=== Migration Complete ===\n');

print('Summary:');
print(`- Total questions: ${db.questionBanks.countDocuments()}`);
print(`- English questions: ${db.questionBanks.countDocuments({ primaryLanguage: 'en' })}`);
print(`- Bilingual questions: ${db.questionBanks.countDocuments({ primaryLanguage: 'bilingual' })}`);
print(`- Hindi questions: ${db.questionBanks.countDocuments({ primaryLanguage: 'hi' })}`);
