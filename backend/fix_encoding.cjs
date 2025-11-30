const fs = require('fs');
const content = `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

import authRoutes from './routes/authRoutes.js';

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    res.send('JTSC Project Management API');
});

app.get('/health', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});

app.listen(port, () => {
    console.log(\`Server is running on port \${port}\`);
});
`;

fs.writeFileSync('src/index.ts', content, { encoding: 'utf8' });
console.log('Fixed src/index.ts encoding');
