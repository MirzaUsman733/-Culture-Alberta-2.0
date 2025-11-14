// Simple script to check database schema
// Run this with: node check-db-schema.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = 'https://itdmwpbsnviassgqfhxk.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZG13cGJzbnZpdmFzc2dxZmh4ayIsInJlc291cmNlIjoic3ViYXNlYyIsImlhdCI6MTczMTYyOTI5MiwiZXhwIjoyMDQ3MjA1MjkyfQ.T3H8J8mBQzTJf687K0OjOZx2p5wzC2pZ8H1j4WUJwQ'

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkSchema() {
  try {
    console.log('Checking articles table schema...')
    
    // Try to query the table structure
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .limit(1)

    if (error) {
      console.error('Error querying articles table:', error)
      return
    }

    console.log('Articles table exists and is accessible')
    
    // Try to insert a test record with trending flags
    const testData = {
      title: 'Test Article',
      content: 'Test content',
      trending_home: true,
      trending_edmonton: false,
      trending_calgary: false
    }

    console.log('Testing insert with trending flags...')
    const { data: insertData, error: insertError } = await supabase
      .from('articles')
      .insert([testData])
      .select()

    if (insertError) {
      console.error('Error inserting test data:', insertError)
      console.log('This suggests the trending columns may not exist')
    } else {
      console.log('Successfully inserted test data with trending flags')
      
      // Clean up test data
      await supabase
        .from('articles')
        .delete()
        .eq('title', 'Test Article')
    }

  } catch (error) {
    console.error('Error checking schema:', error)
  }
}

checkSchema()
