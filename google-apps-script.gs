// SIMPLIFIED Travel Log Pro - Google Apps Script
// MUST be deployed from WITHIN a Google Sheet (Extensions → Apps Script)

function doPost(e) {
  try {
    // Get the active spreadsheet (the one this script is attached to)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Log what we received (for debugging)
    Logger.log('Received data type: ' + data.type);
    Logger.log('Data: ' + JSON.stringify(data));
    
    if (data.type === 'travel') {
      // Handle travel entries
      let travelSheet = ss.getSheetByName('Travel Log');
      
      // Create Travel Log sheet if it doesn't exist
      if (!travelSheet) {
        Logger.log('Creating Travel Log sheet...');
        travelSheet = ss.insertSheet('Travel Log', 0);
        
        // Add headers
        travelSheet.appendRow(['Entry ID', 'Date', 'Distance (km)', 'Location', 'Purpose', 'Status']);
        
        // Format header row
        const headerRange = travelSheet.getRange(1, 1, 1, 6);
        headerRange.setFontWeight('bold')
                   .setBackground('#06b6d4')
                   .setFontColor('#ffffff')
                   .setHorizontalAlignment('center');
        
        travelSheet.setFrozenRows(1);
        Logger.log('Travel Log sheet created!');
      }
      
      // Append the travel entry
      travelSheet.appendRow([
        data.entryId,
        data.date,
        data.distance,
        data.location,
        data.purpose,
        'Active'
      ]);
      
      Logger.log('Travel entry added successfully!');
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Travel entry logged',
        sheetUrl: ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.type === 'expense') {
      // Handle expense entries
      let expenseSheet = ss.getSheetByName('Business Expenses');
      
      // Create Business Expenses sheet if it doesn't exist
      if (!expenseSheet) {
        Logger.log('Creating Business Expenses sheet...');
        expenseSheet = ss.insertSheet('Business Expenses', 1);
        
        // Add headers
        expenseSheet.appendRow(['Entry ID', 'Date', 'Amount', 'Category', 'Description', 'Receipt Link', 'Status']);
        
        // Format header row
        const headerRange = expenseSheet.getRange(1, 1, 1, 7);
        headerRange.setFontWeight('bold')
                   .setBackground('#10b981')
                   .setFontColor('#ffffff')
                   .setHorizontalAlignment('center');
        
        expenseSheet.setFrozenRows(1);
        Logger.log('Business Expenses sheet created!');
      }
      
      let receiptUrl = 'N/A';
      
      // Handle receipt upload to Google Drive if present
      if (data.receiptData && data.receiptFileName) {
        try {
          Logger.log('Uploading receipt to Drive...');
          const receiptsFolder = getOrCreateReceiptsFolder();
          
          // Decode base64 image data
          const blob = Utilities.newBlob(
            Utilities.base64Decode(data.receiptData),
            data.receiptMimeType,
            data.receiptFileName
          );
          
          // Create file in Drive
          const timestamp = new Date().getTime();
          const fileName = `Receipt_${data.category}_${data.date}_${timestamp}_${data.receiptFileName}`;
          const file = receiptsFolder.createFile(blob.setName(fileName));
          
          // Make shareable
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          
          receiptUrl = file.getUrl();
          Logger.log('Receipt uploaded: ' + receiptUrl);
          
        } catch (driveError) {
          Logger.log('Error uploading to Drive: ' + driveError.toString());
          receiptUrl = 'Upload Failed: ' + driveError.toString();
        }
      }
      
      // Append the expense entry
      expenseSheet.appendRow([
        data.entryId,
        data.date,
        data.amount,
        data.category,
        data.description,
        receiptUrl,
        'Active'
      ]);
      
      Logger.log('Expense entry added successfully!');
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Expense logged',
        receiptUrl: receiptUrl,
        sheetUrl: ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.type === 'delete') {
      // Handle marking entries as deleted
      const sheetName = data.entryType === 'travel' ? 'Travel Log' : 'Business Expenses';
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error('Sheet not found: ' + sheetName);
      }
      
      // Find and mark as deleted
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === data.entryId) {
          const statusColumn = data.entryType === 'travel' ? 6 : 7;
          sheet.getRange(i + 1, statusColumn).setValue('Deleted');
          
          // Gray out the row
          const lastColumn = data.entryType === 'travel' ? 6 : 7;
          sheet.getRange(i + 1, 1, 1, lastColumn).setBackground('#f3f4f6');
          
          Logger.log('Entry marked as deleted: ' + data.entryId);
          
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Entry marked as deleted'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Entry not found'
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.type === 'edit') {
      // Handle editing entries
      const sheetName = data.entryType === 'travel' ? 'Travel Log' : 'Business Expenses';
      const sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        throw new Error('Sheet not found: ' + sheetName);
      }
      
      // Find and update the entry
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === data.entryId) {
          if (data.entryType === 'travel') {
            sheet.getRange(i + 1, 2).setValue(data.date);
            sheet.getRange(i + 1, 3).setValue(data.distance);
            sheet.getRange(i + 1, 4).setValue(data.location);
            sheet.getRange(i + 1, 5).setValue(data.purpose);
          } else {
            sheet.getRange(i + 1, 2).setValue(data.date);
            sheet.getRange(i + 1, 3).setValue(data.amount);
            sheet.getRange(i + 1, 4).setValue(data.category);
            sheet.getRange(i + 1, 5).setValue(data.description);
          }
          
          Logger.log('Entry updated: ' + data.entryId);
          
          return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Entry updated'
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Entry not found'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to get or create the Receipts folder
function getOrCreateReceiptsFolder() {
  const folderName = 'Travel Log Receipts';
  const folders = DriveApp.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    const folder = DriveApp.createFolder(folderName);
    Logger.log('Created new folder: ' + folderName);
    return folder;
  }
}

// Test function - Run this to verify everything works
function testDriveAccess() {
  try {
    const folder = getOrCreateReceiptsFolder();
    Logger.log('✓ Successfully accessed/created Drive folder: ' + folder.getName());
    Logger.log('✓ Folder URL: ' + folder.getUrl());
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    Logger.log('✓ Spreadsheet name: ' + ss.getName());
    Logger.log('✓ Spreadsheet URL: ' + ss.getUrl());
    
    return true;
  } catch (error) {
    Logger.log('✗ Error: ' + error.toString());
    return false;
  }
}

// Function to check what sheets exist
function listSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  Logger.log('Spreadsheet: ' + ss.getName());
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('Number of sheets: ' + sheets.length);
  
  sheets.forEach(function(sheet, index) {
    Logger.log((index + 1) + '. ' + sheet.getName());
  });
}
