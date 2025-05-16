const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { Pet, Monster } = require('./game/entities');

// Load configuration files
const petsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pets.json'), 'utf8'));
const monstersConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/monsters.json'), 'utf8'));
const itemsConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/items.json'), 'utf8'));

// Đọc file pets.json
const petsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pets.json'), 'utf8'));

// Thêm dữ liệu quái vật
const monsters = {
  easy: [
    {
      name: "Goblin",
      image: "👺",
      level: 1,
      hp: 100,
      attack: 10,
      defense: 5,
      exp_reward: 50
    },
    {
      name: "Wolf",
      image: "🐺",
      level: 2,
      hp: 150,
      attack: 15,
      defense: 8,
      exp_reward: 75
    }
  ],
  medium: [
    {
      name: "Orc",
      image: "👹",
      level: 3,
      hp: 200,
      attack: 20,
      defense: 12,
      exp_reward: 100
    },
    {
      name: "Troll",
      image: "🧌",
      level: 4,
      hp: 250,
      attack: 25,
      defense: 15,
      exp_reward: 125
    }
  ],
  hard: [
    {
      name: "Dragon",
      image: "🐉",
      level: 5,
      hp: 300,
      attack: 30,
      defense: 20,
      exp_reward: 200
    },
    {
      name: "Demon",
      image: "😈",
      level: 6,
      hp: 350,
      attack: 35,
      defense: 25,
      exp_reward: 250
    }
  ]
};

// Thêm cooldown system
const cooldowns = new Map();

// Thêm Map để lưu thông tin thách đấu
const pvpChallenges = new Map();
const pvpRequests = new Map(); // Thêm Map mới để lưu yêu cầu thách đấu

function checkCooldown(userId, command, cooldownTime) {
  const now = Date.now();
  const timestamps = cooldowns.get(userId) || new Map();
  const cooldownAmount = cooldownTime * 1000; // Convert to milliseconds

  if (timestamps.has(command)) {
    const expirationTime = timestamps.get(command) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return Math.ceil(timeLeft);
    }
  }

  timestamps.set(command, now);
  cooldowns.set(userId, timestamps);
  return 0;
}

function checkPvpChallenge(challengerId, targetId) {
  // Kiểm tra cả hai chiều của thách đấu
  const challengeKey1 = `${challengerId}-${targetId}`;
  const challengeKey2 = `${targetId}-${challengerId}`;
  
  return pvpChallenges.get(challengeKey1) || pvpChallenges.get(challengeKey2);
}

function clearPvpChallenge(challengerId, targetId) {
  // Xóa cả hai chiều của thách đấu
  const challengeKey1 = `${challengerId}-${targetId}`;
  const challengeKey2 = `${targetId}-${challengerId}`;
  
  if (pvpChallenges.has(challengeKey1)) {
    pvpChallenges.delete(challengeKey1);
  }
  if (pvpChallenges.has(challengeKey2)) {
    pvpChallenges.delete(challengeKey2);
  }
}

// Hàm kiểm tra thách đấu hai chiều
function checkMutualPvpRequest(userId1, userId2) {
  const request1 = pvpRequests.get(`${userId1}-${userId2}`);
  const request2 = pvpRequests.get(`${userId2}-${userId1}`);
  return request1 && request2;
}

// Hàm xóa yêu cầu thách đấu
function clearPvpRequest(userId1, userId2) {
  pvpRequests.delete(`${userId1}-${userId2}`);
  pvpRequests.delete(`${userId2}-${userId1}`);
}

// Khởi tạo database tables
function initDatabase(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tạo bảng users nếu chưa tồn tại
      db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        team TEXT,
        inventory TEXT,
        points INTEGER DEFAULT 0,
        money INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
        console.log('Users table created or already exists.');

        // Thêm cột points nếu chưa tồn tại
        db.run(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding points column:', err);
          }
        });

        // Thêm cột money nếu chưa tồn tại
        db.run(`ALTER TABLE users ADD COLUMN money INTEGER DEFAULT 0`, (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding money column:', err);
          }
        });
      });

      // Tạo bảng pets nếu chưa tồn tại
      db.run(`CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        pet_id TEXT,
        name TEXT,
        rarity TEXT,
        level INTEGER DEFAULT 1,
        exp INTEGER DEFAULT 0,
        hp INTEGER,
        attack INTEGER,
        defense INTEGER,
        is_in_team BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
      )`, (err) => {
        if (err) {
          console.error('Error creating pets table:', err);
          reject(err);
          return;
        }
        console.log('Pets table created or already exists.');
      });

      // Tạo bảng items nếu chưa tồn tại
      db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        item_id TEXT,
        name TEXT,
        type TEXT,
        rarity TEXT,
        stats TEXT,
        is_equipped BOOLEAN DEFAULT 0,
        equipped_pet_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (equipped_pet_id) REFERENCES pets(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating items table:', err);
          reject(err);
          return;
        }
        console.log('Items table created or already exists.');
        resolve();
      });
    });
  });
}

function getRandomPet() {
  const rand = Math.random() * 100;
  let rarity;
  
  if (rand < 75) rarity = 'common';
  else if (rand < 95) rarity = 'uncommon';
  else if (rand < 99.5) rarity = 'rare';
  else if (rand < 99.9) rarity = 'epic';
  else rarity = 'mythic';

  const rarityData = petsData.pets[rarity];
  const pets = rarityData.pets;
  const randomPet = pets[Math.floor(Math.random() * pets.length)];
  
  return {
    ...randomPet,
    rarity: rarityData.rarity,
    stats: rarityData.base_stats
  };
}

function getRandomMonster(difficulty) {
  const monsterList = monsters[difficulty];
  return monsterList[Math.floor(Math.random() * monsterList.length)];
}

function calculateLevel(exp) {
  return Math.floor(Math.sqrt(exp / 100)) + 1;
}

function calculateExpForNextLevel(currentLevel) {
  return Math.pow(currentLevel, 2) * 100;
}

function getBaseStats(pet) {
  try {
    // Chuyển đổi ký hiệu độ hiếm thành tên đầy đủ
    const rarityMap = {
      'c': 'common',
      'd': 'uncommon',
      'e': 'rare',
      'r': 'epic',
      'm': 'mythic'
    };

    const fullRarity = rarityMap[pet.rarity.toLowerCase()] || pet.rarity.toLowerCase();
    
    // Lấy chỉ số cơ bản từ pets.json
    const rarityData = petsData.pets[fullRarity];
    if (!rarityData || !rarityData.base_stats) {
      console.error(`Không tìm thấy chỉ số cơ bản cho ${fullRarity}`);
      // Trả về chỉ số mặc định nếu không tìm thấy
      return {
        hp: 100,
        attack: 10,
        defense: 5
      };
    }
    return rarityData.base_stats;
  } catch (error) {
    console.error('Lỗi khi lấy chỉ số cơ bản:', error);
    // Trả về chỉ số mặc định nếu có lỗi
    return {
      hp: 100,
      attack: 10,
      defense: 5
    };
  }
}

function calculateStats(baseStats, level, rarity) {
  try {
    // Hệ số độ hiếm
    const rarityMultiplier = {
      'common': 1,
      'uncommon': 1.2,
      'rare': 1.5,
      'epic': 2,
      'mythic': 3,
      'c': 1,      // Thêm alias cho common
      'd': 1.2,    // Thêm alias cho uncommon
      'e': 1.5,    // Thêm alias cho rare
      'r': 2,      // Thêm alias cho epic
      'm': 3       // Thêm alias cho mythic
    }[rarity.toLowerCase()] || 1; // Mặc định là 1 nếu không tìm thấy

    // Công thức phức tạp cho mỗi chỉ số
    const calculateStat = (base, level) => {
      // Tăng theo cấp số nhân
      const exponentialGrowth = Math.pow(1.15, level - 1);
      
      // Tăng theo cấp số cộng
      const linearGrowth = 1 + (level - 1) * 0.1;
      
      // Yếu tố ngẫu nhiên nhỏ (±5%)
      const randomFactor = 0.95 + Math.random() * 0.1;
      
      // Kết hợp các yếu tố
      return Math.floor(base * exponentialGrowth * linearGrowth * randomFactor * rarityMultiplier);
    };

    return {
      hp: calculateStat(baseStats.hp || 100, level),
      attack: calculateStat(baseStats.attack || 10, level),
      defense: calculateStat(baseStats.defense || 5, level)
    };
  } catch (error) {
    console.error('Lỗi khi tính chỉ số:', error);
    // Trả về chỉ số mặc định nếu có lỗi
    return {
      hp: 100,
      attack: 10,
      defense: 5
    };
  }
}

