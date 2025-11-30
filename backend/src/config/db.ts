import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '10.10.1.90',
    database: process.env.DB_NAME || 'jtsc_db',
    password: process.env.DB_PASSWORD || 'jtsc12345',
    port: parseInt(process.env.DB_PORT || '5432'),
});

pool.on('connect', () => {
    console.log('Connected to the PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export default pool;
