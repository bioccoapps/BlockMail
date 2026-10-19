const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let isForceClose = false;

// Registra automáticamente el nuevo doc-logo.ico en Windows para los archivos .bmail
function registrarIconoBmailEnWindows() {
  if (process.platform !== 'win32') return;

  const docIconPath = path.join(__dirname, 'doc-logo.ico');
  if (!fs.existsSync(docIconPath)) return;

  // Actualiza tanto la clase general de .bmail como cualquier ProgID previo que haya quedado de la versión 1.0
  const cmds = [
    `reg query "HKCU\\Software\\Classes\\.bmail" /ve`,
    `reg add "HKCU\\Software\\Classes\\.bmail" /ve /d "BlockMail.Document" /f`,
    `reg add "HKCU\\Software\\Classes\\.bmail\\DefaultIcon" /ve /d "\\"${docIconPath}\\",0" /f`,
    `reg add "HKCU\\Software\\Classes\\BlockMail.Document" /ve /d "Proyecto BlockMail" /f`,
    `reg add "HKCU\\Software\\Classes\\BlockMail.Document\\DefaultIcon" /ve /d "\\"${docIconPath}\\",0" /f`,
    `ie4uinit.exe -show`
  ];

  // Si había un identificador antiguo guardado en el registro, también le pisa el DefaultIcon
  exec('reg query "HKCU\\Software\\Classes\\.bmail" /ve', (err, stdout) => {
    if (!err && stdout) {
      const match = stdout.match(/REG_SZ\s+(.+)/);
      if (match && match[1]) {
        const oldProgId = match[1].trim();
        exec(`reg add "HKCU\\Software\\Classes\\${oldProgId}\\DefaultIcon" /ve /d "\\"${docIconPath}\\",0" /f`);
      }
    }
    exec(cmds.slice(1).join(' && '));
  });
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'app-logo.ico'), // Ícono de la ventana y barra de tareas
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  // Intercepta el cierre de la ventana para avisar si hay cambios sin guardar
  mainWindow.on('close', (e) => {
    if (!isForceClose) {
      e.preventDefault();
      mainWindow.webContents.send('request-app-close');
    }
  });
}

app.whenReady().then(() => {
  registrarIconoBmailEnWindows();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


// ==========================================
// COMUNICACIÓN CON EL SISTEMA OPERATIVO (IPC)
// ==========================================

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-user-data-path', () => app.getPath('userData'));

ipcMain.handle('show-save-dialog', async (event, options) => {
  return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
  return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('save-file', (event, filePath, content) => {
  try { 
    fs.writeFileSync(filePath, content, 'utf-8'); 
    return true; 
  } catch(e) { 
    return false; 
  }
});

ipcMain.on('force-close-app', () => {
  isForceClose = true;
  app.quit();
});