// scripts/seed-pendeta.ts
// Run with: npx tsx scripts/seed-pendeta.ts
import { PrismaClient } from '@prisma/client'
import { AUTHORS } from './data/authors'

const prisma = new PrismaClient()

async function main() {
  for (const [code, author] of Object.entries(AUTHORS)) {
    await prisma.pendeta.upsert({
      where: { code },
      update: { name: author.name, titles: author.titles },
      create: { code, name: author.name, titles: author.titles },
    })
    console.log(`seeded: ${code} — ${author.name}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
