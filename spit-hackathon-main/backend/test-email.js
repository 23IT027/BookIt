/**
 * Email Configuration Test Script
 * Run this to test your email setup: node test-email.js
 */

require('dotenv').config();
const nodemailer = require('nodemailer');

const config = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  user: process.env.EMAIL_USER,
  password: process.env.EMAIL_PASSWORD,
  from: process.env.EMAIL_FROM || 'Appointment Booking <noreply@appointmentbooking.com>'
};

console.log('\n🔍 Testing Email Configuration...\n');
console.log('Configuration:');
console.log(`  Host: ${config.host}`);
console.log(`  Port: ${config.port}`);
console.log(`  Secure: ${config.secure}`);
console.log(`  User: ${config.user ? `${config.user.substring(0, 5)}...` : 'NOT SET'}`);
console.log(`  Password: ${config.password ? '***SET***' : 'NOT SET'}`);
console.log(`  From: ${config.from}\n`);

// Validate configuration
if (!config.user || !config.password) {
  console.error('❌ ERROR: EMAIL_USER and EMAIL_PASSWORD must be set in .env file');
  process.exit(1);
}

// Check for placeholders
const placeholderPatterns = ['yourname', 'your_email', 'example', 'your_gmail_app_password', 'abcdefghijklmnop'];
const isPlaceholder = placeholderPatterns.some(pattern => 
  config.user.toLowerCase().includes(pattern.toLowerCase()) || 
  config.password.toLowerCase().includes(pattern.toLowerCase())
);

if (isPlaceholder) {
  console.error('❌ ERROR: Email credentials appear to be placeholders!');
  console.error('Please update your .env file with real credentials:');
  console.error('  1. EMAIL_USER=your_actual_email@gmail.com');
  console.error('  2. EMAIL_PASSWORD=your_16_character_app_password');
  console.error('  Get App Password at: https://myaccount.google.com/apppasswords\n');
  process.exit(1);
}

// Create transporter
console.log('📧 Creating email transporter...');
const transporter = nodemailer.createTransport({
  host: config.host,
  port: config.port,
  secure: config.secure,
  auth: {
    user: config.user,
    pass: config.password
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test connection
async function testEmail() {
  try {
    console.log('🔐 Verifying SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');
    
    // Send test email
    console.log('📨 Sending test email...');
    const testEmail = process.argv[2] || config.user; // Use provided email or sender email
    
    const info = await transporter.sendMail({
      from: config.from,
      to: testEmail,
      subject: 'Test Email - BookIt Email Configuration',
      html: `
        <h2>✅ Email Configuration Test Successful!</h2>
        <p>If you received this email, your email configuration is working correctly.</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>Host: ${config.host}</li>
          <li>Port: ${config.port}</li>
          <li>User: ${config.user}</li>
        </ul>
        <p>You can now use email verification in your BookIt application.</p>
      `,
      text: 'Email configuration test successful! Your email setup is working correctly.'
    });
    
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Sent to: ${testEmail}`);
    console.log('\n🎉 Email configuration is working correctly!\n');
    
  } catch (error) {
    console.error('\n❌ Email test failed!\n');
    console.error('Error:', error.message);
    console.error('Error Code:', error.code);
    
    if (error.code === 'EAUTH') {
      console.error('\n💡 Authentication Error:');
      console.error('   - Check that EMAIL_USER is your full Gmail address');
      console.error('   - Check that EMAIL_PASSWORD is a Gmail App Password (16 characters)');
      console.error('   - Make sure 2-Step Verification is enabled on your Google account');
      console.error('   - Generate App Password at: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.error('\n💡 Connection Error:');
      console.error('   - Check your internet connection');
      console.error('   - Verify EMAIL_HOST and EMAIL_PORT are correct');
      console.error('   - For Gmail: EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=587');
    } else if (error.code === 'EENVELOPE') {
      console.error('\n💡 Envelope Error:');
      console.error('   - Check that the recipient email address is valid');
    }
    
    console.error('\nFull error details:', error);
    process.exit(1);
  }
}

testEmail();
