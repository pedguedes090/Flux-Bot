class Entity {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.image = data.image;
    this.description = data.description;
    this.level = data.level || 1;
    this.exp = data.exp || 0;
    this.stats = {
      str: data.stats?.str || 0,
      crit_damage: data.stats?.crit_damage || 1.5,
      crit_rate: data.stats?.crit_rate || 0.05,
      p_damage: data.stats?.p_damage || 0,
      m_damage: data.stats?.m_damage || 0,
      attack_speed: data.stats?.attack_speed || 1.0,
      hp: data.stats?.hp || 100,
      armor: data.stats?.armor || 0,
      mr: data.stats?.mr || 0,
      movement_speed: data.stats?.movement_speed || 1.0,
      defense: data.stats?.defense || 0
    };
  }

  calculateDamage(target) {
    // Tính toán sát thương vật lý
    const physicalDamage = this.calculatePhysicalDamage(target);
    
    // Tính toán sát thương phép thuật
    const magicalDamage = this.calculateMagicalDamage(target);
    
    // Tính toán tổng sát thương
    let totalDamage = physicalDamage + magicalDamage;
    
    // Tính toán tỷ lệ chí mạng
    if (Math.random() < this.stats.crit_rate) {
      totalDamage *= this.stats.crit_damage;
    }
    
    // Yếu tố ngẫu nhiên (±10%)
    const randomFactor = 0.9 + Math.random() * 0.2;
    totalDamage *= randomFactor;
    
    // Đảm bảo sát thương tối thiểu là 1
    return Math.max(1, Math.floor(totalDamage));
  }

  calculatePhysicalDamage(target) {
    // Sát thương vật lý cơ bản
    const basePhysicalDamage = this.stats.p_damage;
    
    // Hệ số sức mạnh (ảnh hưởng đến sát thương vật lý)
    const strengthFactor = 1 + (this.stats.str / 100);
    
    // Hệ số tốc độ đánh (ảnh hưởng đến sát thương vật lý)
    const attackSpeedFactor = 1 + (this.stats.attack_speed - 1) * 0.2;
    
    // Tính toán sát thương vật lý
    let physicalDamage = basePhysicalDamage * strengthFactor * attackSpeedFactor;
    
    // Giảm sát thương dựa trên giáp của mục tiêu
    const armorReduction = target.stats.armor / (target.stats.armor + 100);
    physicalDamage *= (1 - armorReduction);
    
    // Giảm sát thương dựa trên phòng thủ của mục tiêu
    const defenseReduction = target.stats.defense / (target.stats.defense + 50);
    physicalDamage *= (1 - defenseReduction);
    
    return physicalDamage;
  }

  calculateMagicalDamage(target) {
    // Sát thương phép thuật cơ bản
    const baseMagicalDamage = this.stats.m_damage;
    
    // Hệ số sức mạnh (ảnh hưởng ít hơn đến sát thương phép)
    const strengthFactor = 1 + (this.stats.str / 200);
    
    // Hệ số tốc độ đánh (ảnh hưởng ít hơn đến sát thương phép)
    const attackSpeedFactor = 1 + (this.stats.attack_speed - 1) * 0.1;
    
    // Tính toán sát thương phép thuật
    let magicalDamage = baseMagicalDamage * strengthFactor * attackSpeedFactor;
    
    // Giảm sát thương dựa trên kháng phép của mục tiêu
    const magicResistReduction = target.stats.mr / (target.stats.mr + 100);
    magicalDamage *= (1 - magicResistReduction);
    
    // Giảm sát thương dựa trên phòng thủ của mục tiêu (ảnh hưởng ít hơn)
    const defenseReduction = target.stats.defense / (target.stats.defense + 100);
    magicalDamage *= (1 - defenseReduction * 0.5);
    
    return magicalDamage;
  }

  takeDamage(amount) {
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    return this.stats.hp;
  }

  isAlive() {
    return this.stats.hp > 0;
  }
}

