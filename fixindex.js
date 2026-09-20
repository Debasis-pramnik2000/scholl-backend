require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function fixIndex() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB Connected');

    const db = mongoose.connection.db;
    const collection = db.collection('students');

    const indexes = await collection.indexes();
    const hasStaleIndex = indexes.some(idx => idx.name === 'rollNo_1');

    if (hasStaleIndex) {
      await collection.dropIndex('rollNo_1');
      console.log('✅ Dropped stale index: rollNo_1');
    } else {
      console.log('ℹ️  No stale rollNo_1 index found. Nothing to do.');
    }

    await mongoose.disconnect();
    console.log('✅ Done. You can now restart your server normally.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing index:', err.message);
    process.exit(1);
  }
}

fixIndex();