const { faker } = require('@faker-js/faker');
const { User, Technician, Request } = require('../Models');

const CATEGORIES = ['سباكة', 'كهرباء', 'طاقة شمسية', 'تبريد وتكييف'];
const LOCATIONS = ['غزة - الشمال', 'غزة - الوسطى', 'غزة - الجنوب', 'غزة - المدينة', 'خان يونس', 'رفح', 'دير البلح', 'جباليا'];

async function seedUsers(count = 10) {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      user_id: faker.number.bigInt({ min: 100000000, max: 999999999 }),
      full_name: faker.person.fullName(),
      phone_number: faker.phone.number(),
      location: faker.helpers.arrayElement(LOCATIONS),
    });
  }
  await User.bulkCreate(users, { ignoreDuplicates: true });
  console.log(`[Seed] Created ${count} users`);
  return users;
}

async function seedTechnicians(count = 5) {
  const techs = [];
  for (let i = 0; i < count; i++) {
    techs.push({
      tech_id: faker.number.bigInt({ min: 100000000, max: 999999999 }),
      full_name: faker.person.fullName(),
      phone_number: faker.phone.number(),
      category: faker.helpers.arrayElement(CATEGORIES),
      location: faker.helpers.arrayElement(LOCATIONS),
      is_available: true,
      rating_avg: faker.number.float({ min: 3, max: 5, precision: 0.1 }),
      status: 'approved',
    });
  }
  await Technician.bulkCreate(techs, { ignoreDuplicates: true });
  console.log(`[Seed] Created ${count} technicians`);
  return techs;
}

async function seedRequests(count = 15) {
  const users = await User.findAll();
  const techs = await Technician.findAll();

  if (users.length === 0 || techs.length === 0) {
    console.warn('[Seed] No users or technicians found. Skipping requests seeding.');
    return;
  }

  const requests = [];
  for (let i = 0; i < count; i++) {
    requests.push({
      client_id: faker.helpers.arrayElement(users).user_id,
      tech_id: faker.helpers.arrayElement(techs).tech_id,
      extracted_category: faker.helpers.arrayElement(CATEGORIES),
      problem_description: faker.lorem.sentence({ min: 5, max: 15 }),
      status: faker.helpers.arrayElement(['pending', 'accepted', 'completed', 'canceled']),
    });
  }
  await Request.bulkCreate(requests, { ignoreDuplicates: true });
  console.log(`[Seed] Created ${count} requests`);
}

async function runAllSeeds() {
  console.log('[Seed] Starting database seeding...');
  await seedUsers(10);
  await seedTechnicians(5);
  await seedRequests(15);
  console.log('[Seed] Seeding completed!');
  process.exit(0);
}

runAllSeeds().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