function calculateDamage(attacker, defender) {
  // Tính toán sát thương vật lý
  const physicalDamage = (attacker.attack || 10) * (1 + (attacker.str || 5) / 100);
  const physicalReduction = (defender.armor || 0) / ((defender.armor || 0) + 100);
  const finalPhysicalDamage = physicalDamage * (1 - physicalReduction);

  // Tính toán sát thương phép thuật
  const magicalDamage = (attacker.m_damage || 5) * (1 + (attacker.str || 5) / 100);
  const magicalReduction = (defender.mr || 0) / ((defender.mr || 0) + 100);
  const finalMagicalDamage = magicalDamage * (1 - magicalReduction);

  // Tính toán tổng sát thương
  let totalDamage = finalPhysicalDamage + finalMagicalDamage;

  // Tính toán tỷ lệ chí mạng
  if (Math.random() < (attacker.crit_rate || 0.05)) {
    totalDamage *= (attacker.crit_damage || 1.5);
  }

  // Yếu tố ngẫu nhiên (±10%)
  const randomFactor = 0.9 + Math.random() * 0.2;
  totalDamage *= randomFactor;

  // Đảm bảo sát thương tối thiểu là 1
  return Math.max(1, Math.floor(totalDamage));
}

// Thêm hàm tính toán chỉ số quái vật
function calculateMonsterStats(monster, playerTeam, difficulty) {
  // Tính tổng chỉ số của đội người chơi
  const teamTotalStats = playerTeam.reduce((total, pet) => {
    return total + 
      (pet.hp || 100) + 
      ((pet.attack || 10) * 2) + 
      ((pet.defense || 5) * 2) +
      ((pet.m_damage || 5) * 1.5) +
      ((pet.armor || 0) * 1.5) +
      ((pet.mr || 0) * 1.5) +
      ((pet.str || 5) * 1.2) +
      ((pet.crit_rate || 0.05) * 100) +
      ((pet.crit_damage || 1.5) * 10) +
      ((pet.attack_speed || 1.0) * 5) +
      ((pet.movement_speed || 1.0) * 5);
  }, 0);

  // Hệ số độ khó - tăng lên đặc biệt cho hard và medium
  const difficultyMultiplier = {
    'easy': 1.2,    // Giữ nguyên
    'medium': 2.2,  // Tăng từ 1.5 lên 2.2
    'hard': 4.0     // Tăng từ 3.0 lên 4.0
  }[difficulty] || 1;

  // Tính toán hệ số tăng độ khó dựa trên tổng chỉ số team - tăng hệ số mũ cho hard và medium
  const teamPowerMultiplier = Math.pow(teamTotalStats / 1000, 
    difficulty === 'hard' ? 1.3 :  // Tăng từ 1.1 lên 1.3 cho hard
    difficulty === 'medium' ? 1.1 : // Tăng từ 0.9 lên 1.1 cho medium
    0.9
  );

  // Yếu tố ngẫu nhiên - tăng biến động cho hard và medium
  const randomFactor = difficulty === 'hard' 
    ? 0.95 + Math.random() * 0.5  // Tăng từ ±20% lên ±25% cho hard
    : difficulty === 'medium'
    ? 0.9 + Math.random() * 0.4   // Tăng từ ±15% lên ±20% cho medium
    : 0.85 + Math.random() * 0.3;

  // Tính toán chỉ số mới
  const baseStats = {
    hp: monster.hp || 100,
    attack: monster.attack || 10,
    defense: monster.defense || 5,
    m_damage: monster.m_damage || 5,
    armor: monster.armor || 0,
    mr: monster.mr || 0,
    str: monster.str || 5,
    crit_rate: monster.crit_rate || 0.05,
    crit_damage: monster.crit_damage || 1.5,
    attack_speed: monster.attack_speed || 1.0,
    movement_speed: monster.movement_speed || 1.0
  };

  // Công thức tính chỉ số mới với độ khó tăng theo team
  const newStats = {
    hp: Math.floor(baseStats.hp * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    attack: Math.floor(baseStats.attack * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    defense: Math.floor(baseStats.defense * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    m_damage: Math.floor(baseStats.m_damage * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    armor: Math.floor(baseStats.armor * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    mr: Math.floor(baseStats.mr * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    str: Math.floor(baseStats.str * difficultyMultiplier * teamPowerMultiplier * randomFactor),
    crit_rate: Math.min(
      difficulty === 'hard' ? 0.8 : 
      difficulty === 'medium' ? 0.7 : 0.6,
      baseStats.crit_rate * (1 + (difficultyMultiplier * teamPowerMultiplier - 1) * 
        (difficulty === 'hard' ? 0.5 : 
         difficulty === 'medium' ? 0.4 : 0.3))
    ),
    crit_damage: Math.min(
      difficulty === 'hard' ? 4.5 : 
      difficulty === 'medium' ? 4.0 : 3.5,
      baseStats.crit_damage * (1 + (difficultyMultiplier * teamPowerMultiplier - 1) * 
        (difficulty === 'hard' ? 0.5 : 
         difficulty === 'medium' ? 0.4 : 0.3))
    ),
    attack_speed: Math.min(
      difficulty === 'hard' ? 3.5 : 
      difficulty === 'medium' ? 3.0 : 2.5,
      baseStats.attack_speed * (1 + (difficultyMultiplier * teamPowerMultiplier - 1) * 
        (difficulty === 'hard' ? 0.4 : 
         difficulty === 'medium' ? 0.3 : 0.2))
    ),
    movement_speed: Math.min(
      difficulty === 'hard' ? 3.5 : 
      difficulty === 'medium' ? 3.0 : 2.5,
      baseStats.movement_speed * (1 + (difficultyMultiplier * teamPowerMultiplier - 1) * 
        (difficulty === 'hard' ? 0.4 : 
         difficulty === 'medium' ? 0.3 : 0.2))
    )
  };

  // Đảm bảo chỉ số tối thiểu - tăng giá trị tối thiểu cho hard và medium
  return {
    hp: Math.max(
      difficulty === 'hard' ? 300 : 
      difficulty === 'medium' ? 200 : 150, 
      newStats.hp
    ),
    attack: Math.max(
      difficulty === 'hard' ? 35 : 
      difficulty === 'medium' ? 25 : 15, 
      newStats.attack
    ),
    defense: Math.max(
      difficulty === 'hard' ? 25 : 
      difficulty === 'medium' ? 15 : 8, 
      newStats.defense
    ),
    m_damage: Math.max(
      difficulty === 'hard' ? 25 : 
      difficulty === 'medium' ? 15 : 8, 
      newStats.m_damage
    ),
    armor: Math.max(
      difficulty === 'hard' ? 8 : 
      difficulty === 'medium' ? 5 : 2, 
      newStats.armor
    ),
    mr: Math.max(
      difficulty === 'hard' ? 8 : 
      difficulty === 'medium' ? 5 : 2, 
      newStats.mr
    ),
    str: Math.max(
      difficulty === 'hard' ? 25 : 
      difficulty === 'medium' ? 15 : 8, 
      newStats.str
    ),
    crit_rate: Math.max(
      difficulty === 'hard' ? 0.15 : 
      difficulty === 'medium' ? 0.12 : 0.08, 
      newStats.crit_rate
    ),
    crit_damage: Math.max(
      difficulty === 'hard' ? 2.5 : 
      difficulty === 'medium' ? 2.2 : 1.8, 
      newStats.crit_damage
    ),
    attack_speed: Math.max(
      difficulty === 'hard' ? 1.8 : 
      difficulty === 'medium' ? 1.5 : 1.2, 
      newStats.attack_speed
    ),
    movement_speed: Math.max(
      difficulty === 'hard' ? 1.8 : 
      difficulty === 'medium' ? 1.5 : 1.2, 
      newStats.movement_speed
    )
  };
}

// Thêm hàm lấy quái vật từ khu vực
function getMonsterFromArea(area, difficulty) {
  const areaData = petsData.pve_areas[area];
  if (!areaData) {
    return null;
  }

  // Lấy danh sách quái vật từ khu vực
  const monsters = areaData.monsters;
  if (!monsters || monsters.length === 0) {
    return null;
  }

  // Chọn ngẫu nhiên một quái vật
  const monster = monsters[Math.floor(Math.random() * monsters.length)];
  
  // Tạo bản sao của quái vật và thêm độ khó
  return {
    ...monster,
    difficulty: difficulty
  };
}

// Thêm hàm lấy item ngẫu nhiên
function getRandomItem(difficulty) {
  // Tỉ lệ rớt item theo độ khó (tổng 100%)
  const dropRates = {
    easy: { common: 0.05, uncommon: 0.02, rare: 0.01 },    // Tổng 8%
    medium: { common: 0.04, uncommon: 0.02, rare: 0.01 },  // Tổng 7%
    hard: { common: 0.03, uncommon: 0.02, rare: 0.01 }     // Tổng 6%
  };

  // Kiểm tra xem có rớt item không (90% không rớt)
  if (Math.random() > 0.1) {
    return null;
  }

  const chances = dropRates[difficulty];
  const roll = Math.random();
  let selectedRarity;

  if (roll < chances.common) selectedRarity = 'common';
  else if (roll < chances.common + chances.uncommon) selectedRarity = 'uncommon';
  else if (roll < chances.common + chances.uncommon + chances.rare) selectedRarity = 'rare';
  else return null; // Không rớt item

  // Randomly select item type
  const itemTypes = ['weapons', 'armor', 'accessories'];
  const selectedType = itemTypes[Math.floor(Math.random() * itemTypes.length)];

  // Get items of selected type and rarity
  const items = itemsConfig.items[selectedType][selectedRarity];
  if (!items || items.length === 0) return null;

  // Randomly select an item
  return items[Math.floor(Math.random() * items.length)];
}

// Thêm hàm áp dụng item cho thú
function applyItemStats(pet, item) {
  const newStats = { ...pet };
  for (const [stat, value] of Object.entries(item.stats)) {
    if (newStats[stat] !== undefined) {
      newStats[stat] += value;
    }
  }
  return newStats;
}

// Thêm hàm lưu item vào database
async function saveItemToDatabase(db, userId, item) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO items (user_id, item_id, name, type, rarity, stats) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, item.id, item.name, item.type, item.rarity, JSON.stringify(item.stats)],
      (err) => {
        if (err) reject(err);
        else resolve();
      });
  });
}

// Thêm hàm lấy danh sách item của người dùng
async function getUserItems(db, userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM items WHERE user_id = ?', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Thêm hàm cập nhật điểm
async function updatePoints(db, userId, points) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET points = points + ? WHERE user_id = ?', [points, userId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getPetById(petId) {
  const pets = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pets.json'), 'utf8'));
  const petData = pets.find(p => p.id === petId);
  return petData ? new Pet(petData) : null;
}

function getMonsterByAreaAndDifficulty(area, difficulty) {
  const pets = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'pets.json'), 'utf8'));
  const areaData = pets.pve_areas.find(a => a.name === area);
  if (!areaData) return null;

  const monsterData = areaData.monsters.find(m => m.difficulty === difficulty);
  if (!monsterData) return null;

  return new Monster(monsterData);
}

