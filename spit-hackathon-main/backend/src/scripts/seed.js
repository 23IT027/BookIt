require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/user.model');
const Provider = require('../models/provider.model');
const AppointmentType = require('../models/appointmentType.model');
const AvailabilityRule = require('../models/availabilityRule.model');

/**
 * Seed script to populate database with sample data
 */

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...\n');

    // Connect to MongoDB
    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Provider.deleteMany({}),
      AppointmentType.deleteMany({}),
      AvailabilityRule.deleteMany({})
    ]);
    console.log('✅ Data cleared');

    // Create Admin User
    console.log('\n👤 Creating admin user...');
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: 'admin123',
      role: 'ADMIN',
      phone: '+1234567890'
    });
    console.log(`✅ Admin created: ${admin.email}`);

    // Create Organiser User
    console.log('\n👤 Creating organiser user...');
    const organiser = await User.create({
      name: 'Dr. Sarah Johnson',
      email: 'organiser@example.com',
      passwordHash: 'organiser123',
      role: 'ORGANISER',
      phone: '+1234567891'
    });
    console.log(`✅ Organiser created: ${organiser.email}`);

    // Create Customer Users
    console.log('\n👤 Creating customer users...');
    const customer1 = await User.create({
      name: 'John Doe',
      email: 'customer1@example.com',
      passwordHash: 'customer123',
      role: 'CUSTOMER',
      phone: '+1234567892'
    });

    const customer2 = await User.create({
      name: 'Jane Smith',
      email: 'customer2@example.com',
      passwordHash: 'customer123',
      role: 'CUSTOMER',
      phone: '+1234567893'
    });
    console.log(`✅ Customers created: ${customer1.email}, ${customer2.email}`);

    // Create Provider
    console.log('\n🏥 Creating provider...');
    const provider = await Provider.create({
      name: 'Johnson Medical Clinic',
      userId: organiser._id,
      description: 'Professional medical consultation services',
      specialization: 'General Medicine',
      timezone: 'America/New_York',
      contactEmail: 'contact@johnsonclinic.com',
      contactPhone: '+1234567894',
      address: {
        street: '123 Medical Plaza',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      }
    });
    console.log(`✅ Provider created: ${provider.name}`);

    // Create Appointment Types
    console.log('\n📅 Creating appointment types...');
    
    const consultationType = await AppointmentType.create({
      title: 'General Consultation',
      description: 'Standard medical consultation with experienced physician',
      durationMinutes: 30,
      bufferMinutes: 10,
      capacity: 1,
      price: 500,
      currency: 'INR',
      published: true,
      organiserId: organiser._id,
      providerId: provider._id,
      category: 'Medical',
      tags: ['consultation', 'general'],
      location: {
        type: 'IN_PERSON',
        address: '123 Medical Plaza, New York, NY 10001'
      },
      questions: [
        {
          question: 'What is the reason for your visit?',
          type: 'TEXTAREA',
          required: true
        },
        {
          question: 'Do you have any allergies?',
          type: 'TEXT',
          required: false
        }
      ],
      requiresApproval: false,
      cancellationPolicy: {
        allowed: true,
        hoursBeforeStart: 24,
        refundPercentage: 100
      }
    });

    const followUpType = await AppointmentType.create({
      title: 'Follow-up Consultation',
      description: 'Quick follow-up appointment for existing patients',
      durationMinutes: 15,
      bufferMinutes: 5,
      capacity: 1,
      price: 250,
      currency: 'INR',
      published: true,
      organiserId: organiser._id,
      providerId: provider._id,
      category: 'Medical',
      tags: ['follow-up', 'quick'],
      location: {
        type: 'ONLINE',
        meetingLink: 'https://meet.example.com/followup'
      },
      requiresApproval: false,
      cancellationPolicy: {
        allowed: true,
        hoursBeforeStart: 12,
        refundPercentage: 50
      }
    });

    const physicalType = await AppointmentType.create({
      title: 'Physical Examination',
      description: 'Comprehensive physical examination and health checkup',
      durationMinutes: 60,
      bufferMinutes: 15,
      capacity: 1,
      price: 1000,
      currency: 'INR',
      published: true,
      organiserId: organiser._id,
      providerId: provider._id,
      category: 'Medical',
      tags: ['physical', 'examination', 'checkup'],
      location: {
        type: 'IN_PERSON',
        address: '123 Medical Plaza, New York, NY 10001'
      },
      questions: [
        {
          question: 'When was your last physical examination?',
          type: 'TEXT',
          required: true
        }
      ],
      requiresApproval: true,
      cancellationPolicy: {
        allowed: true,
        hoursBeforeStart: 48,
        refundPercentage: 75
      }
    });

    console.log(`✅ Created ${3} appointment types`);

    // Create Availability Rules
    console.log('\n⏰ Creating availability rules...');
    
    const weekdayRules = [];
    
    // Monday to Friday: 9 AM - 5 PM
    for (let day = 1; day <= 5; day++) {
      weekdayRules.push({
        providerId: provider._id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        effectiveFrom: new Date('2024-01-01'), // Past date so rules are active now
        effectiveTo: null,
        isActive: true,
        recurrence: 'WEEKLY'
      });
    }

    // Saturday: 10 AM - 2 PM
    weekdayRules.push({
      providerId: provider._id,
      dayOfWeek: 6,
      startTime: '10:00',
      endTime: '14:00',
      effectiveFrom: new Date('2024-01-01'), // Past date so rules are active now
      effectiveTo: null,
      isActive: true,
      recurrence: 'WEEKLY'
    });

    // Sunday: 10 AM - 1 PM (half day)
    weekdayRules.push({
      providerId: provider._id,
      dayOfWeek: 0,
      startTime: '10:00',
      endTime: '13:00',
      effectiveFrom: new Date('2024-01-01'),
      effectiveTo: null,
      isActive: true,
      recurrence: 'WEEKLY'
    });

    await AvailabilityRule.insertMany(weekdayRules);
    console.log(`✅ Created ${weekdayRules.length} availability rules (Mon-Sun)`);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Database seeding completed successfully!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Users: ${await User.countDocuments()}`);
    console.log(`   Providers: ${await Provider.countDocuments()}`);
    console.log(`   Appointment Types: ${await AppointmentType.countDocuments()}`);
    console.log(`   Availability Rules: ${await AvailabilityRule.countDocuments()}`);
    
    console.log('\n🔑 Test Accounts:');
    console.log('   Admin:     admin@example.com / admin123');
    console.log('   Organiser: organiser@example.com / organiser123');
    console.log('   Customer1: customer1@example.com / customer123');
    console.log('   Customer2: customer2@example.com / customer123');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Login with any test account');
    console.log('   3. Use Postman collection for API testing');
    console.log('   4. Test booking flow with customer accounts');
    console.log('   5. Test concurrency with concurrency.test.js');
    
    console.log('\n✅ Happy hacking! 🚀\n');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📡 MongoDB connection closed');
    process.exit(0);
  }
};

// Run seed script
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