class Pet extends Entity {
  constructor(data) {
    super(data);
    this.rarity = data.rarity;
    this.isInTeam = data.isInTeam || false;
    this.equippedItems = {
      weapon: null,
      armor: null,
      accessory: null
    };
  }

  static calculateLevel(exp) {
    return Math.floor(Math.sqrt(exp / 100)) + 1;
  }

  static calculateExpForNextLevel(currentLevel) {
    return Math.pow(currentLevel, 2) * 100;
  }

  calculateStats() {
    // Hệ số độ hiếm
    const rarityMultiplier = {
      'C': 1,
      'D': 1.2,
      'E': 1.5,
      'R': 2,
      'M': 3,
      'L': 4
    }[this.rarity] || 1;

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

    // Tính toán từng chỉ số
    for (const [stat, value] of Object.entries(this.stats)) {
      this.stats[stat] = calculateStat(value, this.level);
    }

    // Áp dụng stats từ items
    this.applyItemStats();
  }

  applyItemStats() {
    for (const item of Object.values(this.equippedItems)) {
      if (item) {
        for (const [stat, value] of Object.entries(item.stats)) {
          if (this.stats[stat] !== undefined) {
            this.stats[stat] += value;
          }
        }
      }
    }
  }

  equipItem(item) {
    if (!item) return false;

    const slot = item.type.toLowerCase();
    if (!this.equippedItems[slot]) return false;

    // Unequip current item if any
    if (this.equippedItems[slot]) {
      this.unequipItem(slot);
    }

    // Equip new item
    this.equippedItems[slot] = item;
    this.calculateStats();
    return true;
  }

  unequipItem(slot) {
    if (!this.equippedItems[slot]) return null;

    const item = this.equippedItems[slot];
    this.equippedItems[slot] = null;
    this.calculateStats();
    return item;
  }

  addExp(amount) {
    const oldLevel = this.level;
    this.exp += amount;
    this.level = Pet.calculateLevel(this.exp);
    
    if (this.level > oldLevel) {
      this.calculateStats();
    }
    
    return {
      oldLevel,
      newLevel: this.level,
      expNeeded: Pet.calculateExpForNextLevel(this.level) - this.exp
    };
  }

  getSellValue() {
    const baseValue = {
      'C': 100,
      'D': 300,
      'E': 1000,
      'R': 3000,
      'M': 10000,
      'L': 30000
    }[this.rarity] || 100;
    
    // Tăng giá trị theo level
    const levelMultiplier = 1 + (this.level - 1) * 0.5;
    return Math.floor(baseValue * levelMultiplier);
  }
}

class Monster extends Entity {
  constructor(data) {
    super(data);
    this.expReward = data.exp_reward || 50;
  }

  static calculateStats(monster, playerTeam, difficulty) {
    // Tính tổng chỉ số của đội người chơi
    const teamTotalStats = playerTeam.reduce((total, pet) => {
      return total + pet.stats.hp + (pet.stats.p_damage * 2) + (pet.stats.m_damage * 2);
    }, 0);

    // Hệ số độ khó
    const difficultyMultiplier = {
      'easy': 0.6,
      'medium': 0.8,
      'hard': 1.2
    }[difficulty] || 1;

    // Yếu tố ngẫu nhiên (±10%)
    const randomFactor = 0.9 + Math.random() * 0.2;

    // Tính toán chỉ số mới
    const newStats = {};
    for (const [stat, value] of Object.entries(monster.stats)) {
      newStats[stat] = Math.floor(value * (teamTotalStats / 1000) * difficultyMultiplier * randomFactor);
    }

    // Đảm bảo chỉ số tối thiểu
    return {
      hp: Math.max(100, newStats.hp),
      p_damage: Math.max(10, newStats.p_damage),
      m_damage: Math.max(10, newStats.m_damage),
      armor: Math.max(5, newStats.armor),
      mr: Math.max(5, newStats.mr),
      defense: Math.max(5, newStats.defense)
    };
  }
}

module.exports = {
  Pet,
  Monster
}; 