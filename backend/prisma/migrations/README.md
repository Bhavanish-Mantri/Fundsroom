# Prisma Migrations

This folder is reserved for generated migration files.

Use the following workflow in a local PostgreSQL environment:

1. Update `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <migration_name>`
3. Commit the generated SQL migration files
4. Keep seed data in `prisma/seed.js`
