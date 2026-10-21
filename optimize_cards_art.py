"""
Card Art Optimizer & Converter for TCG Game
- Mengonversi semua gambar di assets/cards/art/ ke format WebP
- Resize proporsional dengan Lanczos resampling (High Quality, tajam, tidak pecah)
- Target resolusi: Max width 600px (tinggi proporsional ~894px), pas untuk 2x Retina TCG Card
- WebP quality: 85 (visual lossless, ukuran drop drastis)
- Backup file original ke folder backups/
"""

import os
import glob
import shutil
import re
from PIL import Image

PROJECT_ROOT = os.path.abspath(r"C:\Users\HDD\Documents\Qoder\2026-09-29\dedf0eda")
ART_DIR = os.path.join(PROJECT_ROOT, "assets", "cards", "art")
BACKUP_DIR = os.path.join(PROJECT_ROOT, "backups", "cards_art_original")

TARGET_MAX_WIDTH = 600
WEBP_QUALITY = 85

def optimize_and_convert():
    if not os.path.exists(ART_DIR):
        print(f"Directory tidak ditemukan: {ART_DIR}")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    files = glob.glob(os.path.join(ART_DIR, "*"))
    image_files = [f for f in files if os.path.isfile(f) and f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    
    print(f"Ditemukan {len(image_files)} gambar di {ART_DIR}")
    print(f"Target Max Width: {TARGET_MAX_WIDTH}px (Lanczos Resampling, WebP Q={WEBP_QUALITY})")
    print(f"Folder Backup: {BACKUP_DIR}\n" + "="*50)
    
    total_before = 0
    total_after = 0
    converted_count = 0

    for idx, filepath in enumerate(image_files, 1):
        filename = os.path.basename(filepath)
        name, ext = os.path.splitext(filename)
        size_before = os.path.getsize(filepath)
        total_before += size_before
        
        # 1. Backup file asli jika belum ada di backup
        backup_path = os.path.join(BACKUP_DIR, filename)
        if not os.path.exists(backup_path):
            shutil.copy2(filepath, backup_path)
            
        # 2. Buka dan proses gambar
        with Image.open(filepath) as img:
            # Konversi format color jika perlu (RGBA untuk png transparan, RGB untuk jpg)
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                processed_img = img.convert("RGBA")
            else:
                processed_img = img.convert("RGB")
                
            orig_w, orig_h = processed_img.size
            
            # Hitung ukuran baru (hanya downscale jika lebih besar dari TARGET_MAX_WIDTH)
            if orig_w > TARGET_MAX_WIDTH:
                ratio = TARGET_MAX_WIDTH / float(orig_w)
                new_w = TARGET_MAX_WIDTH
                new_h = int(round(orig_h * ratio))
                # Menggunakan LANCZOS (kualitas tertinggi untuk downscale art/gambar)
                resample_filter = getattr(Image.Resampling, 'LANCZOS', Image.LANCZOS)
                processed_img = processed_img.resize((new_w, new_h), resample=resample_filter)
            else:
                new_w, new_h = orig_w, orig_h

            target_webp_path = os.path.join(ART_DIR, f"{name}.webp")
            
            # Simpan ke format WebP
            processed_img.save(target_webp_path, format="WEBP", quality=WEBP_QUALITY, method=6)
            
        size_after = os.path.getsize(target_webp_path)
        total_after += size_after
        converted_count += 1
        
        # Hapus file lama jika aslinya bukan .webp (misal .jpg atau .png)
        if ext.lower() != '.webp' and os.path.exists(target_webp_path):
            try:
                os.remove(filepath)
            except Exception as e:
                print(f"Gagal menghapus file lama {filename}: {e}")

        pct_saved = ((size_before - size_after) / size_before) * 100 if size_before > 0 else 0
        print(f"[{idx}/{len(image_files)}] {filename} -> {name}.webp | {orig_w}x{orig_h} -> {new_w}x{new_h} | {size_before/1024:.1f}KB -> {size_after/1024:.1f}KB (-{pct_saved:.1f}%)")

    print("="*50)
    print(f"Selesai mengonversi {converted_count} file!")
    print(f"Total ukuran sebelum : {total_before / (1024*1024):.2f} MB")
    print(f"Total ukuran sesudah : {total_after / (1024*1024):.2f} MB")
    savings = total_before - total_after
    print(f"Hemat kuota/storage : {savings / (1024*1024):.2f} MB (Hemat {(savings/total_before)*100:.1f}%)")
    
    # 3. Update referensi di file kode JS
    update_code_references()

def update_code_references():
    print("\nMemperbarui referensi path di kode javascript...")
    js_files = [
        os.path.join(PROJECT_ROOT, "js", "data.js"),
        os.path.join(PROJECT_ROOT, "js", "cards-fx.js"),
        os.path.join(PROJECT_ROOT, "js", "raid.js"),
    ]
    
    for js_path in js_files:
        if not os.path.exists(js_path):
            continue
            
        with open(js_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Ganti assets/cards/art/(nama).jpg atau .png -> .webp
        # Kecuali file video (.mp4/.webm)
        new_content, count = re.subn(
            r'(assets/cards/art/[a-zA-Z0-9_\-]+)\.(jpg|jpeg|png)',
            r'\1.webp',
            content
        )
        
        if count > 0:
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"  [OK] {os.path.basename(js_path)}: {count} referensi diubah ke .webp")
        else:
            print(f"  [-] {os.path.basename(js_path)}: tidak ada perubahan")

if __name__ == "__main__":
    optimize_and_convert()
