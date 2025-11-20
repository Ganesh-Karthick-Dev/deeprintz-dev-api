#!/usr/bin/env node

/**
 * Run GDPR requests table migration
 */

const knex = require('knex');
const dbConfig = require('./utils/knexfile');

async function runMigration() {
  const db = knex(dbConfig.deeprintzDev);
  
  console.log('📋 Creating shopify_gdpr_requests table...');
  
  try {
    // Check if table exists
    const exists = await db.schema.hasTable('shopify_gdpr_requests');
    
    if (exists) {
      console.log('✅ Table shopify_gdpr_requests already exists');
    } else {
      // Create table
      await db.schema.createTable('shopify_gdpr_requests', (table) => {
        table.increments('id').primary();
        table.enum('request_type', ['data_request', 'customer_redact', 'shop_redact']).notNullable();
        table.bigInteger('shop_id').nullable();
        table.string('shop_domain', 255).nullable();
        table.bigInteger('customer_id').nullable();
        table.string('customer_email', 255).nullable();
        table.text('payload').nullable();
        table.enum('status', ['pending', 'processed', 'completed']).defaultTo('pending');
        table.datetime('processed_at').nullable();
        table.datetime('created_at').defaultTo(db.fn.now());
        
        // Indexes
        table.index('shop_domain', 'idx_shop_domain');
        table.index('customer_email', 'idx_customer_email');
        table.index('request_type', 'idx_request_type');
        table.index('status', 'idx_status');
      });
      
      console.log('✅ Table shopify_gdpr_requests created successfully');
    }
    
    console.log('');
    console.log('🎉 Migration complete!');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

