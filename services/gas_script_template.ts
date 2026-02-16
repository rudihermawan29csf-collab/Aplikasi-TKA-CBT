export const GAS_SCRIPT_TEMPLATE = `// --- SALIN DARI SINI KE BAWAH (JANGAN SALIN BAGIAN 'export const' DI ATAS) ---
// ============================================================================
// APLIKASI CBT - GOOGLE APPS SCRIPT BACKEND
// Versi: 1.5 (Remote Setup Enabled)
// ============================================================================

// KONFIGURASI NAMA SHEET DAN KOLOM
var SCHEMA = {
  'Settings': ['Key', 'Value'],
  'Students': ['id', 'no', 'name', 'class', 'nis', 'nisn'],
  'Questions': ['id', 'packetId', 'number', 'stimulus', 'text', 'image', 'type', 'options', 'correctAnswerIndex', 'correctAnswerIndices', 'matchingPairs', 'category'],
  'Packets': ['id', 'name', 'category', 'totalQuestions', 'questionTypes'],
  'Exams': ['id', 'title', 'packetId', 'scheduledStart', 'scheduledEnd', 'durationMinutes', 'classTarget', 'questions', 'isActive'],
  'Results': ['id', 'examId', 'examTitle', 'studentId', 'studentName', 'studentClass', 'score', 'literasiScore', 'numerasiScore', 'answers', 'timestamp', 'violationCount', 'isDisqualified']
};

// 1. GET DATA (Untuk Sync ke Aplikasi)
function doGet(e) {
  try {
    var action = e.parameter.action;
    
    // Action Sync: Ambil semua data sekaligus
    if (action === 'sync') {
      var data = {};
      var sheetNames = Object.keys(SCHEMA);
      
      for (var i = 0; i < sheetNames.length; i++) {
        var name = sheetNames[i];
        data[name] = readData(name);
      }
      
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
    lock.waitLock(30000); // Lock 30 detik

    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    
    // Fitur Khusus: Remote Setup (Buat Header jika belum ada)
    if (action === 'setup') {
       setup();
       return sendJSON({ status: 'success', message: 'Database initialized' });
    }

    var sheetName = body.sheet;
    var payload = body.payload;
    var id = body.id;

    if (!SCHEMA[sheetName]) {
      return sendJSON({ status: 'error', message: 'Sheet not found in Schema' });
    }

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

function readData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0]; 
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    var hasData = false;
    
    for (var j = 0; j < headers.length; j++) {
      var header = headers[j];
      var value = row[j];
      
      if (value !== "" && value !== null) hasData = true;

      if (Object.prototype.toString.call(value) === '[object Date]') {
        obj[header] = value.toISOString();
      } else {
        obj[header] = value;
      }
    }
    if (hasData) results.push(obj);
  }
  return results;
}

function createRow(sheetName, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var newRow = [];

  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    var val = payload[key];

    if (key === 'id' && !val) val = Utilities.getUuid();
    
    if (val && (typeof val === 'object' || Array.isArray(val))) {
        val = JSON.stringify(val);
    }
    
    newRow.push(val === undefined ? '' : val);
  }

  sheet.appendRow(newRow);
}

function updateRow(sheetName, id, payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  
  var idColumn = (sheetName === 'Settings') ? 'Key' : 'id';
  var idIndex = headers.indexOf(idColumn);

  if (idIndex === -1) return;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(id)) {
      var rowIndex = i + 1;
      var currentRow = data[i];
      var updatedRow = [];

      for (var j = 0; j < headers.length; j++) {
        var header = headers[j];
        var newVal = payload[header];
        
        if (newVal === undefined) {
          updatedRow.push(currentRow[j]); 
        } else {
           if (newVal && (typeof newVal === 'object' || Array.isArray(newVal))) {
               newVal = JSON.stringify(newVal);
           }
           updatedRow.push(newVal);
        }
      }
      
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);
      return;
    }
  }
}

function deleteRow(sheetName, id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idColumn = (sheetName === 'Settings') ? 'Key' : 'id';
  var idIndex = headers.indexOf(idColumn);

  if (idIndex === -1) return;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

// 3. SETUP FUNCTION (Dijalankan saat pertama kali)
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = Object.keys(SCHEMA);

  sheetNames.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    
    var requiredHeaders = SCHEMA[name];
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(requiredHeaders);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  });
}
`;