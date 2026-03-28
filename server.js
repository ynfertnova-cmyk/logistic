/**
 * 智能剪贴板提取工具 - 多人协作后端
 * 技术栈: Express + better-sqlite3 + xlsx
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');

// 确保data目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── SQLite 初始化 ───────────────────────────────────────────────────────────
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(path.join(DATA_DIR, 'records.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitter TEXT NOT NULL DEFAULT '匿名',
      data TEXT NOT NULL,
      source_preview TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS template (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      filename TEXT,
      headers TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO template (id, filename, headers) VALUES (1, NULL, NULL);
  `);
  console.log('✅ SQLite 数据库已初始化');
} catch (e) {
  console.error('SQLite 加载失败，使用内存存储:', e.message);
  // 降级：内存存储
  const memRecords = [];
  let memTemplate = { filename: null, headers: null };
  let idCounter = 1;
  db = {
    _mem: true,
    prepare: (sql) => ({
      run: (...args) => {
        if (sql.includes('INSERT INTO records')) {
          memRecords.push({ id: idCounter++, submitter: args[0], data: args[1], source_preview: args[2], created_at: new Date().toISOString() });
        } else if (sql.includes('UPDATE template')) {
          memTemplate = { filename: args[0], headers: args[1] };
        }
        return { changes: 1 };
      },
      get: (...args) => {
        if (sql.includes('FROM template')) return { ...memTemplate, id: 1 };
        if (sql.includes('FROM records WHERE id')) return memRecords.find(r => r.id === args[0]);
        return null;
      },
      all: (...args) => {
        if (sql.includes('FROM records')) return [...memRecords].reverse();
        return [];
      }
    }),
    exec: () => {}
  };
}

// ─── 中间件 ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// ─── API: 上传 Excel 模板 ────────────────────────────────────────────────────
app.post('/api/template', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未上传文件' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Excel 文件为空' });
    }

    // 取第一行非空单元格作为字段名
    const headers = (rows[0] || []).filter(h => h !== null && h !== undefined && String(h).trim() !== '');

    if (headers.length === 0) {
      return res.status(400).json({ error: '第一行没有找到列标题' });
    }

    // 保存模板文件到磁盘
    const templatePath = path.join(DATA_DIR, 'template.xlsx');
    fs.writeFileSync(templatePath, req.file.buffer);

    // 更新数据库
    db.prepare('UPDATE template SET filename=?, headers=?, updated_at=CURRENT_TIMESTAMP WHERE id=1')
      .run(req.file.originalname, JSON.stringify(headers));

    res.json({ success: true, filename: req.file.originalname, headers });
  } catch (e) {
    console.error('上传模板失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API: 获取当前模板信息 ───────────────────────────────────────────────────
app.get('/api/template', (req, res) => {
  try {
    const tpl = db.prepare('SELECT * FROM template WHERE id=1').get();
    if (!tpl || !tpl.headers) {
      return res.json({ filename: null, headers: [] });
    }
    res.json({
      filename: tpl.filename,
      headers: JSON.parse(tpl.headers)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: 提交提取结果 ───────────────────────────────────────────────────────
app.post('/api/records', (req, res) => {
  try {
    const { submitter, data, sourcePreview } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: '数据格式错误' });
    }

    const result = db.prepare(
      'INSERT INTO records (submitter, data, source_preview) VALUES (?, ?, ?)'
    ).run(
      submitter || '匿名',
      JSON.stringify(data),
      sourcePreview || ''
    );

    res.json({ success: true, id: result.lastInsertRowid || result.id });
  } catch (e) {
    console.error('提交记录失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── API: 获取所有提取记录 ───────────────────────────────────────────────────
app.get('/api/records', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM records ORDER BY id DESC').all();
    const records = rows.map(r => ({
      ...r,
      data: JSON.parse(r.data || '{}')
    }));
    res.json(records);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: 删除单条记录 ───────────────────────────────────────────────────────
app.delete('/api/records/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM records WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: 清空所有记录 ───────────────────────────────────────────────────────
app.delete('/api/records', (req, res) => {
  try {
    db.prepare('DELETE FROM records').run();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: 导出 Excel ─────────────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  try {
    const tpl = db.prepare('SELECT * FROM template WHERE id=1').get();
    const rows = db.prepare('SELECT * FROM records ORDER BY id ASC').all();

    let headers = [];
    let wb;

    // 尝试加载原始模板文件
    const templatePath = path.join(DATA_DIR, 'template.xlsx');
    if (tpl && tpl.headers) {
      headers = JSON.parse(tpl.headers);
    }

    if (fs.existsSync(templatePath) && headers.length > 0) {
      // 在模板文件基础上追加数据
      wb = XLSX.readFile(templatePath);
    } else {
      // 没有模板，新建工作簿
      wb = XLSX.utils.book_new();
    }

    const wsName = wb.SheetNames[0] || '数据汇总';
    let ws = wb.Sheets[wsName];

    if (!ws) {
      // 新建 sheet
      ws = {};
      XLSX.utils.book_append_sheet(wb, ws, wsName);
    }

    if (headers.length === 0) {
      // 从第一条记录推断字段
      if (rows.length > 0) {
        headers = Object.keys(JSON.parse(rows[0].data || '{}'));
      }
    }

    // 确定起始行（找到第一行有数据的列头行之后的第一个空行）
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    let startRow = range.e.r + 1; // 从已有数据下方开始追加

    // 如果是空 sheet，写入列头
    if (!ws['!ref'] || ws['!ref'] === 'A1:A1') {
      headers.forEach((h, ci) => {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: ci });
        ws[cellAddr] = { v: h, t: 's' };
      });
      startRow = 1;
    }

    // 写入数据行（同时加入提交者和时间）
    const allHeaders = [...headers, '提交者', '提交时间'];
    // 检查是否需要在末尾加这两列
    const lastColIdx = headers.length;

    rows.forEach((row, ri) => {
      const rowData = JSON.parse(row.data || '{}');
      const targetRow = startRow + ri;

      headers.forEach((h, ci) => {
        const cellAddr = XLSX.utils.encode_cell({ r: targetRow, c: ci });
        const val = rowData[h] !== undefined ? rowData[h] : '';
        ws[cellAddr] = { v: String(val), t: 's' };
      });

      // 追加提交者和时间
      ws[XLSX.utils.encode_cell({ r: targetRow, c: lastColIdx })] = { v: row.submitter || '匿名', t: 's' };
      ws[XLSX.utils.encode_cell({ r: targetRow, c: lastColIdx + 1 })] = { v: row.created_at || '', t: 's' };
    });

    // 更新 range
    const newEndRow = startRow + rows.length - 1;
    const newEndCol = headers.length + 1;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(newEndRow, 0), c: newEndCol } });

    // 列宽自适应
    ws['!cols'] = Array(newEndCol + 1).fill({ wch: 18 });

    const filename = encodeURIComponent(`数据汇总_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buf);
  } catch (e) {
    console.error('导出失败:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── 启动 ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 服务已启动: http://localhost:${PORT}`);
  console.log(`📁 数据目录: ${DATA_DIR}\n`);
});