function calculateBattleRewards(playerTeam, monster, difficulty) {
  const baseExp = monster.expReward;
  const basePoints = {
    'easy': 10,
    'medium': 20,
    'hard': 30
  }[difficulty] || 10;

  // Tính toán exp và points dựa trên độ khó và số lượng pet
  const expReward = Math.floor(baseExp * (1 + (difficulty === 'hard' ? 0.5 : 0)) / playerTeam.length);
  const pointsReward = Math.floor(basePoints * (1 + (difficulty === 'hard' ? 0.5 : 0)));

  return {
    exp: expReward,
    points: pointsReward
  };
}

function battle(playerTeam, monster, difficulty) {
  // Tính toán chỉ số monster dựa trên đội người chơi
  monster.stats = Monster.calculateStats(monster, playerTeam, difficulty);

  const battleLog = [];
  let round = 1;
  let monsterAlive = true;
  let teamAlive = true;

  while (monsterAlive && teamAlive) {
    // Monster tấn công
    for (const pet of playerTeam) {
      if (pet.isAlive()) {
        const damage = monster.calculateDamage(pet);
        const remainingHp = pet.takeDamage(damage);
        battleLog.push(`Round ${round}: ${monster.name} đánh ${pet.name} gây ${damage} sát thương. ${pet.name} còn ${remainingHp} HP`);
      }
    }

    // Team tấn công
    for (const pet of playerTeam) {
      if (pet.isAlive() && monsterAlive) {
        const damage = pet.calculateDamage(monster);
        const remainingHp = monster.takeDamage(damage);
        battleLog.push(`Round ${round}: ${pet.name} đánh ${monster.name} gây ${damage} sát thương. ${monster.name} còn ${remainingHp} HP`);
        
        if (!monster.isAlive()) {
          monsterAlive = false;
          break;
        }
      }
    }

    // Kiểm tra team còn sống
    teamAlive = playerTeam.some(pet => pet.isAlive());
    round++;
  }

  const rewards = calculateBattleRewards(playerTeam, monster, difficulty);
  const result = {
    victory: !monsterAlive,
    battleLog,
    rewards
  };

  // Cập nhật exp cho các pet còn sống
  if (result.victory) {
    for (const pet of playerTeam) {
      if (pet.isAlive()) {
        const levelUp = pet.addExp(rewards.exp);
        if (levelUp.newLevel > levelUp.oldLevel) {
          battleLog.push(`${pet.name} đã lên cấp ${levelUp.newLevel}!`);
        }
      }
    }
  }

  return result;
}

