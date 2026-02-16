export const GAS_SCRIPT_TEMPLATE = `
// ============================================================================
// APLIKASI CBT - GOOGLE APPS SCRIPT BACKEND
// Versi: 1.1 (Fixed Syntax)
// ============================================================================

// 1. GET DATA (Untuk Sync ke Aplikasi)
function doGet(e) {
  try {
    var action = e.parameter.action;
    
    if (action === 'sync') {
      var data = {
        Settings: readData('Settings'),
        Students: readData('Students'),
        Questions: readData('Questions'),
        Packets: readData('Packets'),
        Exams: readData('Exams'),
        Results: readData('Results')
      };
      return sendJSON({ status: 'success', data: data });
    }
    
    return sendJSON({ status: 'error', message: 'Action not found' });
  } catch (err) {
    return sendJSON({ status: 'error', message: err.toString() });
  }
}

// 2. POST DATA (Create, Update, Delete)
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // Tunggu antrian max 30 detik

    // Parse Data dari React
    // React mengirim text/plain untuk bypass CORS preflight
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var sheetName = body.sheet;
    var payload = body.payload;
    var id = body.id;

    if (action === 'create') {
      createRow(sheetName, payload);
    } else if (action === 'update') {
      updateRow(sheetName, id, payload);
    } else if (action === 'delete') {
      deleteRow(sheetName, id);
    }

    return sendJSON({ status: 'success' });

  } catch (err) {
    return sendJSON({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function sendJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Membaca data dari sheet menjadi Array of Objects
function readData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  // Jika sheet belum ada, buat baru otomatis
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Tambah header default minimal jika sheet baru dibuat
    if (sheetName === 'Settings') sheet.appendRow(['Key', 'Value']);
    else sheet.appendRow(['id']);
    return [];
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var value = row[j];
      
      // Convert Date ke ISO String
      if (Object.prototype.toString.call(value) === '[object Date]') {
        obj[header] = value.toISOString();
      } else {
        obj[header] = value;
      }
    }
    results.push(obj);
  }
  return results;
}

// Menambah Baris Baru
function createRow(sheetName, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  var headers = getHeaders(sheet, payload);
  var newRow = [];

  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var val = payload[key];

    // Generate ID jika kosong
    if (key === 'id' && !val) val = Utilities.getUuid();
    // Stringify Object/Array
    if (val && typeof val === 'object') val = JSON.stringify(val);
    
    newRow.push(val === undefined ? '' : val);
  }

  sheet.appendRow(newRow);
}

// Update Baris
function updateRow(sheetName, id, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return; // Error jika sheet tidak ada saat update

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIndex = headers.indexOf('id');

  // Khusus Settings gunakan Key bukan ID
  if (sheetName === 'Settings') idIndex = headers.indexOf('Key');

  if (idIndex === -1) throw new Error("Kolom ID/Key tidak ditemukan di " + sheetName);

  for (var i = 1; i < data.length; i++) {
    // Bandingkan ID sebagai string agar aman
    if (String(data[i][idIndex]) === String(id)) {
      var rowIndex = i + 1;
      var currentRow = data[i];
      var updatedRow = [];

      for (var j = 0; j < headers.length; j++) {
        var header = headers[j];
        var newVal = payload[header];
        
        if (newVal === undefined) {
          // Jika tidak ada di payload, pakai nilai lama
          updatedRow.push(currentRow[j]);
        } else {
           // Stringify jika object
           if (newVal && typeof newVal === 'object') newVal = JSON.stringify(newVal);
           updatedRow.push(newVal);
        }
      }
      
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
      return; // Selesai update
    }
  }
}

// Hapus Baris
function deleteRow(sheetName, id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idIndex = headers.indexOf('id');

  if (sheetName === 'Settings') idIndex = headers.indexOf('Key');
  if (idIndex === -1) return;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

// Utility: Ambil atau Buat Header jika kolom baru
function getHeaders(sheet, payload) {
  var lastCol = sheet.getLastColumn();
  var headers = [];

  if (lastCol > 0) {
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  } else {
    // Sheet kosong, inisialisasi header dari payload
    headers = Object.keys(payload);
    // Pastikan 'id' ada di depan
    if (headers.indexOf('id') === -1 && headers.indexOf('Key') === -1) {
       headers.unshift('id');
    }
    sheet.appendRow(headers);
    return headers;
  }

  // Cek jika ada kolom baru di payload yang belum ada di header sheet
  var payloadKeys = Object.keys(payload);
  var newHeaders = [];
  
  for (var k = 0; k < payloadKeys.length; k++) {
    if (headers.indexOf(payloadKeys[k]) === -1) {
      newHeaders.push(payloadKeys[k]);
      headers.push(payloadKeys[k]);
    }
  }

  // Tambahkan kolom baru ke sheet fisik
  if (newHeaders.length > 0) {
    sheet.getRange(1, lastCol + 1, 1, newHeaders.length).setValues([newHeaders]);
  }

  return headers;
}

// Fungsi Setup (Jalankan Sekali Manual jika mau reset)
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ['Settings', 'Students', 'Questions', 'Packets', 'Exams', 'Results'];
  
  sheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      ss.insertSheet(name);
    }
  });
}

// ============================================================================
// END OF CODE
// ============================================================================
`;
