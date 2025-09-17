const axios = require("axios");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const xlsx = require("xlsx");
const { execSync } = require("child_process");

const tokenPath = path.join(__dirname, "token.txt");
const districtId = "141100100";
const latitude = -6.961055555555555;
const longitude = 107.55672222222222;
const mode = "PICKUP";
const outputXLSX = path.join(__dirname, "stok.xlsx");

// Deteksi apakah jalan di Vercel
const isServerless = !!process.env.VERCEL;

async function runPluCheck(storeCode, pluList) {
  // cek token
  if (!isServerless && !fs.existsSync(tokenPath)) {
    console.log("❌ token.txt tidak ditemukan. Refreshing...");
    execSync(`node get4.js "${storeCode}"`, { stdio: "inherit" });
    execSync("node token.js", { stdio: "inherit" });
    if (!fs.existsSync(tokenPath)) throw new Error("Token tidak tersedia!");
  }

  let token = "";
  if (!isServerless) {
    token = fs.readFileSync(tokenPath, "utf8").trim();
  } else {
    token = process.env.API_TOKEN || "";
    if (!token) throw new Error("Token tidak tersedia di serverless! Set ENV API_TOKEN.");
  }

  const apiContext = axios.create({
    baseURL: "https://ap-mc.klikindomaret.com",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      origin: "https://www.klikindomaret.com",
      referer: "https://www.klikindomaret.com/",
      "user-agent": "Mozilla/5.0",
      "x-correlation-id": crypto.randomUUID(),
      "Request-Time": new Date().toISOString(),
    },
  });

  const addedProducts = [];
  for (const plu of pluList) {
    try {
      const res = await apiContext.post(
        "/assets-klikidmcore/api/post/cart-xpress/api/webapp/cart/add-to-cart",
        {
          storeCode,
          districtId,
          latitude,
          longitude,
          mode,
          products: [{ plu, qty: 1 }],
        }
      );

      const products = res.data?.data?.products || [];
      if (products.length > 0) {
        const p = products[0];
        addedProducts.push({ plu: p.plu, name: p.productName, stock: p.stock });
      } else {
        addedProducts.push({ plu, name: "tidak ditemukan / stok 0", stock: 0 });
      }

      // clear cart
      await apiContext.post(
        "/assets-klikidmorder/api/post/cart-xpress/api/webapp/cart/update-cart",
        { storeCode, districtId, latitude, longitude, mode, products: [] }
      );
    } catch (e) {
      addedProducts.push({ plu, name: "Gagal cek", stock: "N/A" });
    }
  }

  // simpan ke Excel hanya kalau lokal
  if (!isServerless) {
    simpanKeExcel(addedProducts);
  }

  return addedProducts;
}

function simpanKeExcel(addedProducts) {
  const excelData = addedProducts.map((p, i) => ({
    No: i + 1,
    PLU: p.plu,
    "Nama Produk": p.name,
    "Sisa Stok": p.stock,
  }));

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(excelData);

  ws["!cols"] = ["No", "PLU", "Nama Produk", "Sisa Stok"].map((col) => {
    const maxLen = Math.max(...excelData.map((row) => String(row[col]).length), col.length);
    return { wch: maxLen + 2 };
  });

  xlsx.utils.book_append_sheet(wb, ws, "Cart");
  xlsx.writeFile(wb, outputXLSX);
  console.log(`📦 Data disimpan ke ${outputXLSX}`);
}

module.exports = { runPluCheck };
