const SHEET_ID = "14q5mJ2Bg6zpfWqtT3qiNp1-N0bv_l4-j098WQ9Xfrfg";
const RECEIPT_FOLDER_ID = "1L_uxaRa8MXp9qBQuZC2vDOd1gjFo-6IQ";

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
      .setTitle('Family Event Tracker')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getDashboardData() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    const expensesSheet = ss.getSheetByName("Expenses");
    const advanceSheet = ss.getSheetByName("Advance");
    const helperSheet = ss.getSheetByName("Helper");
    
    if (!expensesSheet || !advanceSheet || !helperSheet) {
      return { error: "Missing Tab: Ensure 'Expenses', 'Advance', and 'Helper' exist." };
    }

    const expenseData = expensesSheet.getDataRange().getValues();
    const advData = advanceSheet.getDataRange().getValues();
    const userData = helperSheet.getDataRange().getValues();
    
    const tz = Session.getScriptTimeZone();
    const todayStr = Utilities.formatDate(new Date(), tz, "dd-MMM-yyyy");

    let history = [];
    let advances = [];
    let userList = [];
    let categoryList = []; 
    let dayTotal = 0;
    let overallTotal = 0;

    if (userData.length > 1) {
      for (let k = 1; k < userData.length; k++) {
        const name = userData[k][0];
        if (name && name.toString().trim() !== "") {
          userList.push(name.toString().trim());
        }
        const cat = userData[k][1];
        if (cat && cat.toString().trim() !== "") {
          categoryList.push(cat.toString().trim());
        }
      }
    }

    if (expenseData.length > 1) {
      for (let i = 1; i < expenseData.length; i++) {
        if (!expenseData[i][0]) continue; 
        
        const amount = parseFloat(expenseData[i][5]) || 0; 
        const rowDate = new Date(expenseData[i][0]);
        const rowDateStr = Utilities.formatDate(rowDate, tz, "dd-MMM-yyyy");
        
        overallTotal += amount;
        if (rowDateStr === todayStr) dayTotal += amount;

        if (i >= expenseData.length - 20) {
          history.unshift({
            item: expenseData[i][4],
            amount: amount,
            receipt: expenseData[i][6] || "",
            date: rowDateStr,
            user: expenseData[i][2],
            category: expenseData[i][3]
          });
        }
      }
    }

    if (advData.length > 1) {
      for (let j = 1; j < advData.length; j++) {
        const vName = advData[j][0];
        if (!vName || vName.toString().trim() === "") continue;

        const subLogs = expenseData
          .filter(row => row[2] && row[2].toString().toLowerCase().includes(vName.toString().toLowerCase()))
          .map(row => ({
            date: row[0] instanceof Date ? Utilities.formatDate(row[0], tz, "dd MMM") : "N/A",
            amount: row[5] 
          }));

        advances.push({
          vendor: vName,
          total: parseFloat(advData[j][1]) || 0,
          paid: parseFloat(advData[j][2]) || 0,
          remaining: parseFloat(advData[j][3]) || 0,
          logs: subLogs
        });
      }
    }

    return {
      dayTotal: dayTotal.toLocaleString('en-IN'),
      overallTotal: overallTotal.toLocaleString('en-IN'),
      history: history,
      advances: advances,
      userList: userList,
      categoryList: categoryList 
    };

  } catch (e) {
    console.error(e);
    return { error: "Server Error: " + e.toString() };
  }
}

function addExpenses(items, base64Data, fileName, userName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName("Expenses");
  const tz = Session.getScriptTimeZone();
  const formattedDate = Utilities.formatDate(new Date(), tz, "dd-MMM-yyyy");
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  
  const finalUser = userName || "Guest";

  let receiptUrl = "No Receipt";
  if (base64Data && base64Data.includes(",")) {
    try {
      const folder = DriveApp.getFolderById(RECEIPT_FOLDER_ID);
      const splitData = base64Data.split(',');
      const blob = Utilities.newBlob(Utilities.base64Decode(splitData[1]), splitData[0].match(/:(.*?);/)[1], fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      receiptUrl = file.getUrl();
    } catch (e) { receiptUrl = "Error: " + e.message; }
  }

  if (Array.isArray(items)) {
    items.forEach(item => {
      sheet.appendRow([
        formattedDate, 
        dayName, 
        userName,       
        item.category, 
        item.name,     
        item.amount,   
        receiptUrl  ])     
    });
  }
  return getDashboardData();
}

function updateAdvanceEntry(vendor, total, paid, mode, base64Data, fileName, userName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const advSheet = ss.getSheetByName("Advance");
  const expensesSheet = ss.getSheetByName("Expenses");
  const tz = Session.getScriptTimeZone();
  const finalUser = userName || "Guest";
  
  const now = new Date();
  const formattedDate = Utilities.formatDate(now, tz, "dd-MMM-yyyy");
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

  let receiptUrl = "No Receipt";
  if (base64Data && base64Data.includes(",")) {
    try {
      const folder = DriveApp.getFolderById(RECEIPT_FOLDER_ID);
      const splitData = base64Data.split(',');
      const blob = Utilities.newBlob(Utilities.base64Decode(splitData[1]), splitData[0].match(/:(.*?);/)[1], fileName);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      receiptUrl = file.getUrl();
    } catch (e) { receiptUrl = "Error: " + e.message; }
  }

  expensesSheet.appendRow([
    formattedDate, 
    dayName, 
    finalUser, 
    "Vendor Payment", 
    vendor + " (Inst.)",
    paid, 
    receiptUrl
  ]);

  const data = advSheet.getDataRange().getValues();
  let foundIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][0].toString().toLowerCase() === vendor.toLowerCase()) {
      foundIdx = i + 1;
      break;
    }
  }

  if (foundIdx !== -1) {
    const currentPaid = (parseFloat(data[foundIdx - 1][2]) || 0) + paid;
    const contractTotal = parseFloat(data[foundIdx - 1][1]) || 0;
    advSheet.getRange(foundIdx, 3).setValue(currentPaid);
    advSheet.getRange(foundIdx, 4).setValue(contractTotal - currentPaid);
    advSheet.getRange(foundIdx, 5).setValue(finalUser); 
  } else {
    const finalTotal = total > 0 ? total : paid; 
    advSheet.appendRow([vendor, finalTotal, paid, (finalTotal - paid), finalUser]);
  }

  return getDashboardData();
}