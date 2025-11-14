#!/usr/bin/env node

/**
 * Database Structure Check Script
 * 
 * This script checks what tables and columns exist in your database
 * to help fix the webhook storage issue.
 */

const mysql = require('mysql2/promise');

// Database configuration - adjust these values
const dbConfig = {
  host: 'localhost',
  user: 'your_username', // Replace with your actual database username
  password: 'your_password', // Replace with your actual database password
  database: 'your_database_name' // Replace with your actual database name
};

async function checkDatabaseStructure() {
  let connection;
  
  try {
    console.log('🔍 Checking Database Structure...\n');
    
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully\n');
    
    // Check if woocommerce_orders table exists
    console.log('📋 Checking for woocommerce_orders table...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'woocommerce_orders'
    `, [dbConfig.database]);
    
    if (tables.length > 0) {
      console.log('✅ woocommerce_orders table exists');
      
      // Check table structure
      console.log('\n📋 Checking woocommerce_orders table structure...');
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'woocommerce_orders'
        ORDER BY ORDINAL_POSITION
      `, [dbConfig.database]);
      
      console.log('📊 Table Structure:');
      columns.forEach(col => {
        console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'} ${col.COLUMN_DEFAULT ? `DEFAULT ${col.COLUMN_DEFAULT}` : ''}`);
      });
      
    } else {
      console.log('❌ woocommerce_orders table does NOT exist');
      
      // Check what tables exist
      console.log('\n📋 Checking what tables exist...');
      const [allTables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? 
        ORDER BY TABLE_NAME
      `, [dbConfig.database]);
      
      console.log('📊 Existing Tables:');
      allTables.forEach(table => {
        console.log(`  ${table.TABLE_NAME}`);
      });
      
      // Check if there are any woocommerce related tables
      const [wooTables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE '%woo%'
        ORDER BY TABLE_NAME
      `, [dbConfig.database]);
      
      if (wooTables.length > 0) {
        console.log('\n📋 WooCommerce related tables found:');
        wooTables.forEach(table => {
          console.log(`  ${table.TABLE_NAME}`);
        });
      }
    }
    
    // Check if orders table exists (your main orders table)
    console.log('\n📋 Checking for main orders table...');
    const [ordersTable] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
    `, [dbConfig.database]);
    
    if (ordersTable.length > 0) {
      console.log('✅ orders table exists');
      
      // Check orders table structure
      const [orderColumns] = await connection.execute(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'
        ORDER BY ORDINAL_POSITION
        LIMIT 10
      `, [dbConfig.database]);
      
      console.log('📊 Orders Table Structure (first 10 columns):');
      orderColumns.forEach(col => {
        console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE} ${col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log('❌ orders table does NOT exist');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n🔧 Access denied. Please check your database credentials:');
      console.log('   - Username:', dbConfig.user);
      console.log('   - Password: [hidden]');
      console.log('   - Database:', dbConfig.database);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection refused. Please check:');
      console.log('   - Database server is running');
      console.log('   - Host and port are correct');
    }
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the check
if (require.main === module) {
  console.log('🚀 Starting Database Structure Check...\n');
  console.log('⚠️  IMPORTANT: Update the dbConfig object with your actual database credentials before running!');
  console.log('   - host: your database host');
  console.log('   - user: your database username');
  console.log('   - password: your database password');
  console.log('   - database: your database name\n');
  
  checkDatabaseStructure();
}

module.exports = { checkDatabaseStructure };
