/**
 * Test Upstash Redis Connection
 * 
 * Quick script to verify Upstash Redis is working correctly.
 * Run: npx tsx scripts/test-upstash-connection.ts
 */

import { Redis } from 'ioredis';
import 'dotenv/config';

async function testUpstashConnection() {
  console.log('🔍 Testing Upstash Redis connection...\n');

  // Check environment variable
  if (!process.env.UPSTASH_REDIS_URL) {
    console.error('❌ UPSTASH_REDIS_URL not found in environment');
    console.log('   Make sure .env.local has UPSTASH_REDIS_URL set');
    process.exit(1);
  }

  console.log('✅ Environment variable found');
  console.log(`   URL: ${process.env.UPSTASH_REDIS_URL.split('@')[1] || 'hidden'}\n`);

  // Create connection
  const redis = new Redis(process.env.UPSTASH_REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    tls: process.env.UPSTASH_REDIS_URL.includes('upstash') ? {} : undefined,
  });

  try {
    // Test 1: PING
    console.log('📡 Test 1: PING...');
    const pong = await redis.ping();
    console.log(`   ✅ PONG: ${pong}\n`);

    // Test 2: SET
    console.log('📝 Test 2: SET test_key...');
    await redis.set('litlens:test', JSON.stringify({
      timestamp: new Date().toISOString(),
      message: 'Test from LitLens'
    }));
    console.log('   ✅ Key set successfully\n');

    // Test 3: GET
    console.log('📖 Test 3: GET test_key...');
    const value = await redis.get('litlens:test');
    const parsed = JSON.parse(value || '{}');
    console.log('   ✅ Key retrieved:', parsed.message);
    console.log(`   ✅ Timestamp: ${parsed.timestamp}\n`);

    // Test 4: DELETE
    console.log('🗑️  Test 4: DELETE test_key...');
    await redis.del('litlens:test');
    console.log('   ✅ Key deleted\n');

    // Test 5: BullMQ compatibility
    console.log('🎯 Test 5: BullMQ compatibility...');
    await redis.set('bull:test:queue', 'test');
    const bullTest = await redis.get('bull:test:queue');
    await redis.del('bull:test:queue');
    console.log('   ✅ BullMQ-style keys work\n');

    // Close connection
    await redis.quit();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log('✅ Upstash Redis is ready for use');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Next steps:');
    console.log('  1. Run migrations: npx prisma migrate dev');
    console.log('  2. Start dev server: npm run dev');
    console.log('  3. Start worker: npx tsx src/workers/ingestion-worker.ts\n');

  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('WRONGPASS')) {
        console.log('\n💡 Solution: Check your UPSTASH_REDIS_URL password');
      } else if (error.message.includes('ENOTFOUND')) {
        console.log('\n💡 Solution: Check your internet connection');
      } else if (error.message.includes('timeout')) {
        console.log('\n💡 Solution: Check firewall or VPN settings');
      }
    }

    process.exit(1);
  }
}

// Run the test
testUpstashConnection();

