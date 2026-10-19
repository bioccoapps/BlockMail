const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { autoUpdater } = require('electron-updater'); // <-- EL MOTOR DE ACTUALIZACIONES

let mainWindow;
let isForceClose = false;

// Configuración de actualizaciones invisibles
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function registrarIconoBmailEnWindows() {
  if (process.platform !== 'win32') return;
  const docIconPath = path.join(__dirname, 'doc-logo.ico');
  if (!fs.existsSync(docIconPath)) return;

  const cmds = [
    `reg query "HKCU\\Software\\Classes\\.bmail" /ve`,
    `reg add "HKCU\\Software\\Classes\\.bmail" /ve /d "BlockMail.Document" /f`,
    `reg add "HKCU\\Software\\Classes\\.bmail\\DefaultIcon" /ve /d "\\"${docIconPath}\\",0" /f`,
    `reg add "HKCU\\Software\\Classes\\BlockMail.Document" /ve /d "Proyecto BlockMail" /f`,
    `reg add "HKCU\\Software\\Classes\\BlockMail.Document\\DefaultIcon" /ve /d "\\"${docIconPath}\\",0" /f`,
    `ie4uinit.exe -show`
  ];

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
    icon: path.join(__dirname, 'app-logo.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  // 🔥 SOLUCIÓN A LA CARRERA: Espera a que la interfaz cargue para buscar la actualización
  mainWindow.webContents.once('did-finish-load', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
    }
  });

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
// COMUNICACIÓN IPC DEL AUTO-UPDATER
// ==========================================
autoUpdater.on('update-available', (info) => {
  mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow.webContents.send('update-downloaded', info);
});

// 🔥 NUEVO: Atrapamos errores silenciosos
autoUpdater.on('error', (err) => {
  mainWindow.webContents.send('update-error', err.message);
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
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
  try { fs.writeFileSync(filePath, content, 'utf-8'); return true; } catch(e) { return false; }
});
ipcMain.on('force-close-app', () => {
  isForceClose = true;
  app.quit();
});