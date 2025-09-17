const express = require("express");
const bodyParser = require("body-parser");
const { runPluCheck } = require("../nn-core");
const serverless = require("serverless-http");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send(`
    <h2>🛒 Cek Stok KlikIndomaret</h2>
    <form method="POST" action="/cek">
      <label>Kode Toko:</label><br/>
      <input type="text" name="storeCode" required/><br/><br/>
      <label>Daftar PLU (pisahkan koma atau baris baru):</label><br/>
      <textarea name="pluList" rows="5" cols="50"></textarea><br/><br/>
      <button type="submit">Cek Stok</button>
    </form>
  `);
});

app.post("/cek", async (req, res) => {
  const { storeCode, pluList } = req.body;
  const list = pluList.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

  try {
    const hasil = await runPluCheck(storeCode, list);

    let table = "<table border=1 cellpadding=5><tr><th>No</th><th>PLU</th><th>Nama Produk</th><th>Stok</th></tr>";
    hasil.forEach((p, i) => {
      table += `<tr><td>${i + 1}</td><td>${p.plu}</td><td>${p.name}</td><td>${p.stock}</td></tr>`;
    });
    table += "</table>";

    res.send(`<h3>✅ Hasil cek stok toko ${storeCode}</h3>${table}<br/><a href="/">🔙 Kembali</a>`);
  } catch (e) {
    res.send(`❌ Error: ${e.message}<br/><a href="/">🔙 Kembali</a>`);
  }
});

module.exports = serverless(app);