module.exports = {
  name: 'owo',
  description: 'OwO Bot - Pet Battle Game',
  usage: '!owo [hunt/pvp/pve/team/inventory]',
  examples: [
    '!owo hunt - Săn thú (cooldown: 30s)',
    '!owo pvp @user - Đấu với người chơi khác',
    '!owo pve [easy/medium/hard] - Đấu với quái vật (cooldown: 60s)',
    '!owo team - Xem đội hình',
    '!owo team add [số thứ tự] - Thêm thú vào đội',
    '!owo team remove [số thứ tự] - Xóa thú khỏi đội',
    '!owo inventory [trang] - Xem kho đồ (5 thú/trang)'
  ],
  aliases: ['owo'],
  async execute(client, event, args, db) {
    const chatId = event.event?.message?.chat_id || event.message?.chat_id;
    if (!chatId) {
      console.error('No chat_id found in event');
      return;
    }

    try {
      // Khởi tạo database
      await initDatabase(db);

      // Lấy thông tin người dùng
      const userId = event.event?.sender?.sender_id?.user_id || event.sender?.sender_id?.user_id;
      if (!userId) {
        await client.im.message.create({
          params: {
            receive_id_type: 'chat_id'
          },
          data: {
            receive_id: chatId,
            msg_type: 'text',
            content: JSON.stringify({ 
              text: '❌ Không tìm thấy thông tin người dùng!' 
            })
          }
        });
        return;
      }

      // Kiểm tra người dùng đã tồn tại
      const user = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!user) {
        // Tạo người dùng mới
        await new Promise((resolve, reject) => {
          db.run('INSERT INTO users (user_id, username, team, inventory) VALUES (?, ?, ?, ?)', 
            [userId, 'User', '[]', '[]'], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      // Xử lý lệnh
      const command = args[0]?.toLowerCase();

      switch (command) {
        case 'hunt':
          // Kiểm tra cooldown
          const huntCooldown = checkCooldown(userId, 'hunt', 30); // 30 seconds
          if (huntCooldown > 0) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `⏳ Vui lòng đợi ${huntCooldown} giây nữa để săn thú tiếp!` 
                })
              }
            });
            return;
          }

          // Săn thú
          const pet = getRandomPet();
          const stats = calculateStats(pet.stats, 1, pet.rarity);

          // Lưu thú vào database
          await new Promise((resolve, reject) => {
            db.run('INSERT INTO pets (user_id, pet_id, name, rarity, hp, attack, defense) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [userId, pet.id, pet.name, pet.rarity, stats.hp, stats.attack, stats.defense], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Gửi thông báo
          const petStats = formatPetStats(pet);
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: `🎯 Bạn đã bắt được:\n${petStats}` 
              })
            }
          });
          break;

        case 'pvp':
          // Kiểm tra đội hình
          const pvpTeam = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1', [userId], (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });

          if (!pvpTeam || pvpTeam.length < 3) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Bạn cần có ít nhất 3 thú trong đội để PvP!' 
                })
              }
            });
            return;
          }

          // Xử lý lệnh PvP
          const pvpCommand = args[1]?.toLowerCase();
          
          if (pvpCommand === 'a' || pvpCommand === 'accept') {
            // Chấp nhận thách đấu
            const challenge = checkPvpChallenge(event.sender.sender_id.user_id, userId);
            if (!challenge) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Không có lời thách đấu nào đang chờ!' 
                  })
                }
              });
              return;
            }

            // Xác định vai trò của người chơi trong thách đấu
            const isChallenger = challenge.challengerId === event.sender.sender_id.user_id;
            const challengerId = isChallenger ? event.sender.sender_id.user_id : challenge.challengerId;
            const defenderId = isChallenger ? challenge.targetId : event.sender.sender_id.user_id;
            const challengerName = isChallenger ? challenge.challengerName : challenge.targetName;
            const defenderName = isChallenger ? challenge.targetName : challenge.challengerName;

            // Kiểm tra đội hình của người thách đấu
            const challengerTeam = await new Promise((resolve, reject) => {
              db.all('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1', [challengerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });

            if (!challengerTeam || challengerTeam.length < 3) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Người thách đấu không có đủ 3 thú trong đội!' 
                  })
                }
              });
              clearPvpChallenge(challengerId, defenderId);
              return;
            }

            // Bắt đầu PvP
            let battleLog = `⚔️ BẮT ĐẦU PVP!\n\n`;
            battleLog += `👤 Người chơi 1: ${challengerName}\n`;
            battleLog += `👤 Người chơi 2: ${defenderName}\n\n`;

            // Hiển thị đội hình
            battleLog += `Đội ${challengerName}:\n`;
            challengerTeam.forEach((pet, index) => {
              battleLog += `${index + 1}. ${pet.name} (${pet.rarity}) - Lv.${pet.level}\n`;
              battleLog += `❤️ HP: ${pet.hp} | ⚔️ ATK: ${pet.attack} | 🛡️ DEF: ${pet.defense}\n`;
            });
            battleLog += '\n';

            battleLog += `Đội ${defenderName}:\n`;
            pvpTeam.forEach((pet, index) => {
              battleLog += `${index + 1}. ${pet.name} (${pet.rarity}) - Lv.${pet.level}\n`;
              battleLog += `❤️ HP: ${pet.hp} | ⚔️ ATK: ${pet.attack} | 🛡️ DEF: ${pet.defense}\n`;
            });
            battleLog += '\n';

            // Khởi tạo trạng thái chiến đấu
            let challengerHP = challengerTeam.map(pet => pet.hp);
            let defenderHP = pvpTeam.map(pet => pet.hp);
            let currentChallengerIndex = 0;
            let currentDefenderIndex = 0;
            let round = 1;

            // Chiến đấu
            while (challengerHP.some(hp => hp > 0) && defenderHP.some(hp => hp > 0)) {
              battleLog += `📜 Vòng ${round}:\n`;

              // Người thách đấu tấn công
              if (challengerHP[currentChallengerIndex] > 0) {
                const challengerPet = challengerTeam[currentChallengerIndex];
                const defenderPet = pvpTeam[currentDefenderIndex];
                const damage = calculateDamage(challengerPet, defenderPet);
                defenderHP[currentDefenderIndex] -= damage;
                battleLog += `${challengerPet.name} gây ${damage} sát thương cho ${defenderPet.name}\n`;
              }

              // Người nhận thách tấn công
              if (defenderHP[currentDefenderIndex] > 0) {
                const defenderPet = pvpTeam[currentDefenderIndex];
                const challengerPet = challengerTeam[currentChallengerIndex];
                const damage = calculateDamage(defenderPet, challengerPet);
                challengerHP[currentChallengerIndex] -= damage;
                battleLog += `${defenderPet.name} gây ${damage} sát thương cho ${challengerPet.name}\n`;
              }

              battleLog += `\nĐội ${challengerName}:\n`;
              challengerTeam.forEach((pet, index) => {
                battleLog += `${pet.name}: ${Math.max(0, challengerHP[index])} HP\n`;
              });

              battleLog += `\nĐội ${defenderName}:\n`;
              pvpTeam.forEach((pet, index) => {
                battleLog += `${pet.name}: ${Math.max(0, defenderHP[index])} HP\n`;
              });
              battleLog += '\n';

              // Chuyển lượt
              currentChallengerIndex = (currentChallengerIndex + 1) % challengerTeam.length;
              currentDefenderIndex = (currentDefenderIndex + 1) % pvpTeam.length;
              round++;
            }

            // Kết quả
            const challengerWon = defenderHP.every(hp => hp <= 0);
            if (challengerWon) {
              battleLog += `🎉 ${challengerName} CHIẾN THẮNG!\n`;
              // Cập nhật EXP cho người thắng
              for (const pet of challengerTeam) {
                const newExp = pet.exp + 100;
                const newLevel = calculateLevel(newExp);
                await new Promise((resolve, reject) => {
                  db.run('UPDATE pets SET exp = ?, level = ? WHERE id = ?', 
                    [newExp, newLevel, pet.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
              }
            } else {
              battleLog += `🎉 ${defenderName} CHIẾN THẮNG!\n`;
              // Cập nhật EXP cho người thắng
              for (const pet of pvpTeam) {
                const newExp = pet.exp + 100;
                const newLevel = calculateLevel(newExp);
                await new Promise((resolve, reject) => {
                  db.run('UPDATE pets SET exp = ?, level = ? WHERE id = ?', 
                    [newExp, newLevel, pet.id], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                });
              }
            }

            // Xóa thách đấu
            clearPvpChallenge(challengerId, defenderId);

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: battleLog 
                })
              }
            });
          }
          else if (pvpCommand === 'd' || pvpCommand === 'decline') {
            // Từ chối thách đấu
            const challenge = checkPvpChallenge(event.sender.sender_id.user_id, userId);
            if (!challenge) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Không có lời thách đấu nào đang chờ!' 
                  })
                }
              });
              return;
            }

            // Xóa thách đấu
            clearPvpChallenge(event.sender.sender_id.user_id, userId);

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `❌ ${event.sender.sender_id.name} đã từ chối thách đấu!` 
                })
              }
            });
          }
          else {
            // Thách đấu người khác
            const targetUserId = args[1];
            if (!targetUserId) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Vui lòng nhập user_id của người chơi muốn thách đấu!' 
                  })
                }
              });
              return;
            }

            // Kiểm tra xem đã có yêu cầu thách đấu chưa
            const existingRequest = pvpRequests.get(`${event.sender.sender_id.user_id}-${targetUserId}`);
            if (existingRequest) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Bạn đã gửi yêu cầu thách đấu cho người này rồi!' 
                  })
                }
              });
              return;
            }

            // Kiểm tra người chơi có tồn tại không
            const targetUser = await new Promise((resolve, reject) => {
              db.get('SELECT * FROM users WHERE user_id = ?', [targetUserId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            if (!targetUser) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Không tìm thấy người chơi này!' 
                  })
                }
              });
              return;
            }

            // Kiểm tra đội hình của người chơi
            const targetTeam = await new Promise((resolve, reject) => {
              db.all('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1', [targetUserId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });

            if (!targetTeam || targetTeam.length < 3) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Người chơi này chưa có đủ 3 thú trong đội!' 
                  })
                }
              });
              return;
            }

            // Lấy thông tin người thách đấu
            const challengerUser = await new Promise((resolve, reject) => {
              db.get('SELECT * FROM users WHERE user_id = ?', [event.sender.sender_id.user_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            // Tạo yêu cầu thách đấu mới
            const requestKey = `${event.sender.sender_id.user_id}-${targetUserId}`;
            pvpRequests.set(requestKey, {
              challengerId: event.sender.sender_id.user_id,
              challengerName: challengerUser?.username || event.sender.sender_id.name || 'Người chơi',
              targetId: targetUserId,
              targetName: targetUser.username || 'Người chơi',
              timestamp: Date.now()
            });

            // Kiểm tra xem có phải thách đấu hai chiều không
            if (checkMutualPvpRequest(event.sender.sender_id.user_id, targetUserId)) {
              // Bắt đầu trận đấu
              const request1 = pvpRequests.get(`${event.sender.sender_id.user_id}-${targetUserId}`);
              const request2 = pvpRequests.get(`${targetUserId}-${event.sender.sender_id.user_id}`);

              // Xóa yêu cầu thách đấu
              clearPvpRequest(event.sender.sender_id.user_id, targetUserId);

              // Bắt đầu PvP
              let battleLog = `⚔️ BẮT ĐẦU PVP!\n\n`;
              battleLog += `👤 Người chơi 1: ${request2.challengerName}\n`;
              battleLog += `👤 Người chơi 2: ${request1.challengerName}\n\n`;

              // Hiển thị đội hình
              battleLog += `Đội ${request2.challengerName}:\n`;
              targetTeam.forEach((pet, index) => {
                battleLog += `${index + 1}. ${pet.name} (${pet.rarity}) - Lv.${pet.level}\n`;
                battleLog += `❤️ HP: ${pet.hp} | ⚔️ ATK: ${pet.attack} | 🛡️ DEF: ${pet.defense}\n`;
              });
              battleLog += '\n';

              battleLog += `Đội ${request1.challengerName}:\n`;
              pvpTeam.forEach((pet, index) => {
                battleLog += `${index + 1}. ${pet.name} (${pet.rarity}) - Lv.${pet.level}\n`;
                battleLog += `❤️ HP: ${pet.hp} | ⚔️ ATK: ${pet.attack} | 🛡️ DEF: ${pet.defense}\n`;
              });
              battleLog += '\n';

              // Khởi tạo trạng thái chiến đấu
              let team1HP = targetTeam.map(pet => pet.hp);
              let team2HP = pvpTeam.map(pet => pet.hp);
              let currentTeam1Index = 0;
              let currentTeam2Index = 0;
              let round = 1;

              // Chiến đấu
              while (team1HP.some(hp => hp > 0) && team2HP.some(hp => hp > 0)) {
                battleLog += `📜 Vòng ${round}:\n`;

                // Đội 1 tấn công
                if (team1HP[currentTeam1Index] > 0) {
                  const attacker = targetTeam[currentTeam1Index];
                  const defender = pvpTeam[currentTeam2Index];
                  const damage = calculateDamage(attacker, defender);
                  team2HP[currentTeam2Index] -= damage;
                  battleLog += `${attacker.name} gây ${damage} sát thương cho ${defender.name}\n`;
                }

                // Đội 2 tấn công
                if (team2HP[currentTeam2Index] > 0) {
                  const attacker = pvpTeam[currentTeam2Index];
                  const defender = targetTeam[currentTeam1Index];
                  const damage = calculateDamage(attacker, defender);
                  team1HP[currentTeam1Index] -= damage;
                  battleLog += `${attacker.name} gây ${damage} sát thương cho ${defender.name}\n`;
                }

                battleLog += `\nĐội ${request2.challengerName}:\n`;
                targetTeam.forEach((pet, index) => {
                  battleLog += `${pet.name}: ${Math.max(0, team1HP[index])} HP\n`;
                });

                battleLog += `\nĐội ${request1.challengerName}:\n`;
                pvpTeam.forEach((pet, index) => {
                  battleLog += `${pet.name}: ${Math.max(0, team2HP[index])} HP\n`;
                });
                battleLog += '\n';

                // Chuyển lượt
                currentTeam1Index = (currentTeam1Index + 1) % targetTeam.length;
                currentTeam2Index = (currentTeam2Index + 1) % pvpTeam.length;
                round++;
              }

              // Kết quả
              const team1Won = team2HP.every(hp => hp <= 0);
              if (team1Won) {
                battleLog += `🎉 ${request2.challengerName} CHIẾN THẮNG!\n`;
                // Cập nhật EXP cho người thắng
                for (const pet of targetTeam) {
                  const newExp = pet.exp + 100;
                  const newLevel = calculateLevel(newExp);
                  await new Promise((resolve, reject) => {
                    db.run('UPDATE pets SET exp = ?, level = ? WHERE id = ?', 
                      [newExp, newLevel, pet.id], (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  });
                }
              } else {
                battleLog += `🎉 ${request1.challengerName} CHIẾN THẮNG!\n`;
                // Cập nhật EXP cho người thắng
                for (const pet of pvpTeam) {
                  const newExp = pet.exp + 100;
                  const newLevel = calculateLevel(newExp);
                  await new Promise((resolve, reject) => {
                    db.run('UPDATE pets SET exp = ?, level = ? WHERE id = ?', 
                      [newExp, newLevel, pet.id], (err) => {
                      if (err) reject(err);
                      else resolve();
                    });
                  });
                }
              }

              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: battleLog 
                  })
                }
              });
            } else {
              // Gửi thông báo yêu cầu thách đấu
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: `⚔️ ${challengerUser?.username || event.sender.sender_id.name || 'Người chơi'} muốn thách đấu ${targetUser.username || 'Người chơi'}!\n\n` +
                          `Để chấp nhận, người chơi cũng cần gửi lệnh:\n` +
                          `!owo pvp ${event.sender.sender_id.user_id}\n\n` +
                          `⏳ Thời gian chờ: 30 giây` 
                  })
                }
              });

              // Tự động xóa yêu cầu sau 30 giây
              setTimeout(() => {
                const request = pvpRequests.get(requestKey);
                if (request) {
                  clearPvpRequest(event.sender.sender_id.user_id, targetUserId);
                  client.im.message.create({
                    params: {
                      receive_id_type: 'chat_id'
                    },
                    data: {
                      receive_id: chatId,
                      msg_type: 'text',
                      content: JSON.stringify({ 
                        text: `❌ Yêu cầu thách đấu đã hết hạn!` 
                      })
                    }
                  });
                }
              }, 30000);
            }
          }
          break;

        case 'pve':
          // Kiểm tra cooldown
          const pveCooldown = checkCooldown(userId, 'pve', 60); // 60 seconds
          if (pveCooldown > 0) {
            const minutes = Math.floor(pveCooldown / 60);
            const seconds = pveCooldown % 60;
            const timeLeft = minutes > 0 
              ? `${minutes} phút ${seconds} giây`
              : `${seconds} giây`;
            
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `⏳ Vui lòng đợi ${timeLeft} nữa để PvE tiếp!\n💡 Cooldown: 60 giây` 
                })
              }
            });
            return;
          }

          // Kiểm tra đội hình
          const pveTeam = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1', [userId], (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });

          if (!pveTeam || pveTeam.length < 3) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Bạn cần có ít nhất 3 thú trong đội để PvE!' 
                })
              }
            });
            return;
          }

          // Kiểm tra độ khó
          const difficulty = args[1]?.toLowerCase();
          if (!difficulty || !['easy', 'medium', 'hard'].includes(difficulty)) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Vui lòng chọn độ khó: easy/medium/hard' 
                })
              }
            });
            return;
          }

          // Kiểm tra khu vực
          const area = args[2]?.toLowerCase();
          if (!area || !['forest', 'cave', 'volcano'].includes(area)) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Vui lòng chọn khu vực: forest/cave/volcano' 
                })
              }
            });
            return;
          }

          // Lấy quái vật từ khu vực
          const monster = getMonsterFromArea(area, difficulty);
          if (!monster) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Không tìm thấy quái vật trong khu vực này!' 
                })
              }
            });
            return;
          }

          // Reset cooldown sau khi bắt đầu PvE
          checkCooldown(userId, 'pve', 60);

          // Tính toán chỉ số quái vật dựa trên đội người chơi
          const monsterStats = calculateMonsterStats(monster, pveTeam, difficulty);
          const finalMonster = {
            ...monster,
            ...monsterStats
          };

          let battleLog = `⚔️ BẮT ĐẦU CHIẾN ĐẤU!\n\n`;
          battleLog += `Quái vật: ${finalMonster.image} ${finalMonster.name} (Lv.${finalMonster.level || 1})\n`;
          battleLog += `❤️ HP: ${finalMonster.hp || 100}\n`;
          battleLog += `⚔️ Tấn công: ${finalMonster.attack || 10}\n`;
          battleLog += `✨ Phép thuật: ${finalMonster.m_damage || 5}\n`;
          battleLog += `🛡️ Giáp: ${finalMonster.armor || 0}\n`;
          battleLog += `🔮 Kháng phép: ${finalMonster.mr || 0}\n`;
          battleLog += `💪 Sức mạnh: ${finalMonster.str || 5}\n`;
          battleLog += `🎯 Tỷ lệ chí mạng: ${((finalMonster.crit_rate || 0.05) * 100).toFixed(1)}%\n`;
          battleLog += `💥 Sát thương chí mạng: ${(finalMonster.crit_damage || 1.5).toFixed(1)}x\n`;
          battleLog += `⚡ Tốc độ đánh: ${(finalMonster.attack_speed || 1.0).toFixed(1)}\n`;
          battleLog += `🏃 Tốc độ di chuyển: ${(finalMonster.movement_speed || 1.0).toFixed(1)}\n\n`;

          battleLog += `Đội của bạn:\n`;
          pveTeam.forEach((pet, index) => {
            battleLog += `${index + 1}. ${pet.name} (${pet.rarity}) - Lv.${pet.level || 1}\n`;
            battleLog += `❤️ HP: ${pet.hp || 100}\n`;
            battleLog += `⚔️ Tấn công: ${pet.attack || 10}\n`;
            battleLog += `✨ Phép thuật: ${pet.m_damage || 5}\n`;
            battleLog += `🛡️ Giáp: ${pet.armor || 0}\n`;
            battleLog += `🔮 Kháng phép: ${pet.mr || 0}\n`;
            battleLog += `💪 Sức mạnh: ${pet.str || 5}\n`;
            battleLog += `🎯 Tỷ lệ chí mạng: ${((pet.crit_rate || 0.05) * 100).toFixed(1)}%\n`;
            battleLog += `💥 Sát thương chí mạng: ${(pet.crit_damage || 1.5).toFixed(1)}x\n`;
            battleLog += `⚡ Tốc độ đánh: ${(pet.attack_speed || 1.0).toFixed(1)}\n`;
            battleLog += `🏃 Tốc độ di chuyển: ${(pet.movement_speed || 1.0).toFixed(1)}\n\n`;
          });

          // Khởi tạo trạng thái chiến đấu
          let monsterHP = finalMonster.hp;
          let teamHP = pveTeam.map(pet => pet.hp);
          let currentPetIndex = 0;
          let round = 1;

          // Chiến đấu
          while (monsterHP > 0 && teamHP.some(hp => hp > 0)) {
            battleLog += `📜 Vòng ${round}:\n`;

            // Thú tấn công
            const currentPet = pveTeam[currentPetIndex];
            if (teamHP[currentPetIndex] > 0) {
              const petDamage = calculateDamage(currentPet, finalMonster);
              monsterHP -= petDamage;
              battleLog += `${currentPet.name} gây ${petDamage} sát thương cho ${finalMonster.name}\n`;
            }

            // Quái vật tấn công
            if (monsterHP > 0) {
              const monsterDamage = calculateDamage(finalMonster, currentPet);
              teamHP[currentPetIndex] -= monsterDamage;
              battleLog += `${finalMonster.name} gây ${monsterDamage} sát thương cho ${currentPet.name}\n`;
            }

            battleLog += `\n${finalMonster.name} còn ${Math.max(0, monsterHP)} HP\n`;
            battleLog += `Đội của bạn:\n`;
            pveTeam.forEach((pet, index) => {
              battleLog += `${pet.name}: ${Math.max(0, teamHP[index])} HP\n`;
            });
            battleLog += '\n';

            // Chuyển lượt
            currentPetIndex = (currentPetIndex + 1) % pveTeam.length;
            round++;
          }

          // Kết quả
          if (monsterHP <= 0) {
            // Thắng
            battleLog += `🎉 CHIẾN THẮNG!\n`;
            // Tính EXP dựa trên độ khó và chỉ số quái vật
            const expReward = Math.floor(finalMonster.exp_reward * (1 + (difficulty === 'hard' ? 0.5 : difficulty === 'medium' ? 0.25 : 0)));
            battleLog += `Nhận được ${expReward} EXP cho mỗi thú!\n\n`;
            battleLog += `Cập nhật level:\n`;

            // Cập nhật EXP cho tất cả thú trong đội
            for (const pet of pveTeam) {
              const oldLevel = pet.level;
              const newExp = pet.exp + expReward;
              const newLevel = calculateLevel(newExp);
              const nextLevelExp = calculateExpForNextLevel(newLevel);
              const expNeeded = nextLevelExp - newExp;

              // Tính toán chỉ số mới
              const baseStats = getBaseStats(pet);
              const oldStats = calculateStats(baseStats, oldLevel, pet.rarity);
              const newStats = calculateStats(baseStats, newLevel, pet.rarity);
              
              await new Promise((resolve, reject) => {
                db.run('UPDATE pets SET exp = ?, level = ?, hp = ?, attack = ?, defense = ? WHERE id = ?', 
                  [newExp, newLevel, newStats.hp, newStats.attack, newStats.defense, pet.id], (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              });

              battleLog += `${pet.name}: Lv.${newLevel} (${newExp}/${nextLevelExp} EXP)\n`;
              if (expNeeded > 0) {
                battleLog += `Cần ${expNeeded} EXP để lên Lv.${newLevel + 1}\n`;
              } else {
                battleLog += `Đã đủ EXP để lên level tiếp theo!\n`;
              }

              // Hiển thị thay đổi chỉ số
              if (newLevel > oldLevel) {
                battleLog += `\n💪 Chỉ số tăng:\n`;
                battleLog += `❤️ HP: ${oldStats.hp} → ${newStats.hp} (+${newStats.hp - oldStats.hp})\n`;
                battleLog += `⚔️ ATK: ${oldStats.attack} → ${newStats.attack} (+${newStats.attack - oldStats.attack})\n`;
                battleLog += `🛡️ DEF: ${oldStats.defense} → ${newStats.defense} (+${newStats.defense - oldStats.defense})\n`;
              }
              battleLog += '\n';
            }

            // Thêm điểm
            const points = itemsConfig.point_rewards[difficulty].win;
            await updatePoints(db, userId, points);
            battleLog += `\n💎 Nhận được ${points} điểm!\n`;

            // Thử lấy item
            const droppedItem = getRandomItem(difficulty);
            if (droppedItem) {
              await saveItemToDatabase(db, userId, droppedItem);
              battleLog += `\n🎁 Nhận được item: ${droppedItem.image} ${droppedItem.name}\n`;
              battleLog += `📝 ${droppedItem.description}\n`;
              battleLog += `💪 Chỉ số:\n`;
              for (const [stat, value] of Object.entries(droppedItem.stats)) {
                battleLog += `${stat}: ${value > 0 ? '+' : ''}${value}\n`;
              }
            }
          } else {
            // Thêm điểm thua
            const points = itemsConfig.point_rewards[difficulty].lose;
            await updatePoints(db, userId, points);
            battleLog += `\n💎 Nhận được ${points} điểm!\n`;
          }

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: battleLog 
              })
            }
          });
          break;

        case 'team':
          // Xử lý lệnh team
          const teamCommand = args[1]?.toLowerCase();
          
          if (teamCommand === 'add') {
            // Thêm thú vào đội
            const petIndex = parseInt(args[2]);
            if (isNaN(petIndex) || petIndex < 1) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Vui lòng nhập số thứ tự thú hợp lệ!' 
                  })
                }
              });
              return;
            }

            // Kiểm tra số lượng thú trong đội
            const teamCount = await new Promise((resolve, reject) => {
              db.get('SELECT COUNT(*) as count FROM pets WHERE user_id = ? AND is_in_team = 1', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
              });
            });

            if (teamCount >= 3) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Đội của bạn đã đủ 3 thú!' 
                  })
                }
              });
              return;
            }

            // Lấy thú từ kho
            const pet = await new Promise((resolve, reject) => {
              db.get('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 0 ORDER BY id LIMIT 1 OFFSET ?', 
                [userId, petIndex - 1], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            if (!pet) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Không tìm thấy thú này trong kho!' 
                  })
                }
              });
              return;
            }

            // Thêm vào đội
            await new Promise((resolve, reject) => {
              db.run('UPDATE pets SET is_in_team = 1 WHERE id = ?', [pet.id], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `✅ Đã thêm ${pet.name} (${pet.rarity}) vào đội!` 
                })
              }
            });
          }
          else if (teamCommand === 'remove') {
            // Xóa thú khỏi đội
            const petIndex = parseInt(args[2]);
            if (isNaN(petIndex) || petIndex < 1) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Vui lòng nhập số thứ tự thú hợp lệ!' 
                  })
                }
              });
              return;
            }

            // Lấy thú từ đội
            const pet = await new Promise((resolve, reject) => {
              db.get('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1 ORDER BY id LIMIT 1 OFFSET ?', 
                [userId, petIndex - 1], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            if (!pet) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Không tìm thấy thú này trong đội!' 
                  })
                }
              });
              return;
            }

            // Xóa khỏi đội
            await new Promise((resolve, reject) => {
              db.run('UPDATE pets SET is_in_team = 0 WHERE id = ?', [pet.id], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `✅ Đã xóa ${pet.name} (${pet.rarity}) khỏi đội!` 
                })
              }
            });
          }
          else {
            // Xem đội hình
            const userTeam = await new Promise((resolve, reject) => {
              db.all('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1', [userId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });

            if (!userTeam || userTeam.length === 0) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Bạn chưa có thú nào trong đội!\n💡 Sử dụng: !owo team add [số thứ tự] để thêm thú vào đội' 
                  })
                }
              });
              return;
            }

            let teamMessage = '👥 ĐỘI HÌNH CỦA BẠN:\n\n';
            userTeam.forEach((pet, index) => {
              teamMessage += `${index + 1}. ${formatPetStats(pet)}\n\n`;
            });

            teamMessage += '💡 Sử dụng:\n';
            teamMessage += '!owo team add [số thứ tự] - Thêm thú vào đội\n';
            teamMessage += '!owo team remove [số thứ tự] - Xóa thú khỏi đội';

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: teamMessage 
                })
              }
            });
          }
          break;

        case 'inventory':
          // Xem kho đồ
          const page = parseInt(args[1]) || 1;
          const itemsPerPage = 5;
          const offset = (page - 1) * itemsPerPage;

          // Lấy tổng số thú
          const totalPets = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM pets WHERE user_id = ? AND is_in_team = 0', [userId], (err, row) => {
              if (err) reject(err);
              else resolve(row.count);
            });
          });

          if (totalPets === 0) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Kho đồ của bạn trống!' 
                })
              }
            });
            return;
          }

          // Tính toán số trang
          const totalPages = Math.ceil(totalPets / itemsPerPage);
          if (page < 1 || page > totalPages) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `❌ Trang không hợp lệ! (1-${totalPages})` 
                })
              }
            });
            return;
          }

          // Lấy thú theo trang
          const inventory = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 0 ORDER BY id LIMIT ? OFFSET ?', 
              [userId, itemsPerPage, offset], (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });

          let inventoryMessage = `🎒 KHO ĐỒ CỦA BẠN (Trang ${page}/${totalPages}):\n\n`;
          inventory.forEach((pet, index) => {
            const itemNumber = offset + index + 1;
            inventoryMessage += `${itemNumber}. ${formatPetStats(pet)}\n\n`;
          });

          // Thêm hướng dẫn điều hướng
          inventoryMessage += '📄 Điều hướng:\n';
          if (page > 1) {
            inventoryMessage += `!owo inventory ${page - 1} - Trang trước\n`;
          }
          if (page < totalPages) {
            inventoryMessage += `!owo inventory ${page + 1} - Trang sau\n`;
          }
          inventoryMessage += '\n💡 Sử dụng:\n';
          inventoryMessage += '!owo team add [số thứ tự] - Thêm thú vào đội\n';
          inventoryMessage += '!owo sell [số thứ tự] - Bán một thú\n';
          inventoryMessage += '!owo sell all [độ hiếm] - Bán tất cả thú theo độ hiếm';

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: inventoryMessage 
              })
            }
          });
          break;

        case 'sell':
          // Xử lý lệnh bán thú
          const sellCommand = args[1]?.toLowerCase();
          
          if (sellCommand === 'all') {
            // Bán tất cả thú theo độ hiếm
            const rarity = args[2]?.toLowerCase();
            if (!rarity || !['common', 'uncommon', 'rare', 'epic', 'mythic', 'c', 'd', 'e', 'r', 'm'].includes(rarity)) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Vui lòng chọn độ hiếm hợp lệ: common/uncommon/rare/epic/mythic' 
                  })
                }
              });
              return;
            }

            // Chuyển đổi ký hiệu độ hiếm
            const rarityMap = {
              'c': 'C',
              'd': 'D',
              'e': 'E',
              'r': 'R',
              'm': 'M',
              'common': 'C',
              'uncommon': 'D',
              'rare': 'E',
              'epic': 'R',
              'mythic': 'M'
            };
            const rarityCode = rarityMap[rarity];

            // Lấy tất cả thú theo độ hiếm (không tính thú trong đội)
            const petsToSell = await new Promise((resolve, reject) => {
              db.all('SELECT * FROM pets WHERE user_id = ? AND rarity = ? AND is_in_team = 0', 
                [userId, rarityCode], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
              });
            });

            if (!petsToSell || petsToSell.length === 0) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: `❌ Không có thú ${rarityCode} nào trong kho để bán!` 
                  })
                }
              });
              return;
            }

            // Tính tổng giá trị
            const totalValue = petsToSell.reduce((total, pet) => {
              const baseValue = {
                'C': 100,
                'D': 300,
                'E': 1000,
                'R': 3000,
                'M': 10000
              }[pet.rarity] || 100;
              
              // Tăng giá trị theo level
              const levelMultiplier = 1 + (pet.level - 1) * 0.5;
              return total + Math.floor(baseValue * levelMultiplier);
            }, 0);

            // Cập nhật số dư
            await new Promise((resolve, reject) => {
              db.run('UPDATE users SET money = money + ? WHERE user_id = ?', 
                [totalValue, userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            // Xóa thú
            await new Promise((resolve, reject) => {
              db.run('DELETE FROM pets WHERE user_id = ? AND rarity = ? AND is_in_team = 0', 
                [userId, rarityCode], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `💰 Đã bán ${petsToSell.length} thú ${rarityCode} với tổng giá trị ${totalValue} coins!\n\n` +
                        `Danh sách thú đã bán:\n` +
                        petsToSell.map(pet => 
                          `${pet.name} (${pet.rarity}) - Lv.${pet.level}`
                        ).join('\n') + 
                        `\n\n💳 Số dư hiện tại: ${totalValue} coins`
                })
              }
            });
          }
          else {
            // Bán một thú cụ thể
            const petIndex = parseInt(args[1]);
            if (isNaN(petIndex) || petIndex < 1) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Vui lòng nhập số thứ tự thú hợp lệ!' 
                  })
                }
              });
              return;
            }

            // Lấy thú từ kho
            const pet = await new Promise((resolve, reject) => {
              db.get('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 0 ORDER BY id LIMIT 1 OFFSET ?', 
                [userId, petIndex - 1], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });

            if (!pet) {
              await client.im.message.create({
                params: {
                  receive_id_type: 'chat_id'
                },
                data: {
                  receive_id: chatId,
                  msg_type: 'text',
                  content: JSON.stringify({ 
                    text: '❌ Không tìm thấy thú này trong kho!' 
                  })
                }
              });
              return;
            }

            // Tính giá trị
            const baseValue = {
              'C': 100,
              'D': 300,
              'E': 1000,
              'R': 3000,
              'M': 10000
            }[pet.rarity] || 100;
            
            // Tăng giá trị theo level
            const levelMultiplier = 1 + (pet.level - 1) * 0.5;
            const value = Math.floor(baseValue * levelMultiplier);

            // Cập nhật số dư
            await new Promise((resolve, reject) => {
              db.run('UPDATE users SET money = money + ? WHERE user_id = ?', 
                [value, userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            // Xóa thú
            await new Promise((resolve, reject) => {
              db.run('DELETE FROM pets WHERE id = ?', [pet.id], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });

            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: `💰 Đã bán ${pet.name} (${pet.rarity}) - Lv.${pet.level} với giá ${value} coins!\n` +
                        `💳 Số dư hiện tại: ${value} coins` 
                })
              }
            });
          }
          break;

        case 'items':
          const userItems = await getUserItems(db, userId);
          if (!userItems || userItems.length === 0) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Bạn chưa có item nào!' 
                })
              }
            });
            return;
          }

          let itemsMessage = '🎒 ITEMS CỦA BẠN:\n\n';
          userItems.forEach((item, index) => {
            const itemData = JSON.parse(item.stats);
            itemsMessage += `${index + 1}. ${item.name}\n`;
            itemsMessage += `📝 ${item.description}\n`;
            itemsMessage += `💪 Chỉ số:\n`;
            for (const [stat, value] of Object.entries(itemData)) {
              itemsMessage += `${stat}: ${value > 0 ? '+' : ''}${value}\n`;
            }
            itemsMessage += '\n';
          });

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: itemsMessage 
              })
            }
          });
          break;

        case 'points':
          const user = await new Promise((resolve, reject) => {
            db.get('SELECT points FROM users WHERE user_id = ?', [userId], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: `💎 Điểm của bạn: ${user.points || 0}` 
              })
            }
          });
          break;

        case 'bag':
          // Xem kho item
          const bagItems = await getUserItems(db, userId);
          if (!bagItems || bagItems.length === 0) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Kho đồ của bạn trống!' 
                })
              }
            });
            return;
          }

          let bagMessage = '🎒 KHO ĐỒ CỦA BẠN:\n\n';
          bagItems.forEach((item, index) => {
            const itemData = JSON.parse(item.stats);
            bagMessage += `${index + 1}. ${item.name} (${item.rarity})\n`;
            bagMessage += `${item.description}\n\n`;
            bagMessage += `💪 Chỉ số:\n`;
            for (const [stat, value] of Object.entries(itemData)) {
              // Chuyển đổi tên stat sang emoji và tên tiếng Việt
              const statDisplay = {
                'hp': '❤️ HP',
                'p_damage': '⚔️ Tấn công',
                'm_damage': '✨ Phép thuật',
                'armor': '🛡️ Giáp',
                'mr': '🔮 Kháng phép',
                'str': '💪 Sức mạnh',
                'crit_rate': '🎯 Tỷ lệ chí mạng',
                'crit_damage': '💥 Sát thương chí mạng',
                'attack_speed': '⚡ Tốc độ đánh',
                'movement_speed': '🏃 Tốc độ di chuyển',
                'defense': '🛡️ Phòng thủ'
              }[stat] || stat;
              bagMessage += `${statDisplay}: ${value > 0 ? '+' : ''}${value}\n`;
            }
            bagMessage += '\n';
          });

          bagMessage += '💡 Sử dụng:\n';
          bagMessage += '!owo equip [số thứ tự] - Trang bị item\n';
          bagMessage += '!owo unequip [số thứ tự] - Tháo item\n';
          bagMessage += '!owo sell item [số thứ tự] - Bán item';

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: bagMessage 
              })
            }
          });
          break;

        case 'equip':
          // Trang bị item cho thú
          const equipArgs = args[1]?.toLowerCase();
          if (!equipArgs) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Vui lòng nhập số thứ tự item và thú!\n💡 Sử dụng: !owo equip [số item] [số thú]' 
                })
              }
            });
            return;
          }

          // Lấy số thứ tự item và thú
          const [itemIndex, petIndex] = equipArgs.split(' ').map(Number);
          if (isNaN(itemIndex) || isNaN(petIndex) || itemIndex < 1 || petIndex < 1) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Số thứ tự không hợp lệ!\n💡 Sử dụng: !owo equip [số item] [số thú]' 
                })
              }
            });
            return;
          }

          // Lấy item từ kho
          const itemToEquip = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM items WHERE user_id = ? AND is_equipped = 0 ORDER BY id LIMIT 1 OFFSET ?', 
              [userId, itemIndex - 1], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (!itemToEquip) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Không tìm thấy item này trong kho!' 
                })
              }
            });
            return;
          }

          // Lấy thú từ đội
          const petToEquip = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1 ORDER BY id LIMIT 1 OFFSET ?', 
              [userId, petIndex - 1], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (!petToEquip) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Không tìm thấy thú này trong đội!' 
                })
              }
            });
            return;
          }

          // Kiểm tra item có thể trang bị cho thú không
          const itemData = JSON.parse(itemToEquip.stats);
          const petData = new Pet(petToEquip);
          
          // Tháo item cũ nếu có
          const oldItem = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM items WHERE user_id = ? AND equipped_pet_id = ? AND type = ?', 
              [userId, petToEquip.id, itemToEquip.type], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (oldItem) {
            await new Promise((resolve, reject) => {
              db.run('UPDATE items SET is_equipped = 0, equipped_pet_id = NULL WHERE id = ?', 
                [oldItem.id], (err) => {
                if (err) reject(err);
                else resolve();
              });
            });
          }

          // Trang bị item mới
          await new Promise((resolve, reject) => {
            db.run('UPDATE items SET is_equipped = 1, equipped_pet_id = ? WHERE id = ?', 
              [petToEquip.id, itemToEquip.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Cập nhật chỉ số thú
          petData.equipItem(itemToEquip);
          await new Promise((resolve, reject) => {
            db.run('UPDATE pets SET hp = ?, p_damage = ?, m_damage = ?, armor = ?, mr = ?, str = ?, crit_rate = ?, crit_damage = ?, attack_speed = ?, movement_speed = ?, defense = ? WHERE id = ?',
              [petData.stats.hp, petData.stats.p_damage, petData.stats.m_damage, petData.stats.armor, petData.stats.mr, petData.stats.str, petData.stats.crit_rate, petData.stats.crit_damage, petData.stats.attack_speed, petData.stats.movement_speed, petData.stats.defense, petToEquip.id],
              (err) => {
                if (err) reject(err);
                else resolve();
              });
          });

          // Gửi thông báo
          let equipMessage = `✅ Đã trang bị ${itemToEquip.name} cho ${petToEquip.name}!\n\n`;
          if (oldItem) {
            equipMessage += `🔄 Đã tháo ${oldItem.name}\n\n`;
          }
          equipMessage += `💪 Chỉ số mới của ${petToEquip.name}:\n`;
          equipMessage += formatPetStats(petData);

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: equipMessage 
              })
            }
          });
          break;

        case 'unequip':
          // Tháo item khỏi thú
          const unequipArgs = args[1]?.toLowerCase();
          if (!unequipArgs) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Vui lòng nhập số thứ tự thú!\n💡 Sử dụng: !owo unequip [số thú]' 
                })
              }
            });
            return;
          }

          // Lấy số thứ tự thú
          const unequipPetIndex = parseInt(unequipArgs);
          if (isNaN(unequipPetIndex) || unequipPetIndex < 1) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Số thứ tự không hợp lệ!\n💡 Sử dụng: !owo unequip [số thú]' 
                })
              }
            });
            return;
          }

          // Lấy thú từ đội
          const petToUnequip = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM pets WHERE user_id = ? AND is_in_team = 1 ORDER BY id LIMIT 1 OFFSET ?', 
              [userId, unequipPetIndex - 1], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (!petToUnequip) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Không tìm thấy thú này trong đội!' 
                })
              }
            });
            return;
          }

          // Lấy item đang trang bị
          const equippedItem = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM items WHERE user_id = ? AND equipped_pet_id = ?', 
              [userId, petToUnequip.id], (err, row) => {
              if (err) reject(err);
              else resolve(row);
            });
          });

          if (!equippedItem) {
            await client.im.message.create({
              params: {
                receive_id_type: 'chat_id'
              },
              data: {
                receive_id: chatId,
                msg_type: 'text',
                content: JSON.stringify({ 
                  text: '❌ Thú này chưa trang bị item nào!' 
                })
              }
            });
            return;
          }

          // Tháo item
          await new Promise((resolve, reject) => {
            db.run('UPDATE items SET is_equipped = 0, equipped_pet_id = NULL WHERE id = ?', 
              [equippedItem.id], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Cập nhật chỉ số thú
          const unequipPetData = new Pet(petToUnequip);
          unequipPetData.unequipItem(equippedItem.type.toLowerCase());
          await new Promise((resolve, reject) => {
            db.run('UPDATE pets SET hp = ?, p_damage = ?, m_damage = ?, armor = ?, mr = ?, str = ?, crit_rate = ?, crit_damage = ?, attack_speed = ?, movement_speed = ?, defense = ? WHERE id = ?',
              [unequipPetData.stats.hp, unequipPetData.stats.p_damage, unequipPetData.stats.m_damage, unequipPetData.stats.armor, unequipPetData.stats.mr, unequipPetData.stats.str, unequipPetData.stats.crit_rate, unequipPetData.stats.crit_damage, unequipPetData.stats.attack_speed, unequipPetData.stats.movement_speed, unequipPetData.stats.defense, petToUnequip.id],
              (err) => {
                if (err) reject(err);
                else resolve();
              });
          });

          // Gửi thông báo
          let unequipMessage = `✅ Đã tháo ${equippedItem.name} khỏi ${petToUnequip.name}!\n\n`;
          unequipMessage += `💪 Chỉ số mới của ${petToUnequip.name}:\n`;
          unequipMessage += formatPetStats(unequipPetData);

          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: unequipMessage 
              })
            }
          });
          break;

        default:
          // Hiển thị hướng dẫn
          await client.im.message.create({
            params: {
              receive_id_type: 'chat_id'
            },
            data: {
              receive_id: chatId,
              msg_type: 'text',
              content: JSON.stringify({ 
                text: '🎮 OWO BOT - GAME THÚ CƯNG\n\n' +
                      '📝 CÁC LỆNH CƠ BẢN:\n' +
                      '!owo hunt - Săn thú (cooldown: 30s)\n' +
                      '!owo team - Xem đội hình\n' +
                      '!owo inventory [trang] - Xem kho đồ (5 thú/trang)\n' +
                      '!owo bag - Xem kho item\n\n' +
                      
                      '⚔️ CHIẾN ĐẤU:\n' +
                      '!owo pvp [user_id] - Thách đấu người chơi\n' +
                      '!owo pvp a - Chấp nhận thách đấu\n' +
                      '!owo pvp d - Từ chối thách đấu\n' +
                      '!owo pve [easy/medium/hard] [forest/cave/volcano] - Đấu với quái vật (cooldown: 60s)\n\n' +
                      
                      '👥 QUẢN LÝ ĐỘI:\n' +
                      '!owo team add [số thứ tự] - Thêm thú vào đội\n' +
                      '!owo team remove [số thứ tự] - Xóa thú khỏi đội\n\n' +
                      
                      '🎒 QUẢN LÝ ITEM:\n' +
                      '!owo equip [số item] [số thú] - Trang bị item cho thú\n' +
                      '!owo unequip [số thú] - Tháo item khỏi thú\n\n' +
                      
                      '💰 BÁN THÚ:\n' +
                      '!owo sell [số thứ tự] - Bán một thú\n' +
                      '!owo sell all [độ hiếm] - Bán tất cả thú theo độ hiếm\n\n' +
                      
                      '💡 THÔNG TIN KHÁC:\n' +
                      '!owo points - Xem điểm của bạn\n' +
                      '!owo items - Xem danh sách item\n\n' +
                      
                      '📌 LƯU Ý:\n' +
                      '- Cần có ít nhất 3 thú trong đội để PvP/PvE\n' +
                      '- Độ hiếm thú: C (Common), D (Uncommon), E (Rare), R (Epic), M (Mythic)\n' +
                      '- Khu vực PvE: forest (Rừng), cave (Hang), volcano (Núi lửa)\n' +
                      '- Độ khó PvE: easy (Dễ), medium (Trung bình), hard (Khó)'
              })
            }
          });
      }

    } catch (error) {
      console.error('Error in owo command:', error);
      if (error.response?.data) {
        console.error('API Error:', error.response.data);
      }
      
      await client.im.message.create({
        params: {
          receive_id_type: 'chat_id'
        },
        data: {
          receive_id: chatId,
          msg_type: 'text',
          content: JSON.stringify({ 
            text: '❌ Có lỗi xảy ra!' 
          })
        }
      });
    }
  }
};

