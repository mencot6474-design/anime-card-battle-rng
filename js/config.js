/* ===========================================================
 * KONFIGURASI RUNTIME (isi manual, jangan commit secret).
 *
 * 1) trakteerShopUrl  : URL toko Trakteer (contoh: https://trakteer.id/toko-anda)
 * 2) trakteerProducts : map packId -> slug produk di Trakteer
 *                       (bila slug = product ID Google Play, boleh dihapus)
 *
 * Nominal harga & jumlah gems SELALU ditentukan server
 * (supabase/functions/_shared/packs.ts) — bukan dari file ini.
 * =========================================================== */
window.ACB_CONFIG = {
  trakteerShopUrl: "",

  trakteerProducts: {
    p100:  "gems_100",
    p500:  "gems_500",
    p1000: "gems_1000",
    p2500: "gems_2500",
    p5000: "gems_5000",
  },
};
