// ========== BACKPACK + ROLL SYSTEM ==========

let backpack = {};
let equippedSlots = [null, null, null, null];
let rollState = { active: false, interval: null, currentCard: null, luck: 1, speedMultiplier: 1 };

function addToBackpack(cardId) {
  if (!backpack[cardId]) {
    backpack[cardId] = 1;
  } else {
    backpack[cardId]++;
  }
  updateBackpackCount();
}

function removeFromBackpack(cardId) {
  if (backpack[cardId]) {
    backpack[cardId]--;
    if (backpack[cardId] <= 0) {
      delete backpack[cardId];
    }
    updateBackpackCount();
  }
}

function updateBackpackCount() {
  const toggle = document.getElementById('backpackToggle');
  if (toggle) {
    const count = Object.keys(backpack).length;
    toggle.setAttribute('data-count', count);
    if (count > 0) {
      toggle.classList.add('has-items');
    } else {
      toggle.classList.remove('has-items');
    }
  }
}

function startRollAnimation(luck = 1, speedMultiplier = 1) {
  if (rollState.active) return;
  
  rollState.luck = luck;
  rollState.speedMultiplier = speedMultiplier;
  rollState.active = true;
  
  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) rollBtn.classList.add('active');
  
  // Set initial delay based on speed multiplier
  const initialDelay = RNG_ROLL_SPEED / speedMultiplier;
  
  rollState.interval = setInterval(() => {
    const result = rngRoll(rollState.luck, rollState.speedMultiplier);
    showRollResult(result);
    addToBackpack(result.cardId);
  }, initialDelay);
}

function stopRollAnimation() {
  rollState.active = false;
  if (rollState.interval) {
    clearInterval(rollState.interval);
    rollState.interval = null;
  }
  const rollBtn = document.getElementById('rollBtn');
  if (rollBtn) rollBtn.classList.remove('active');
}

function showRollResult(result) {
  const overlay = document.getElementById('rollOverlay');
  const cardImg = document.getElementById('rollCardImg');
  const rarityChip = document.getElementById('rollRarityChip');
  const collectBtn = document.getElementById('collectBtn');
  
  if (!overlay || !cardImg || !rarityChip || !collectBtn) return;
  
  const cardData = getCardData(result.cardId);
  if (!cardData) return;
  
  rollState.currentCard = result;
  
  // Setup card display
  cardImg.src = cardData.art_image;
  cardImg.dataset.charId = result.cardId;
  
  // Set rarity chip
  rarityChip.textContent = result.tier;
  rarityChip.className = 'roll-rarity-chip';
  rarityChip.classList.add(`tier-${result.tier.toLowerCase()}`);
  
  // Show overlay with animation
  overlay.style.display = 'block';
  const showcase = overlay.querySelector('.roll-card-showcase');
  showcase.style.opacity = '0';
  showcase.style.transform = 'scale(0.8)';
  
  setTimeout(() => {
    showcase.style.transition = 'all 0.4s ease-in-out';
    showcase.style.opacity = '1';
    showcase.style.transform = 'scale(1)';
  }, 50);
  
  // Setup collect button
  collectBtn.onclick = () => collectCard(result.cardId);
}

function hideRollResult() {
  const overlay = document.getElementById('rollOverlay');
  if (!overlay) return;
  
  const showcase = overlay.querySelector('.roll-card-showcase');
  if (showcase) {
    showcase.style.transition = 'all 0.3s ease-out';
    showcase.style.opacity = '0';
    showcase.style.transform = 'scale(0.8)';
  }
  
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
}

function collectCard(cardId) {
  // Card already added to backpack on reveal
  // This just confirms collection and hides overlay
  hideRollResult();
  
  // Update backpack view if open
  renderBackpackPanel();
}

function equipCard(slotIndex, cardId) {
  if (slotIndex < 0 || slotIndex >= equippedSlots.length) return;
  
  // Unequip current card from slot
  const previousCard = equippedSlots[slotIndex];
  if (previousCard) {
    removeFromEquippedSlot(slotIndex);
  }
  
  // Check if card exists in backpack
  if (!backpack[cardId] || backpack[cardId] <= 0) return;
  
  // Equip new card
  equippedSlots[slotIndex] = cardId;
  addToEquippedSlot(slotIndex, cardId);
  
  renderLobby();
  renderDeckSlots();
}

function unequipCard(slotIndex) {
  if (slotIndex < 0 || slotIndex >= equippedSlots.length) return;
  
  const cardId = equippedSlots[slotIndex];
  if (!cardId) return;
  
  equippedSlots[slotIndex] = null;
  removeFromEquippedSlot(slotIndex);
  
  renderLobby();
  renderDeckSlots();
}

function addToEquippedSlot(slotIndex, cardId) {
  const item = {
    char_id: cardId,
    level: 1,
    rank: 0,
    exp: 0,
    is_equipped: true,
    skill_level: 1
  };
  
  const key = `equipped_${slotIndex}_${cardId}`;
  localStorage.setItem(key, JSON.stringify(item));
}

function removeFromEquippedSlot(slotIndex) {
  const cardId = equippedSlots[slotIndex];
  if (!cardId) return;
  
  const key = `equipped_${slotIndex}_${cardId}`;
  localStorage.removeItem(key);
}

function loadEquippedSlots() {
  equippedSlots = [null, null, null, null];
  
  for (let i = 0; i < 4; i++) {
    for (const [key, value] of Object.entries(localStorage)) {
      if (key.startsWith(`equipped_${i}_`)) {
        const cardId = key.split('_')[3];
        equippedSlots[i] = cardId;
        break;
      }
    }
  }
}

function getTotalPower() {
  let total = 0;
  for (const cardId of equippedSlots) {
    if (cardId) {
      const cardStatsObj = cardStats(cardId);
      total += cardStatsObj.atk + cardStatsObj.def;
    }
  }
  return total;
}

function renderDeckSlots() {
  const container = document.getElementById('deckSlotContainer');
  if (!container) return;
  
  const cards = getCards();
  let html = '';
  
  for (let i = 0; i < 4; i++) {
    const cardId = equippedSlots[i];
    const cardData = cardId ? cards.find(c => c.char_id === cardId) : null;
    
    if (cardData) {
      const stats = cardStats(cardId);
      const tierColor = getTierColor(cardData.tier);
      
      html += `
        <div class="deck-slot equipped" data-slot="${i}" onclick="equipCard(${i}, '${cardId}')">
          <img src="${cardData.art_image}" alt="${cardData.name}">
          <span class="deck-slot-tier" style="color:${tierColor}">${cardData.tier}</span>
          <button class="deck-unequip-btn" onclick="event.stopPropagation(); unequipCard(${i})">×</button>
          <div class="deck-slot-stats">
            <span class="stat-atk">${stats.atk}</span>
            <span class="stat-def">${stats.def}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="deck-slot empty" data-slot="${i}" onclick="openCardPicker(${i})">
          <span class="deck-slot-empty-text">+</span>
          <span class="deck-slot-empty-label">Tap to equip</span>
        </div>
      `;
    }
  }
  
  container.innerHTML = html;
}

function openCardPicker(slotIndex) {
  const cards = getCards();
  const pickerItems = Object.keys(backpack)
    .filter(charId => backpack[charId] > 0)
    .map(charId => {
      const card = cards.find(c => c.char_id === charId);
      if (!card) return null;
      const stats = cardStats(charId);
      return {
        ...card,
        stock: backpack[charId],
        atk: stats.atk,
        def: stats.def
      };
    })
    .filter(Boolean);
  
  if (pickerItems.length === 0) {
    alert('Tidak ada kartu di backpack! Roll dulu ya.');
    return;
  }
  
  const pickerHtml = `
    <div id="cardPickerModal" class="modal-backdrop" onclick="closeCardPicker()">
      <div class="card-picker-panel" onclick="event.stopPropagation()">
        <h3>Pilih Kartu untuk Slot ${slotIndex + 1}</h3>
        <div class="card-picker-grid">
          ${pickerItems.map(card => `
            <div class="card-picker-item" onclick="equipCard(${slotIndex}, '${card.char_id}')" style="border-color: ${getTierColor(card.tier)}">
              <img src="${card.art_image}" alt="${card.name}">
              <div class="card-picker-info">
                <div class="card-picker-name">${card.name}</div>
                <div class="card-picker-tier tier-${card.tier.toLowerCase()}">${card.tier}</div>
                <div class="card-picker-stats">
                  <span class="stat-atk">${card.atk} ATK</span>
                  <span class="stat-def">${card.def} DEF</span>
                </div>
                <div class="card-picker-stock">Stok: ${card.stock}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <button onclick="closeCardPicker()">Batal</button>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', pickerHtml);
}

function closeCardPicker() {
  const modal = document.getElementById('cardPickerModal');
  if (modal) {
    modal.remove();
  }
}

function renderBackpackPanel() {
  const panel = document.getElementById('backpackPanel');
  if (!panel) return;
  
  const cards = getCards();
  const equippedSet = new Set(equippedSlots);
  
  const backpackItems = Object.keys(backpack)
    .filter(charId => backpack[charId] > 0)
    .map(charId => {
      const card = cards.find(c => c.char_id === charId);
      if (!card) return null;
      const stats = cardStats(charId);
      const isEquipped = equippedSet.has(charId);
      return {
        ...card,
        stock: backpack[charId],
        atk: stats.atk,
        def: stats.def,
        isEquipped: isEquipped
      };
    })
    .filter(Boolean);
  
  if (backpackItems.length === 0) {
    panel.innerHTML = `
      <div class="backpack-content">
        <p>Backpack kosong!</p>
        <button onclick="toggleBackpack(); startRollAnimation()">Mulai Roll Cards</button>
      </div>
    `;
    return;
  }
  
  const totalPower = getTotalPower();
  
  let html = `
    <div class="backpack-header">
      <h2>Backpack</h2>
      <div class="backpack-stats">
        <span>Total Power: <strong>${totalPower}</strong></span>
        <span>Kartu: <strong>${backpackItems.length}</strong></span>
      </div>
      <button class="close-btn" onclick="toggleBackpack()">×</button>
    </div>
    <div class="backpack-body">
      <div class="deck-layout">
        <div class="deck-slots-section">
          <h3>Equipped Cards</h3>
          <div class="deck-slot-container" id="deckSlotContainer"></div>
        </div>
        <div class="backpack-cards-section">
          <h3>Your Cards (${backpackItems.length})</h3>
          <div class="backpack-grid">
  `;
  
  for (const item of backpackItems) {
    const tierColor = getTierColor(item.tier);
    html += `
      <div class="backpack-card-item" style="border-color: ${tierColor}">
        <img src="${item.art_image}" alt="${item.name}">
        <div class="backpack-card-info">
          <div class="backpack-card-name">${item.name}</div>
          <div class="backpack-card-tier tier-${item.tier.toLowerCase()}">${item.tier}</div>
          <div class="backpack-card-stats">
            <span class="stat-atk">${item.atk} ATK</span>
            <span class="stat-def">${item.def} DEF</span>
          </div>
          <div class="backpack-card-actions">
            ${item.isEquipped 
              ? `<button class="btn-unequip" onclick="unequipCardFromBackpack('${item.char_id}')">Unequip</button>`
              : `<button class="btn-equip" onclick="quickEquip('${item.char_id}')">Quick Equip</button>`
            }
            <button class="btn-stock" disabled>${item.stock} stk</button>
          </div>
        </div>
      </div>
    `;
  }
  
  html += `
          </div>
        </div>
      </div>
    </div>
  `;
  
  panel.innerHTML = html;
  
  // Re-render deck slots after panel is rendered
  renderDeckSlots();
}

function quickEquip(cardId) {
  // Find first empty slot
  const emptySlot = equippedSlots.findIndex(slot => slot === null);
  if (emptySlot !== -1) {
    equipCard(emptySlot, cardId);
  } else {
    alert('Semua slot sudah equipped! Unequip dulu salah satu.');
  }
}

function unequipCardFromBackpack(cardId) {
  // Find which slot this card is in
  const slotIndex = equippedSlots.indexOf(cardId);
  if (slotIndex !== -1) {
    unequipCard(slotIndex);
  }
}

function saveBackpackState() {
  localStorage.setItem('animeBattle_backpack', JSON.stringify(backpack));
  localStorage.setItem('animeBattle_equippedSlots', JSON.stringify(equippedSlots));
}

function loadBackpackState() {
  const savedBackpack = localStorage.getItem('animeBattle_backpack');
  const savedEquipped = localStorage.getItem('animeBattle_equippedSlots');
  
  if (savedBackpack) {
    try {
      backpack = JSON.parse(savedBackpack);
    } catch (e) {
      backpack = {};
    }
  }
  
  if (savedEquipped) {
    try {
      equippedSlots = JSON.parse(savedEquipped);
    } catch (e) {
      equippedSlots = [null, null, null, null];
    }
  }
  
  updateBackpackCount();
}
