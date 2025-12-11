import { Client } from 'pg';

async function createDatabase() {
    // Connect to default 'postgres' database first
    const client = new Client({
        host: '192.168.1.90',
        port: 5432,
        user: 'postgres',
        password: 'jtsc12345',
        database: 'postgres' // Connect to default DB
    });

    try {
        await client.connect();
        console.log('✅ Connected to PostgreSQL server');

        // Check if database exists
        const checkDb = await client.query(
            "SELECT 1 FROM pg_database WHERE datname = 'jtsc_db'"
        );

        if (checkDb.rows.length === 0) {
            console.log('Creating database jtsc_db...');
            await client.query('CREATE DATABASE jtsc_db');
            console.log('✅ Database jtsc_db created');
        } else {
            console.log('✅ Database jtsc_db already exists');
        }

        await client.end();
        console.log('✅ Done! Now run: npx prisma db push');
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

createDatabase();
