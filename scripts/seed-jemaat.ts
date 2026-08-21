// scripts/seed-jemaat.ts
// Run with: npx tsx scripts/seed-jemaat.ts
import { PrismaClient } from '@prisma/client'
import { MINISTRIES } from './data/ministries'

const prisma = new PrismaClient()

function slugify(name: string): string {
  return name
    .replace(/^(jemaat|bpi)\s+/i, '') // drop a leading "Jemaat " / "BPI " — redundant in a slug
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9\s-]/g, '') // also strips the quote marks around congregation names
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function main() {
  // Only rows that represent an actual congregation holding its own
  // services ("jemaat", "bpi", "international") map to a tenant with its
  // own liturgi subdomain. Synod-level bodies ("org") and synod-wide
  // fellowship groups ("kategorial") aren't a congregation, so they're
  // skipped here — see the comment in scripts/data/ministries.ts.
  const jemaatEntries = MINISTRIES.filter((m) =>
    m.type === 'jemaat' || m.type === 'bpi' || m.type === 'international',
  )

  for (const entry of jemaatEntries) {
    const slug = slugify(entry.name)
    await prisma.jemaat.upsert({
      where: { slug },
      update: { name: entry.name, category: entry.category },
      create: { slug, name: entry.name, category: entry.category },
    })
    console.log(`seeded: ${slug}`)
  }

  console.log(`\n${jemaatEntries.length} jemaat/BPI seeded (of ${MINISTRIES.length} total entries).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