// Cập nhật cách hiển thị thông số trong các lệnh khác
function formatPetStats(pet) {
  // Tạo đối tượng Pet từ dữ liệu database
  const petData = new Pet({
    id: pet.id,
    name: pet.name,
    image: pet.image || '🐾',
    description: pet.description || 'A mysterious pet',
    rarity: pet.rarity,
    level: pet.level || 1,
    exp: pet.exp || 0,
    stats: {
      hp: pet.hp || 100,
      p_damage: pet.attack || 10,
      m_damage: pet.m_damage || 5,
      armor: pet.armor || 0,
      mr: pet.mr || 0,
      str: pet.str || 5,
      crit_rate: pet.crit_rate || 0.05,
      crit_damage: pet.crit_damage || 1.5,
      attack_speed: pet.attack_speed || 1.0,
      movement_speed: pet.movement_speed || 1.0,
      defense: pet.defense || 0
    }
  });

  let stats = `${petData.image} ${petData.name} (${petData.rarity})\n`;
  stats += `${petData.description}\n\n`;
  stats += `💪 Chỉ số:\n`;
  stats += `❤️ HP: ${petData.stats.hp}\n`;
  stats += `⚔️ Tấn công: ${petData.stats.p_damage}\n`;
  stats += `✨ Phép thuật: ${petData.stats.m_damage}\n`;
  stats += `🛡️ Giáp: ${petData.stats.armor}\n`;
  stats += `🔮 Kháng phép: ${petData.stats.mr}\n`;
  stats += `💪 Sức mạnh: ${petData.stats.str}\n`;
  stats += `🎯 Tỷ lệ chí mạng: ${(petData.stats.crit_rate * 100).toFixed(1)}%\n`;
  stats += `💥 Sát thương chí mạng: ${petData.stats.crit_damage}x\n`;
  stats += `⚡ Tốc độ đánh: ${petData.stats.attack_speed}\n`;
  stats += `🏃 Tốc độ di chuyển: ${petData.stats.movement_speed}\n`;
  stats += `🛡️ Phòng thủ: ${petData.stats.defense}\n`;
  
  // Thêm kiểm tra và giá trị mặc định cho exp và level
  const currentExp = petData.exp || 0;
  const currentLevel = petData.level || 1;
  const nextLevelExp = Pet.calculateExpForNextLevel(currentLevel);
  const expNeeded = nextLevelExp - currentExp;
  
  stats += `📊 EXP: ${currentExp}/${nextLevelExp} (Cần ${expNeeded} EXP để lên Lv.${currentLevel + 1})`;
  return stats;
}