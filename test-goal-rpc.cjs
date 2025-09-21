require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGoalRPCs() {
  console.log('=== Testing Goal RPC Functions ===');
  
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  
  // Test get_user_goal_progress
  console.log('\n1. Testing get_user_goal_progress with user_id...');
  const { data: progress1, error: error1 } = await supabase.rpc('get_user_goal_progress', { 
    user_id: testUserId 
  });
  console.log('Result:', { data: progress1, error: error1 });
  
  if (error1) {
    console.log('   Testing get_user_goal_progress with p_user_id...');
    const { data: progress2, error: error2 } = await supabase.rpc('get_user_goal_progress', { 
      p_user_id: testUserId 
    });
    console.log('   Result with p_user_id:', { data: progress2, error: error2 });
  }
  
  // Test get_family_goals
  console.log('\n2. Testing get_family_goals with user_id...');
  const { data: family1, error: ferror1 } = await supabase.rpc('get_family_goals', { 
    user_id: testUserId 
  });
  console.log('Result:', { data: family1, error: ferror1 });
  
  if (ferror1) {
    console.log('   Testing get_family_goals with p_user_id...');
    const { data: family2, error: ferror2 } = await supabase.rpc('get_family_goals', { 
      p_user_id: testUserId 
    });
    console.log('   Result with p_user_id:', { data: family2, error: ferror2 });
  }
}

testGoalRPCs().catch(console.error);