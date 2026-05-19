require('dotenv').config()
const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const slugify  = require('slugify')

const User        = require('../models/User')
const Job         = require('../models/Job')
const Service     = require('../models/Service')
const Testimonial = require('../models/Testimonial')

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Job.deleteMany({}),
      Service.deleteMany({}),
      Testimonial.deleteMany({}),
    ])
    console.log('🗑️  Cleared existing data')

    // Create users
    const hashedPass = await bcrypt.hash('Admin@1234', 12)

    const [superAdmin, admin, employer, jobSeeker] = await User.insertMany([
      {
        firstName: 'Super', lastName: 'Admin', email: 'superadmin@prolink.com',
        password: hashedPass, role: 'super_admin', isVerified: true, isActive: true,
      },
      {
        firstName: 'Admin', lastName: 'User', email: 'admin@prolink.com',
        password: hashedPass, role: 'admin', isVerified: true, isActive: true,
      },
      {
        firstName: 'Tech', lastName: 'Corp', email: 'employer@prolink.com',
        password: hashedPass, role: 'employer', isVerified: true, isActive: true,
        company: { name: 'TechCorp India', website: 'https://techcorp.in', industry: 'IT & Software', size: '500-1000' },
      },
      {
        firstName: 'Rahul', lastName: 'Sharma', email: 'jobseeker@prolink.com',
        password: hashedPass, role: 'job_seeker', isVerified: true, isActive: true,
        profile: { headline: 'Full Stack Developer', skills: ['React', 'Node.js', 'MongoDB'], experience: '2 years' },
      },
    ])
    console.log('👥 Users created')

    // Create services
    const services = await Service.insertMany([
      {
        name: 'Job Consultancy', slug: 'job-consultancy', isActive: true, order: 1,
        shortDescription: 'End-to-end recruitment solutions for companies and candidates',
        description: 'Our Job Consultancy service provides comprehensive recruitment support...',
        icon: '💼',
        features: [
          { title: 'Expert Recruitment', description: 'Seasoned HR professionals with 8+ years experience' },
          { title: 'Pan-India Network', description: 'Access to 10,000+ candidates across all industries' },
          { title: 'Fast Placement', description: 'Average placement time of 21 days' },
        ],
        pricing: [
          { plan: 'Basic', price: 999, features: ['5 Job Postings', 'Email Support'] },
          { plan: 'Premium', price: 2499, features: ['20 Job Postings', 'Priority Support', 'Featured Listings'], isPopular: true },
        ],
        faqs: [
          { question: 'How long does placement take?', answer: 'On average 14-21 days for verified profiles.' },
          { question: 'What industries do you cover?', answer: 'IT, BFSI, Manufacturing, Healthcare, and more.' },
        ],
      },
      {
        name: 'CV Writing', slug: 'cv-writing', isActive: true, order: 2,
        shortDescription: 'ATS-optimised resumes that get you shortlisted',
        description: 'Professional CV writing service by certified resume writers...',
        icon: '📄',
        pricing: [
          { plan: 'Basic',    price: 499,  features: ['1 Page', 'ATS Optimized', '1 Revision'] },
          { plan: 'Standard', price: 999,  features: ['2 Pages', 'ATS + LinkedIn', '3 Revisions'], isPopular: true },
          { plan: 'Premium',  price: 1999, features: ['Unlimited Pages', 'Cover Letter', 'Unlimited Revisions'] },
        ],
      },
      { name: 'Campus Drive',           slug: 'campus-drive',           isActive: true, order: 3, shortDescription: 'College-to-company placement drives', description: '...', icon: '🎓' },
      { name: 'House Keeping Services', slug: 'housekeeping',           isActive: true, order: 4, shortDescription: 'Professional housekeeping staff placement', description: '...', icon: '🏠' },
      { name: 'Catering Services',      slug: 'catering',               isActive: true, order: 5, shortDescription: 'Indoor & outdoor catering for all occasions', description: '...', icon: '🍽️' },
      { name: 'Event Management',       slug: 'event-management',       isActive: true, order: 6, shortDescription: 'Corporate and personal event planning', description: '...', icon: '🎉' },
      { name: 'Plant Set-Up',           slug: 'plant-setup',            isActive: true, order: 7, shortDescription: 'Industrial staffing for plant operations', description: '...', icon: '🏭' },
      { name: 'Background Verification',slug: 'background-verification',isActive: true, order: 8, shortDescription: 'Comprehensive background checks', description: '...', icon: '🔍' },
      { name: 'HR Outsourcing',         slug: 'hr-outsourcing',         isActive: true, order: 9, shortDescription: 'Full-spectrum HR services for businesses', description: '...', icon: '👥' },
    ])
    console.log('🛠  Services created')

    // Create sample jobs (generate slugs to avoid null unique-key conflicts)
    const jobSeed = [
      {
        title: 'Senior React Developer', postedBy: employer._id, status: 'active', featured: true,
        company: { name: 'TechCorp India', website: 'https://techcorp.in' },
        description: 'We are looking for a Senior React Developer to join our team...',
        category: 'IT & Software', type: 'full_time', locationType: 'hybrid',
        location: 'Bengaluru, Karnataka',
        experience: { min: 3, max: 6 },
        salary: { min: 1200000, max: 2000000, currency: 'INR', period: 'yearly', isVisible: true },
        skills: ['React', 'TypeScript', 'Redux', 'Node.js', 'REST APIs'],
        openings: 3,
      },
      {
        title: 'HR Manager', postedBy: employer._id, status: 'active', featured: true,
        company: { name: 'Global Solutions Ltd' },
        description: 'Seeking an experienced HR Manager for our Chennai office...',
        category: 'Human Resources', type: 'full_time', locationType: 'onsite',
        location: 'Chennai, Tamil Nadu',
        experience: { min: 5, max: 10 },
        salary: { min: 800000, max: 1400000, currency: 'INR', period: 'yearly', isVisible: true },
        skills: ['Recruitment', 'HR Policies', 'Payroll', 'HRIS', 'Labour Law'],
        openings: 1,
      },
      {
        title: 'Digital Marketing Executive', postedBy: employer._id, status: 'active',
        company: { name: 'BrandBurst Agency' },
        description: 'Join our fast-growing digital marketing agency...',
        category: 'Marketing & Sales', type: 'full_time', locationType: 'remote',
        location: 'Remote',
        experience: { min: 1, max: 3 },
        salary: { min: 400000, max: 700000, currency: 'INR', period: 'yearly', isVisible: true },
        skills: ['SEO', 'Social Media', 'Google Ads', 'Content Marketing', 'Analytics'],
        openings: 2, urgent: true,
      },
      {
        title: 'Python Data Analyst', postedBy: employer._id, status: 'active', featured: true,
        company: { name: 'DataInsights Pvt Ltd' },
        description: 'Looking for a data analyst with Python expertise...',
        category: 'IT & Software', type: 'full_time', locationType: 'hybrid',
        location: 'Hyderabad, Telangana',
        experience: { min: 2, max: 5 },
        salary: { min: 900000, max: 1600000, currency: 'INR', period: 'yearly', isVisible: true },
        skills: ['Python', 'Pandas', 'SQL', 'Power BI', 'Machine Learning'],
        openings: 2,
      },
      {
        title: 'Fresher – Java Developer', postedBy: employer._id, status: 'active',
        company: { name: 'Infoway Technologies' },
        description: 'Great opportunity for fresh graduates with Java knowledge...',
        category: 'IT & Software', type: 'full_time', locationType: 'onsite',
        location: 'Pune, Maharashtra',
        experience: { min: 0, max: 1 },
        salary: { min: 300000, max: 500000, currency: 'INR', period: 'yearly', isVisible: true },
        skills: ['Java', 'Spring Boot', 'MySQL', 'Git'],
        openings: 10,
      },
    ]

    // add generated slugs
    const jobsWithSlugs = jobSeed.map(j => ({
      ...j,
      slug: slugify(j.title, { lower: true, strict: true }),
    }))

    const jobs = await Job.insertMany(jobsWithSlugs)
    console.log('💼 Jobs created')

    // Create testimonials
    await Testimonial.insertMany([
      { name: 'Priya Sharma',  designation: 'Software Engineer', company: 'TCS',     rating: 5, content: 'ProLink helped me land my dream job within 3 weeks!', isApproved: true, isFeatured: true, order: 1 },
      { name: 'Rahul Gupta',   designation: 'HR Manager',        company: 'Infosys', rating: 5, content: 'Best campus hiring partner we have worked with.', isApproved: true, isFeatured: true, order: 2 },
      { name: 'Ananya Reddy',  designation: 'Marketing Lead',    company: 'Wipro',   rating: 5, content: 'The CV writing service transformed my resume completely!', isApproved: true, isFeatured: true, order: 3 },
    ])
    console.log('⭐ Testimonials created')

    console.log('\n✅ Seeding complete!')
    console.log('\n🔑 Demo credentials:')
    console.log('   Super Admin: superadmin@prolink.com / Admin@1234')
    console.log('   Admin:       admin@prolink.com / Admin@1234')
    console.log('   Employer:    employer@prolink.com / Admin@1234')
    console.log('   Job Seeker:  jobseeker@prolink.com / Admin@1234')

    process.exit(0)
  } catch (error) {
    console.error('❌ Seeding failed:', error)
    process.exit(1)
  }
}

seed()
