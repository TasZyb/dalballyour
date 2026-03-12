import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.upsert({
    where: {
      name: "Ліга чемпіонів",
    },
    update: {
      season: "2025/26",
    },
    create: {
      name: "Ліга чемпіонів",
      season: "2025/26",
    },
  });

    const users = [
    { name: "Жила Віктор", accessCode: "1232" },
    { name: "Польник Віталій", accessCode: "2232" },
    { name: "Жига Віталій", accessCode: "3232" },
    { name: "Корніцький Андрій", accessCode: "4232" },
    { name: "Зубик Тарас", accessCode: "5232" },
    { name: "Лабайчук Іван", accessCode: "6232" },
    ];

    for (const user of users) {
        await prisma.user.upsert({
            where: {
            name: user.name,
            },
            update: {
            accessCode: user.accessCode,
            },
            create: {
            name: user.name,
            accessCode: user.accessCode,
            },
        });
    }

  const teams = [
    { name: "Ajax", shortName: "AJA" },
    { name: "Arsenal", shortName: "ARS" },
    { name: "Atalanta", shortName: "ATA" },
    { name: "Athletic Club", shortName: "ATH" },
    { name: "Atlético de Madrid", shortName: "ATM" },
    { name: "B Dortmund", shortName: "BVB" },
    { name: "Barcelona", shortName: "BAR" },
    { name: "Bayern München", shortName: "BAY" },
    { name: "Benfica", shortName: "BEN" },
    { name: "Bodø/Glimt", shortName: "BOD" },
    { name: "Chelsea", shortName: "CHE" },
    { name: "Club Brugge", shortName: "BRU" },
    { name: "Copenhagen", shortName: "COP" },
    { name: "Frankfurt", shortName: "SGE" },
    { name: "Galatasaray", shortName: "GAL" },
    { name: "Inter", shortName: "INT" },
    { name: "Juventus", shortName: "JUV" },
    { name: "Kairat Almaty", shortName: "KAI" },
    { name: "Leverkusen", shortName: "B04" },
    { name: "Liverpool", shortName: "LIV" },
    { name: "Man City", shortName: "MCI" },
    { name: "Marseille", shortName: "OM" },
    { name: "Monaco", shortName: "ASM" },
    { name: "Napoli", shortName: "NAP" },
    { name: "Newcastle", shortName: "NEW" },
    { name: "Olympiacos", shortName: "OLY" },
    { name: "Pafos", shortName: "PAF" },
    { name: "Paris", shortName: "PSG" },
    { name: "PSV", shortName: "PSV" },
    { name: "Qarabağ", shortName: "QAR" },
    { name: "Real Madrid", shortName: "RMA" },
    { name: "Slavia Praha", shortName: "SLA" },
    { name: "Sporting CP", shortName: "SCP" },
    { name: "Tottenham", shortName: "TOT" },
    { name: "Union SG", shortName: "USG" },
    { name: "Villarreal", shortName: "VIL" },
  ];

  for (const team of teams) {
    await prisma.team.upsert({
      where: {
        name: team.name,
      },
      update: {
        shortName: team.shortName,
      },
      create: {
        name: team.name,
        shortName: team.shortName,
      },
    });
  }

  console.log("Seed completed");
  console.log(`Tournament: ${tournament.name} ${tournament.season}`);
  console.log(`Users created/updated: ${users.length}`);
  console.log(`Teams created/updated: ${teams.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });