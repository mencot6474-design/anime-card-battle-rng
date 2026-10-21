# Test Roll System

## Fitur yang Sudah Diterapkan

### 1. RNG-based Gacha System
- **Drop Rates:**
  - R (Common): 50%
  - SR (Uncommon): 25%  
  - SSR (Rare): 18%
  - UR (Epic): 4.5%
  - EX (Legendary): 2.45%

- **Function:** `rngRoll(luck=1, speedMultiplier=1)`
  - Return object: `{ cardId, tier, luckBonus, speedBoost }`
  - Pull-based (bukan pool-based)

### 2. Continuous Roll Animation
- **Button:** Rolling dice 🎲 di bottom-right
- **Animation Cycle:** Every 1.5 seconds
- **Visual Feedback:**
  - Dice pulse animation saat active
  - Card reveal overlay dengan opacity/scale transition
  - Rarity chip ditampilkan dengan warna sesuai tier

### 3. Backpack & Equipment System
- **Backpack Panel:** Toggle button 🎒 di bottom-left
- **Deck Slots:** 4 equipped card positions
- **Features:**
  - Quick equip kartu ke slot kosong
  - Unequip dari backpack atau deck slot
  - Total power calculation (HP + ATK all equipped cards)
  - Card picker modal untuk manual selection

### 4. Storage & Persistence
- `localStorage.setItem('animeBattle_backpack', ...)`
- `localStorage.setItem('animeBattle_equippedSlots', ...)`
- Auto-load on game start

### 5. Chapter Rewards (Planned)
- Bab 1: 500 instant rolls
- Bab 2+: 1000/5000 instant rolls
- Reward tiers: ["R", "SR", "SSR"] (no UR/EX)

## Cara Testing

### Manual Testing Steps:
1. **Login ke game** - Gunakan username/password apapun
2. **Klik tombol 🎲** (bottom-right)
   - Mulai rolling animation
   - Kartu muncul satu per satu setiap 1.5s
   - Rarity chip menampilkan tier (R/SR/SSR/UR/EX)
   - Collect button muncul setelah card reveal
   
3. **Stop rolling** - Klik lagi tombol 🎲
   - Animation berhenti
   - Sound effect (beep 330Hz square wave)

4. **Buka Backpack** - Klik 🎒 (bottom-left)
   - Lihat semua kartu yang dimiliki
   - Stack count ditampilkan per kartu
   - Total power dan number of cards shown

5. **Equip Cards**
   - Klik "Quick Equip" untuk slot kosong pertama
   - Atau klik langsung slot di deck layout
   - Use card picker untuk select specific card

6. **View in Action**
   - Kartu equipped akan muncul di lobby hub card
   - Power total terupdate secara real-time

### Expected Behaviors:

✅ **Roll Animation:**
- Dice pulse every 1.5s
- Smooth fade-in/out transitions
- Rarity chips color-coded

✅ **Drop Rate Distribution:**
After 1000 rolls: ~500 R, ~250 SR, ~180 SSR, ~45 UR, ~25 EX

✅ **Equipment System:**
- Max 4 slots
- Cards can't be unequipped if not owned
- Instant visual feedback

✅ **Persistence:**
- Backpack saved on each add/remove
- Equipped slots remembered on reload

## Known Issues / TODO

- ⚠️ Roll animation pauses when backpack open (design choice - bisa diubah jika needed)
- ⚠️ No sound effects on card reveal yet (could add sfx.pull())
- ⚠️ Chapter reward triggers belum implemented (requires battle completion detection)
- ⚠️ Weather bonuses not yet added (planned feature)

## Files Modified

- `index.html` - Added ~590 lines of JS logic + HTML UI elements
- Commit: `44b5da9` - Roll system implementation

## Code Structure

```javascript
// Core Functions
rngRoll()                    // Main RNG engine
startRollAnimation()         // Initiate continuous rolling
stopRollAnimation()          // Pause animation
showRollResult()             // Display card in overlay
hideRollResult()             // Close overlay

// Backpack Management
addToBackpack(cardId)        // Add new card
removeFromBackpack(cardId)   // Remove 1 stack
updateBackpackCount()        // Update badge count

// Equipment System
equipCard(slotIndex, cardId)    // Equip to slot
unequipCard(slotIndex)          // Remove from slot
renderDeckSlots()               // Render equipment UI
getTotalPower()                 // Calculate total stats

// Persistence
loadBackpackState()             // Restore from localStorage
saveBackpackState()             // Save current state
```

## Next Development Steps

1. ✅ Core roll system - DONE
2. ✅ Backpack UI - DONE
3. ⏳ Chapter reward auto-trigger (on level clear)
4. ⏳ Weather mechanics for luck bonus
5. ⏳ Sound effects integration
6. ⏳ Animation polish (card flip, rarity glow)

---

Test Date: 2026-10-06
Implementation Status: **Core System Complete**
