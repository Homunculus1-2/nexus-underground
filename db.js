const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  const client = await pool.connect();
  try {
    // Akkauntlar
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL,
        title VARCHAR(200) NOT NULL,
        tag VARCHAR(100) NOT NULL,
        region VARCHAR(50),
        kd VARCHAR(20),
        level INTEGER DEFAULT 1,
        mythics INTEGER DEFAULT 0,
        tier VARCHAR(10),
        price INTEGER NOT NULL,
        color1 VARCHAR(20) DEFAULT '#2B1055',
        color2 VARCHAR(20) DEFAULT '#7597DE',
        tags TEXT,
        video VARCHAR(500),
        description TEXT,
        skins TEXT,
        stats TEXT,
        sold BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // UC paketlari
    await client.query(`
      CREATE TABLE IF NOT EXISTS uc_packages (
        id SERIAL PRIMARY KEY,
        uc INTEGER NOT NULL,
        usd NUMERIC(10,2) NOT NULL,
        tag VARCHAR(50),
        glow VARCHAR(20) DEFAULT '#00E5FF',
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Turnirlar
    await client.query(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        mode VARCHAR(20),
        prize VARCHAR(50),
        prize_uzs VARCHAR(50),
        slots INTEGER DEFAULT 0,
        filled INTEGER DEFAULT 0,
        entry VARCHAR(50),
        color VARCHAR(20) DEFAULT '#00E5FF',
        tag VARCHAR(50),
        ends_at TIMESTAMP,
        map VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Giveaway'lar
    await client.query(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        sub VARCHAR(300),
        prize VARCHAR(100),
        ends_at TIMESTAMP,
        color VARCHAR(20) DEFAULT '#00E5FF',
        tag VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // G'oliblar
    await client.query(`
      CREATE TABLE IF NOT EXISTS winners (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        prize VARCHAR(100),
        date VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Leaderboard
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        rank INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        team VARCHAR(100),
        points INTEGER DEFAULT 0,
        kills INTEGER DEFAULT 0,
        color VARCHAR(20) DEFAULT '#9D4EDD'
      )
    `);

    // Match jadvali
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        date_label VARCHAR(50),
        time_label VARCHAR(20),
        team1 VARCHAR(100),
        team2 VARCHAR(100),
        live BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0
      )
    `);

    // Statistika (saytda ko'rsatiladigan)
    await client.query(`
      CREATE TABLE IF NOT EXISTS stats (
        key VARCHAR(50) PRIMARY KEY,
        value VARCHAR(100) NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Stats default qiymatlari (faqat bo'sh bo'lsa)
    await client.query(`
      INSERT INTO stats (key, value) VALUES
        ('sold_accounts', '0'),
        ('safety_percent', '100%'),
        ('online_users', '0'),
        ('uzs_rate', '12500')
      ON CONFLICT (key) DO NOTHING
    `);

    console.log('✓ Database schema tayyor');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
